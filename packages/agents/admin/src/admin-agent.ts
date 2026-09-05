import {
  type AgentConfig,
  type AgentTask,
  type DocumentAttachment,
  type IApprovalQueue,
  type ImageAttachment,
  type MemoryStore,
  type MCPClient,
  type EventBus,
  type ProviderMessage,
  type ProviderToolCall,
} from '@wireassist/core';
import { BaseAgent } from './base-agent';
import { ADMIN_TOOL_SCHEMAS, READ_ONLY_ADMIN_TOOLS, ADMIN_SKILL_TOOLS } from './tool-schemas';
import { buildDelegateToolSchema, DELEGATE_TOOL_NAME } from './delegate';
import {
  type ChatDispatch,
  type ChatDispatchResult,
  type DispatchCtx,
  DISPATCH_TOOL_NAMES,
  buildChatDispatchToolSchemas,
} from './chat-dispatch';
import type { Platform } from '@wireassist/trendpost-mcp';
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

CALENDAR TRIGGER: only call calendar_review_skill when the request is actually about calendar
events/meetings — not whenever words like "schedule," "organized," or "a lot going on" show up in
a broader business request. "I want to get my business running smoothly and on a schedule" is
about business operations cadence, not a literal request to review calendar events. Calling a
data-pulling tool against data the user never asked about (and getting back "no events found," a
dead end) is worse than just asking what they actually mean — confirmed as a real live complaint
(2026-09-05): a vague "get things running smoothly" business-planning request triggered an
unrelated calendar review that came back empty and added a confusing detour before the real
conversation could start.

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
Use plain English for explanations and recommendations.

DELEGATION:
Every chat message reaches you first — you're the front door, not a fallback. If fulfilling this
well needs another agent's actual work, you have two different mechanisms and they are NOT
interchangeable:
- For a specific, well-defined action with an obvious target — write this one post, research this
  one thing, run this named ops workflow, ask something about a real GitHub repo/PR — call the
  matching dispatch_* tool (dispatch_content_post, dispatch_content_plan,
  dispatch_content_freeform, dispatch_research_topic, dispatch_research_freeform,
  dispatch_ops_workflow, dispatch_ops_freeform, dispatch_gtm_freeform, dispatch_github_freeform,
  redirect_to_gtm_wizard). These start immediately with no approval step — use them for the
  routine, low-ambiguity case, the same way you'd just say "on it" to a request that's already
  clear.
- For something genuinely open-ended, high-stakes, or where you're not confident a dispatch tool
  cleanly covers it, use delegate_to_agent instead — it requires human approval before the target
  agent starts, which is the right amount of friction when the request itself is ambiguous enough
  to need a second look before committing another agent's work to it.
Give the target agent a self-contained prompt either way; they won't see this conversation. Never
delegate or dispatch something you can already do yourself with your own tools (email, calendar,
sheets).

ACCOUNT AMBIGUITY: dispatch_content_post/dispatch_content_plan/dispatch_content_campaign require
an account (which specific brand this content is for — e.g. "techtrendwire", "mindtype_studio",
"nixlevel"). More than one brand can have an account on the same platform, so "instagram" alone
never tells you which one. If the user's request doesn't make the account obvious, ASK rather
than guessing or defaulting to whichever venture comes to mind first — a wrong guess here means
content generated for the wrong brand's voice/audience.

SELF-IMPROVEMENT:
If Jason is asking you to build yourself a new capability — "draft a skill that...", "can you
make yourself able to...", anything where the point is growing what you can do, not just doing
one thing with what you already have — call propose_skill_skill instead of hand-writing
pseudocode or prose describing the idea. Do not answer in plain text and do not invent
limitations you haven't actually checked: your real tool surface for a skill's execute() is
exactly think, useTool, loadContext, remember, proposeAction, emit, runToolLoop, listDecisions,
and listPending — remember() already writes to memory and listPending() already lists pending
approvals, so don't claim either is missing before calling the tool and letting the drafting
prompt work from the real interface.`;

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
  // Drive
  'drive_create_file',
  'drive_update_file',
  'drive_read_file',
  'drive_search_files',
];

export class AdminAgent extends BaseAgent {
  private chatDispatch: ChatDispatch;

  constructor(deps: {
    approval: IApprovalQueue;
    memory: MemoryStore;
    mcp: MCPClient;
    events: EventBus;
    chatDispatch: ChatDispatch;
  }) {
    const config: AgentConfig = {
      role: 'admin',
      name: 'Admin Agent',
      systemPrompt: ADMIN_SYSTEM_PROMPT,
      tools: ADMIN_TOOLS,
      // Skill-tools (email_triage_skill, calendar_review_skill) are added
      // to the model-facing schema list here but deliberately NOT to
      // `tools` above — they're dispatched via invokeSkill(), never
      // useTool()/MCP, so they have no business in the MCP authorization
      // list. Chat-dispatch tools (dispatch_content_post, etc.) are the
      // same story — dispatched via executeChatDispatch(), never useTool().
      toolSchemas: {
        ...Object.fromEntries(
          [...ADMIN_TOOLS, ...ADMIN_SKILL_TOOLS]
            .filter((name) => name in ADMIN_TOOL_SCHEMAS)
            .map((name) => [name, ADMIN_TOOL_SCHEMAS[name]])
        ),
        [DELEGATE_TOOL_NAME]: buildDelegateToolSchema('admin'),
        ...buildChatDispatchToolSchemas(),
      },
      maxTokens: 4096,
    };
    super(config, deps);
    this.chatDispatch = deps.chatDispatch;
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
      if (call.name === DELEGATE_TOOL_NAME) {
        return this.executeDelegateToAgent(task, call);
      }

      if (DISPATCH_TOOL_NAMES.has(call.name)) {
        // Must await (not just return the promise) — the surrounding
        // try/catch only catches a rejection that happens while it's still
        // on the stack; returning an unawaited promise here would let a
        // rejected chatDispatch call (e.g. GitHub not configured) escape
        // as an unhandled rejection instead of the { isError: true } shape
        // every other branch in this method returns.
        return await this.executeChatDispatch(task, call);
      }

      if (ADMIN_SKILL_TOOLS.has(call.name)) {
        // Skill-tools self-gate their own mutations via internal
        // proposeAction() calls (email_triage/calendar_review both do) —
        // dispatch immediately rather than approval-gating a second time.
        const skillName = call.name.replace(/_skill$/, '');
        return { result: await this.invokeSkill(task, skillName, call.input), isError: false };
      }

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

  // Builds the shared context every dispatch method needs from the
  // ORIGINATING chat task — history/images/documents already live in
  // task.input for a freeform task (see createFreeformTask, task-factory.ts),
  // objectiveId is a top-level AgentTask field.
  private dispatchCtx(task: AgentTask): DispatchCtx {
    const input = task.input as {
      history?: ProviderMessage[];
      images?: ImageAttachment[];
      documents?: DocumentAttachment[];
    };
    return {
      history: input.history,
      objectiveId: task.objectiveId,
      images: input.images,
      documents: input.documents,
    };
  }

  // Dispatch tools (see chat-dispatch.ts) — the zero-approval counterpart
  // to executeDelegateToAgent(). Each one queues a real, structured task on
  // the target agent immediately (matching the zero-friction behavior the
  // old chat-router.ts classifier gave these same requests) and emits an
  // event telling the chat UI to redirect its polling to the new task's id
  // — without that, the chat window would show "Handing off..." and then
  // never display the real result, same gap the handoff_queued case already
  // has for delegate_to_agent.
  private async executeChatDispatch(
    task: AgentTask,
    call: ProviderToolCall
  ): Promise<{ result: unknown; isError: boolean }> {
    const ctx = this.dispatchCtx(task);
    const input = call.input as Record<string, unknown>;

    if (call.name === 'redirect_to_gtm_wizard') {
      const { redirect, message } = this.chatDispatch.redirectToGtmWizard();
      this.events.emit('agent:gtm_redirect_requested', { taskId: task.id, redirect, message });
      return { result: message, isError: false };
    }

    const dispatchers: Record<string, () => Promise<ChatDispatchResult>> = {
      dispatch_content_post: () =>
        this.chatDispatch.contentPost(
          input as { topic: string; platform: Platform; account?: string; tone?: string },
          ctx
        ),
      dispatch_content_plan: () =>
        this.chatDispatch.contentPlan(
          input as {
            platforms?: Platform[];
            account?: string;
            weeksAhead?: number;
            postsPerWeek?: number;
          },
          ctx
        ),
      dispatch_content_campaign: () =>
        this.chatDispatch.contentCampaign(
          input as {
            platforms?: Platform[];
            account?: string;
            weeksAhead?: number;
            postsPerWeek?: number;
          },
          ctx
        ),
      dispatch_content_freeform: () =>
        this.chatDispatch.contentFreeform(input as { prompt: string }, ctx),
      dispatch_research_topic: () =>
        this.chatDispatch.researchTopic(
          input as { query: string; depth?: 'quick' | 'deep'; offerOpsWorkflow?: string },
          ctx
        ),
      dispatch_research_freeform: () =>
        this.chatDispatch.researchFreeform(input as { prompt: string }, ctx),
      dispatch_ops_workflow: () =>
        this.chatDispatch.opsWorkflow(input as { workflow: string; brief: string }, ctx),
      dispatch_ops_freeform: () => this.chatDispatch.opsFreeform(input as { prompt: string }, ctx),
      dispatch_gtm_freeform: () => this.chatDispatch.gtmFreeform(input as { prompt: string }, ctx),
      dispatch_github_freeform: () =>
        this.chatDispatch.githubFreeform(input as { prompt: string }, ctx),
    };

    const dispatcher = dispatchers[call.name];
    if (!dispatcher) {
      return { result: `Unknown dispatch tool "${call.name}".`, isError: true };
    }

    const result = await dispatcher();
    this.events.emit('agent:chat_dispatch_queued', {
      taskId: task.id,
      dispatchedTaskId: result.taskId,
      agentRole: result.agentRole,
    });
    return { result: result.summary, isError: false };
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
    case 'drive_create_file':
      return `Create Google Doc: "${input.title}"`;
    case 'drive_update_file':
      return `Overwrite Drive file ${input.fileId}`;
    case 'email_triage_skill':
      return 'Triage inbox';
    case 'calendar_review_skill':
      return 'Review calendar';
    default:
      return `Run tool "${call.name}"`;
  }
}
