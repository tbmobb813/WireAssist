import { randomUUID } from 'crypto';
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
  isAutoApproveEligibleType,
  isEligibleForAutoApproval,
  recordDecision,
} from './auto-approve-policy';

// Models sometimes wrap JSON in ```json fences despite being told not to —
// strip them before parsing rather than failing the whole task.
function extractJson<T>(raw: string): T {
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean) as T;
}

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
  }

  // Main entry point — route task to the right handler
  async run(task: AgentTask): Promise<void> {
    this.status = 'running';
    this.events.emit('agent:task_started', {
      agentRole: this.role,
      taskId: task.id,
      description: task.description,
    });

    try {
      switch (task.input.type) {
        case 'email_triage':
          await this.triageEmail(task);
          break;
        case 'calendar_review':
          await this.reviewCalendar(task);
          break;
        case 'send_email':
          await this.sendEmail(task);
          break;
        case 'schedule_event':
          await this.scheduleEvent(task);
          break;
        default:
          await this.handleFreeform(task);
      }

      this.status = 'idle';
      this.events.emit('agent:task_complete', {
        agentRole: this.role,
        taskId: task.id,
      });
    } catch (error) {
      this.status = 'error';
      this.events.emit('agent:task_failed', {
        agentRole: this.role,
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // ─── EMAIL TRIAGE ──────────────────────────────────────────────

  async triageEmail(task: AgentTask): Promise<EmailTriageResult> {
    // 1. Fetch inbox threads
    const threads = (await this.useTool('gmail_list_threads', {
      maxResults: (task.input as { maxEmails?: number }).maxEmails ?? 20,
      labelIds: ['INBOX'],
      q: 'is:unread',
    })) as GmailThread[];

    if (!threads || threads.length === 0) {
      const result: EmailTriageResult = {
        taskId: task.id,
        totalEmails: 0,
        categories: { urgent: [], replyNeeded: [], fyi: [], ignore: [] },
        proposedActions: [],
        summary: 'Inbox is empty or no unread messages.',
      };
      this.events.emit('agent:triage_complete', result);
      return result;
    }

    // 2. Fetch thread details in parallel (cap at 10 to avoid token bloat)
    const threadDetails = await Promise.all(
      threads
        .slice(0, 10)
        .map(
          (t) => this.useTool('gmail_get_thread', { threadId: t.id }) as Promise<GmailThreadDetail>
        )
    );

    // 3. Load memory context — who we know, past decisions
    const context = await this.loadContext('email contacts preferences ignore rules');

    // 4. Ask Claude to triage
    const triagePrompt = `
Triage these ${threadDetails.length} email threads. 

THREADS:
${threadDetails
  .map(
    (t, i) => `
ThreadId: ${t.id}
[${i + 1}] From: ${t.from}
Subject: ${t.subject}
Snippet: ${t.snippet}
Date: ${t.date}
`
  )
  .join('\n')}

Return a JSON object with this exact structure:
{
  "categories": {
    "urgent": [{ "threadId": string, "from": string, "subject": string, "reason": string }],
    "replyNeeded": [{ "threadId": string, "from": string, "subject": string, "draftReply": string }],
    "fyi": [{ "threadId": string, "from": string, "subject": string }],
    "ignore": [{ "threadId": string, "from": string, "reason": string }]
  },
  "summary": "2-3 sentence overview of inbox state",
  "urgentCount": number,
  "replyNeededCount": number
}

For "urgent", the "reason" must state the specific cost of inaction (what breaks, by when) —
not a generic "this seems important." For "ignore", the "reason" must say why it's safe to
skip, even when it's an obvious newsletter/receipt — Jason should be able to verify the ignore
pile by skimming reasons, not by re-reading every email himself.

Only return valid JSON. No markdown fences.`;

    const rawResponse = await this.think(triagePrompt, context);

    let triage: TriageCategories;
    try {
      triage = extractJson<TriageCategories>(rawResponse);
    } catch {
      throw new Error(
        `Admin Agent returned invalid JSON during triage: ${rawResponse.slice(0, 200)}`
      );
    }

    // 5. Build proposed actions
    const proposedActions: ProposedAction[] = [];
    const validThreadIds = new Set(threadDetails.map((thread) => thread.id));

    // Propose drafts for reply-needed emails
    for (const email of triage.categories.replyNeeded ?? []) {
      if (!validThreadIds.has(email.threadId)) continue;
      proposedActions.push({
        id: randomUUID(),
        type: 'gmail_create_draft',
        label: `Draft reply to: "${email.subject}" from ${email.from}`,
        payload: {
          threadId: email.threadId,
          body: email.draftReply,
        },
      });
    }

    // Propose labeling urgent emails
    for (const email of triage.categories.urgent ?? []) {
      if (!validThreadIds.has(email.threadId)) continue;
      proposedActions.push({
        id: randomUUID(),
        type: 'gmail_label_thread',
        label: `Mark as URGENT: "${email.subject}"`,
        payload: {
          threadId: email.threadId,
          labelName: 'URGENT',
        },
      });
    }

    // Propose ignore-labeling for the ignore category — this is what makes
    // the ignore pile actionable (and auto-approvable, see
    // proposeOrAutoApprove) rather than just reported.
    for (const email of triage.categories.ignore ?? []) {
      if (!validThreadIds.has(email.threadId)) continue;
      proposedActions.push({
        id: randomUUID(),
        type: 'gmail_label_thread',
        label: `Ignore: "${email.reason}"`,
        payload: {
          threadId: email.threadId,
          labelName: 'IGNORED',
          from: email.from,
        },
      });
    }

    const result: EmailTriageResult = {
      taskId: task.id,
      totalEmails: threadDetails.length,
      categories: triage.categories,
      proposedActions,
      summary: triage.summary,
    };

    // 6. Emit the result — Command Center UI picks this up and renders it
    this.events.emit('agent:triage_complete', result);

    // 7. For each proposed action, request approval (or auto-approve, for
    // the narrow ignore-labeling carve-out) individually.
    for (const action of proposedActions) {
      const approved = await this.proposeOrAutoApprove(task, action);
      if (approved) {
        await this.useTool(action.type, action.payload);
      }
    }

    return result;
  }

  // ─── CALENDAR REVIEW ───────────────────────────────────────────

  async reviewCalendar(task: AgentTask): Promise<void> {
    const { daysAhead = 7 } = task.input as { daysAhead?: number };

    const now = new Date();
    const until = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const events = (await this.useTool('calendar_list_events', {
      timeMin: now.toISOString(),
      timeMax: until.toISOString(),
      maxResults: 50,
    })) as CalendarEvent[];

    const context = await this.loadContext('calendar preferences meeting preferences work hours');

    const reviewPrompt = `
Review my calendar for the next ${daysAhead} days and identify:
1. Real scheduling conflicts (double-booked events)
2. Overloaded days — 5+ hours of meetings in one day, or 3+ meetings with no buffer between any
   of them
3. Missing prep/buffer time before anything that needs it
4. Any events that look like they could be async instead

EVENTS:
${events.map((e) => `- ${e.summary} | ${e.start} → ${e.end} | ${e.attendees?.length ?? 0} attendees`).join('\n')}

Return a JSON object:
{
  "conflicts": [{ "event1": string, "event2": string, "overlap": string }],
  "overloadedDays": [{ "date": string, "eventCount": number, "recommendation": string }],
  "suggestions": [{ "type": string, "description": string, "action": string }],
  "summary": string
}

Each "recommendation" and "suggestion.description" must name the specific event and where it
should move — not generic "consider taking more breaks" advice.

Only return valid JSON. No markdown fences.`;

    const rawResponse = await this.think(reviewPrompt, context);

    let review: CalendarReview;
    try {
      review = extractJson<CalendarReview>(rawResponse);
    } catch {
      throw new Error('Admin Agent returned invalid JSON during calendar review');
    }

    this.events.emit('agent:calendar_review_complete', {
      taskId: task.id,
      events,
      review,
    });

    // Propose and await approval for any suggested changes
    for (const suggestion of review.suggestions ?? []) {
      if (suggestion.type === 'reschedule' || suggestion.type === 'cancel') {
        const approved = await this.proposeAction(task, suggestion.description, {
          action: suggestion.action,
        });
        if (approved) {
          this.remember(`Calendar: ${suggestion.description} — approved`, ['calendar', 'approved']);
        }
      }
    }
  }

  // ─── SEND EMAIL ────────────────────────────────────────────────

  async sendEmail(task: AgentTask): Promise<void> {
    const { to, subject, body, threadId } = task.input as {
      to: string;
      subject: string;
      body: string;
      threadId?: string;
    };

    // Always require approval before sending
    const approved = await this.proposeAction(task, `Send email to ${to}: "${subject}"`, {
      to,
      subject,
      body,
      threadId,
    });

    if (!approved) return;

    await this.useTool('gmail_send', { to, subject, body, threadId });
    this.remember(`Sent email to ${to}: ${subject}`, ['email', 'sent']);
  }

  // ─── SCHEDULE EVENT ────────────────────────────────────────────

  async scheduleEvent(task: AgentTask): Promise<void> {
    const { summary, start, end, attendees, description } = task.input as {
      summary: string;
      start: string;
      end: string;
      attendees?: string[];
      description?: string;
    };

    const approved = await this.proposeAction(
      task,
      `Create calendar event: "${summary}" on ${start}`,
      { summary, start, end, attendees, description }
    );

    if (!approved) return;

    await this.useTool('calendar_create_event', {
      summary,
      start,
      end,
      attendees,
      description,
    });

    this.remember(`Scheduled: ${summary} on ${start}`, ['calendar', 'scheduled']);
  }

  // ─── FREEFORM / CHAT ─────────────────────────────────────────────

  async handleFreeform(task: AgentTask): Promise<void> {
    const input = task.input as { type: string; prompt?: string };
    const prompt =
      input.type === 'freeform' && typeof input.prompt === 'string'
        ? input.prompt
        : task.description;
    const context = await this.loadContext(prompt);
    const response = await this.runToolLoop(task, prompt, { extraContext: context });

    this.events.emit('agent:freeform_response', {
      taskId: task.id,
      response,
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
      const approved = await this.proposeOrAutoApprove(task, action);
      if (!approved) {
        return { result: 'User declined this action.', isError: true };
      }
      return { result: await this.useTool(call.name, call.input), isError: false };
    } catch (error) {
      return { result: error instanceof Error ? error.message : String(error), isError: true };
    }
  }

  // ─── APPROVAL GATE (with narrow auto-approval carve-out) ──────────

  // Wraps proposeAction() with the auto-approval policy from
  // auto-approve-policy.ts. Eligibility is hardcoded there (only
  // ignore-labeling a thread, keyed by sender) — everything else always
  // goes through the normal human approval gate.
  private async proposeOrAutoApprove(task: AgentTask, action: ProposedAction): Promise<boolean> {
    const from = typeof action.payload.from === 'string' ? action.payload.from : undefined;

    if (from && isAutoApproveEligibleType(action) && isEligibleForAutoApproval(from)) {
      this.remember(`Auto-approved: ${action.label}`, ['email', 'auto-approval', action.type]);
      this.events.emit('agent:auto_approved', { agentRole: this.role, taskId: task.id, action });
      return true;
    }

    const approved = await this.proposeAction(task, action.label, action.payload);
    if (from && isAutoApproveEligibleType(action)) {
      recordDecision(from, approved);
    }
    this.remember(approved ? `User approved: ${action.label}` : `User rejected: ${action.label}`, [
      'email',
      approved ? 'approval' : 'rejection',
      action.type,
    ]);
    return approved;
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

// ─── TYPES ─────────────────────────────────────────────────────────────────

export interface GmailThread {
  id: string;
  snippet: string;
}

export interface GmailThreadDetail {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  body?: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  attendees?: { email: string }[];
}

export interface ProposedAction {
  id: string;
  // Exact MCP tool name — execution is a direct useTool(type, payload) call,
  // so this must always match a name registered in mcp-setup.ts.
  type: string;
  label: string;
  payload: Record<string, unknown>;
}

export interface EmailTriageResult {
  taskId: string;
  totalEmails: number;
  categories: TriageCategories['categories'];
  proposedActions: ProposedAction[];
  summary: string;
}

interface TriageCategories {
  categories: {
    urgent: { threadId: string; from: string; subject: string; reason: string }[];
    replyNeeded: { threadId: string; from: string; subject: string; draftReply: string }[];
    fyi: { threadId: string; from: string; subject: string }[];
    ignore: { threadId: string; from: string; reason: string }[];
  };
  summary: string;
  urgentCount: number;
  replyNeededCount: number;
}

interface CalendarReview {
  conflicts: { event1: string; event2: string; overlap: string }[];
  overloadedDays: { date: string; eventCount: number; recommendation: string }[];
  suggestions: { type: string; description: string; action: string }[];
  summary: string;
}
