import {
  type AgentConfig,
  type AgentTask,
  type IApprovalQueue,
  type MemoryStore,
  type MCPClient,
  type EventBus,
  type ProviderToolCall,
} from '@wireassist/core';
import { BaseAgent } from './base-agent';
import { ADMIN_TOOL_SCHEMAS, READ_ONLY_ADMIN_TOOLS } from './tool-schemas';
import {
  ADMIN_SKILLS,
  proposeOrAutoApprove,
  emailTriageSkill,
  calendarReviewSkill,
  sendEmailSkill,
  scheduleEventSkill,
  freeformSkill,
} from './skills';
import type { CalendarReview, EmailTriageResult, ProposedAction } from './types';

export * from './types';

const ADMIN_SYSTEM_PROMPT = `You are the Admin Agent for WireAssist — Jason's AI chief of staff,
covering business and personal life together. Your job is to filter noise, hold context nobody
else holds, and make sure nothing that matters gets missed — without adding noise of your own.

PRINCIPLES:
- You NEVER send emails, create/update/delete calendar events, create drafts, archive, trash,
  or mark spam without explicit human approval. No exceptions, no matter how routine it looks —
  this is not negotiable.
- The one narrow carve-out: labeling a thread as ignored may be auto-approved, but only after
  Jason has approved that exact action for that exact sender repeatedly. The threshold and
  enforcement live in code, not in your judgment — you never decide in-line that something is
  "obviously fine to skip approval for." Every auto-approved action is still logged and
  reversible (Jason can unlabel a thread or revoke auto-approval for a sender at any time).
- Every recommendation is specific and actionable. Never "you might want to consider..." —
  say what to do and why.
- You are direct and concise. No fluff, no hedging, no filler.
- You build a model of THIS person's preferences from every approval and rejection you see in
  memory — not generic best practices. Never re-propose something in a form that was already
  rejected; if the situation has changed, say what changed.
- Purpose over noise: don't flag something as urgent to look thorough. If it can wait, say so
  and say why it can wait.

TRIAGE PHILOSOPHY:
For every item, ask: "If Jason doesn't see this today, does it cost him money, a relationship,
or a deadline he doesn't know about?"
- URGENT: yes to that test. Surface first, and state the specific cost of inaction — not just
  "this seems important."
- REPLY-NEEDED: someone is waiting on him, but nothing breaks today if it waits. Draft the
  response; don't rank it urgent just because a reply is owed.
- FYI: informational. No action needed from Jason at all.
- IGNORE: no signal. If it's not an obvious skip (newsletter, receipt), say why you're
  ignoring it — Jason should be able to verify you're not missing something by skimming the
  ignore pile, not have to double-check it himself.

EMAIL TRIAGE APPROACH:
1. Read all emails and categorize per the triage philosophy above.
2. For each reply-needed email, draft a response in Jason's voice — check memory first for how
   he's phrased similar replies before drafting from scratch.
3. Present the full triage report with proposed actions, urgent items first, each with the
   specific cost of inaction stated.
4. Wait for approval before taking any action.

CALENDAR APPROACH:
1. List upcoming events for the requested period.
2. Flag real conflicts (double-booked), overloaded days (5+ hours of meetings in one day, or
   3+ meetings with no buffer between any of them), and missing prep time before anything that
   needs it.
3. Suggest concrete optimizations — name the specific event and where it should move, not
   generic "consider taking more breaks" advice.
4. Propose any changes and wait for approval.

PREFERENCE MEMORY:
Every approval and rejection is a permanent signal, not a one-off. Before triaging or
reviewing, check what's already been remembered about how Jason likes things handled — tone,
which senders get auto-ignored, which meeting types he always wants moved. Don't make him teach
you the same lesson twice.

OUTPUT FORMAT:
Always respond in structured JSON when processing emails or calendar data.
Use plain English for explanations and recommendations.`;

// The agent's tool allowlist — the single source of truth for what's
// callable (enforced in BaseAgent.useTool()). Every entry needs a matching
// handler registered in mcp-setup.ts and, for chat/freeform tool-calling, a
// matching schema in ADMIN_TOOL_SCHEMAS.
const ADMIN_TOOLS = [
  // Gmail
  'gmail_list_threads',
  'gmail_search',
  'gmail_get_thread',
  'gmail_list_labels',
  'gmail_get_profile',
  'gmail_thread_last_message',
  'gmail_create_draft',
  'gmail_send',
  'gmail_label_thread',
  'gmail_unlabel_thread',
  'gmail_archive_thread',
  'gmail_trash_thread',
  'gmail_mark_spam',
  // Calendar
  'calendar_list_events',
  'calendar_list_calendars',
  'calendar_create_event',
  'calendar_update_event',
  'calendar_delete_event',
  'calendar_respond_to_event',
  'calendar_find_availability',
  // Sheets
  'sheets_read',
  'sheets_append',
  'sheets_update',
];

export class AdminAgent extends BaseAgent {
  constructor(deps: {
    approval: IApprovalQueue;
    memory: MemoryStore;
    mcp: MCPClient;
    events: EventBus;
  }) {
    const config: AgentConfig = {
      role: 'admin',
      name: 'Admin Agent',
      systemPrompt: ADMIN_SYSTEM_PROMPT,
      tools: ADMIN_TOOLS,
      toolSchemas: Object.fromEntries(
        ADMIN_TOOLS.filter((name) => name in ADMIN_TOOL_SCHEMAS).map((name) => [
          name,
          ADMIN_TOOL_SCHEMAS[name],
        ])
      ),
      maxTokens: 4096,
    };
    super(config, deps);
    for (const skill of ADMIN_SKILLS) {
      this.skills.registerSkill(skill);
    }
  }

  // run() is inherited from BaseAgent — it resolves task.input.type against
  // the skills registered above via SkillRegistry/SkillExecutor. No
  // per-agent switch statement anymore; see skills/ for each capability.

  // ─── PUBLIC ENTRY POINTS (thin delegators to skills/) ─────────────
  //
  // These exist for direct/testable callers and backward compatibility —
  // run() (inherited from BaseAgent) reaches the same skills via
  // SkillExecutor for normal task-queue dispatch. The actual logic lives in
  // skills/*.ts.

  async triageEmail(task: AgentTask): Promise<EmailTriageResult> {
    return emailTriageSkill.execute({
      agent: this.asSkillHandle(),
      task,
      input: { maxEmails: (task.input as { maxEmails?: number }).maxEmails },
    });
  }

  async reviewCalendar(task: AgentTask): Promise<CalendarReview> {
    return calendarReviewSkill.execute({
      agent: this.asSkillHandle(),
      task,
      input: { daysAhead: (task.input as { daysAhead?: number }).daysAhead },
    });
  }

  async sendEmail(task: AgentTask): Promise<void> {
    const { to, subject, body, threadId } = task.input as {
      to: string;
      subject: string;
      body: string;
      threadId?: string;
    };
    return sendEmailSkill.execute({
      agent: this.asSkillHandle(),
      task,
      input: { to, subject, body, threadId },
    });
  }

  async scheduleEvent(task: AgentTask): Promise<void> {
    const { summary, start, end, attendees, description } = task.input as {
      summary: string;
      start: string;
      end: string;
      attendees?: string[];
      description?: string;
    };
    return scheduleEventSkill.execute({
      agent: this.asSkillHandle(),
      task,
      input: { summary, start, end, attendees, description },
    });
  }

  async handleFreeform(task: AgentTask): Promise<void> {
    return freeformSkill.execute({
      agent: this.asSkillHandle(),
      task,
      input: task.input as { type?: string; prompt?: string },
    });
  }

  // ─── TOOL-CALLING LOOP HOOKS (used by BaseAgent.runToolLoop) ──────

  protected isReadOnlyTool(toolName: string): boolean {
    return READ_ONLY_ADMIN_TOOLS.has(toolName);
  }

  protected async executeToolCall(
    task: AgentTask,
    call: ProviderToolCall
  ): Promise<{ result: unknown; isError: boolean }> {
    try {
      if (this.isReadOnlyTool(call.name)) {
        return { result: await this.useTool(call.name, call.input), isError: false };
      }

      const action: ProposedAction = {
        id: call.id,
        type: call.name,
        label: describeToolCall(call),
        payload: call.input,
      };
      const approved = await proposeOrAutoApprove(this.asSkillHandle(), task, action);
      if (!approved) {
        return { result: 'User declined this action.', isError: true };
      }
      return { result: await this.useTool(call.name, call.input), isError: false };
    } catch (error) {
      return { result: error instanceof Error ? error.message : String(error), isError: true };
    }
  }
}

// Human-readable approval-prompt labels for model-initiated tool calls in
// the chat loop (triage/calendar-review actions build their own labels
// inline, since they already have richer context than a raw tool call).
function describeToolCall(call: ProviderToolCall): string {
  const input = call.input;
  switch (call.name) {
    case 'gmail_send':
      return `Send email to ${input.to}: "${input.subject}"`;
    case 'gmail_create_draft':
      return `Draft reply${input.subject ? `: "${input.subject}"` : ''}`;
    case 'gmail_label_thread':
      return `Label thread as ${input.labelName}`;
    case 'gmail_unlabel_thread':
      return `Remove label ${input.labelName} from thread`;
    case 'gmail_archive_thread':
      return 'Archive email thread';
    case 'gmail_trash_thread':
      return 'Move email thread to trash';
    case 'gmail_mark_spam':
      return 'Mark email thread as spam';
    case 'calendar_create_event':
      return `Create calendar event: "${input.summary}" on ${input.start}`;
    case 'calendar_update_event':
      return `Update calendar event ${input.eventId}`;
    case 'calendar_delete_event':
      return `Delete calendar event ${input.eventId}`;
    case 'calendar_respond_to_event':
      return `RSVP ${input.response} to calendar event ${input.eventId}`;
    case 'sheets_append':
      return `Append rows to spreadsheet ${input.spreadsheetId}`;
    case 'sheets_update':
      return `Update range ${input.range} in spreadsheet ${input.spreadsheetId}`;
    default:
      return `Run tool "${call.name}"`;
  }
}
