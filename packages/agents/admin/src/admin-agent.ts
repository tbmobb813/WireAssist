import { randomUUID } from 'crypto';
import {
  type AgentConfig,
  type AgentTask,
  type IApprovalQueue,
  type MemoryStore,
  type MCPClient,
  type EventBus,
} from '@synqworks/core';
import { BaseAgent } from './base-agent';

const ADMIN_SYSTEM_PROMPT = `You are the Admin Agent for SynqWorks — an AI executive assistant 
for a solo business operator. Your job is to manage email, calendar, and tasks with precision.

PRINCIPLES:
- You NEVER send emails, create events, or take actions without explicit human approval.
- You summarize clearly and recommend specific actions.
- You are direct and concise — no fluff, no filler.
- You learn from every interaction to improve future recommendations.
- You flag anything urgent or time-sensitive immediately.

EMAIL TRIAGE APPROACH:
1. Read all emails and categorize: urgent / reply-needed / FYI / promotional / ignore
2. For each reply-needed email, draft a proposed response
3. Present the full triage report with proposed actions
4. Wait for approval before taking any action

CALENDAR APPROACH:
1. List upcoming events for the requested period
2. Flag conflicts, overloads, and missing buffer time
3. Suggest optimizations
4. Propose any changes and wait for approval

OUTPUT FORMAT:
Always respond in structured JSON when processing emails or calendar data.
Use plain English for explanations and recommendations.`;

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
      tools: [
        // Gmail tools
        'gmail_list_threads',
        'gmail_get_thread',
        'gmail_create_draft',
        'gmail_send',
        'gmail_label_thread',
        // Calendar tools will be registered in MCP setup, but we declare them here for clarity
        'calendar_list_events',
        'calendar_create_event',
        'calendar_update_event',
        'calendar_delete_event',
        'calendar_find_availability',
      ],
      model: 'claude-sonnet-4-20250514',
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
    const threads = await this.useTool('gmail_list_threads', {
      maxResults: (task.input as { maxEmails?: number }).maxEmails ?? 20,
      labelIds: ['INBOX'],
      q: 'is:unread',
    }) as GmailThread[];

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
      threads.slice(0, 10).map(t =>
        this.useTool('gmail_get_thread', { threadId: t.id }) as Promise<GmailThreadDetail>
      )
    );

    // 3. Load memory context — who we know, past decisions
    const context = await this.loadContext('email contacts preferences ignore rules');

    // 4. Ask Claude to triage
    const triagePrompt = `
Triage these ${threadDetails.length} email threads. 

THREADS:
${threadDetails.map((t, i) => `
ThreadId: ${t.id}
[${i + 1}] From: ${t.from}
Subject: ${t.subject}
Snippet: ${t.snippet}
Date: ${t.date}
`).join('\n')}

Return a JSON object with this exact structure:
{
  "categories": {
    "urgent": [{ "threadId": string, "from": string, "subject": string, "reason": string }],
    "replyNeeded": [{ "threadId": string, "from": string, "subject": string, "draftReply": string }],
    "fyi": [{ "threadId": string, "from": string, "subject": string }],
    "ignore": [{ "threadId": string, "reason": string }]
  },
  "summary": "2-3 sentence overview of inbox state",
  "urgentCount": number,
  "replyNeededCount": number
}

Only return valid JSON. No markdown fences.`;

    const rawResponse = await this.think(triagePrompt, context);

    let triage: TriageCategories;
    try {
      triage = JSON.parse(rawResponse) as TriageCategories;
    } catch {
      throw new Error(`Admin Agent returned invalid JSON during triage: ${rawResponse.slice(0, 200)}`);
    }

    // 5. Build proposed actions
    const proposedActions: ProposedAction[] = [];
    const validThreadIds = new Set(threadDetails.map((thread) => thread.id));

    // Propose drafts for reply-needed emails
    for (const email of triage.categories.replyNeeded ?? []) {
      if (!validThreadIds.has(email.threadId)) continue;
      proposedActions.push({
        id: randomUUID(),
        type: 'create_draft',
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
        type: 'label_thread',
        label: `Mark as URGENT: "${email.subject}"`,
        payload: {
          threadId: email.threadId,
          labelName: 'URGENT',
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

    // 7. For each proposed action, request approval individually
    for (const action of proposedActions) {
      const approved = await this.proposeAction(task, action.label, action.payload);

      if (approved) {
        await this.executeAction(action);
        // Remember the decision
        this.remember(
          `User approved: ${action.label}`,
          ['email', 'approval', action.type]
        );
      } else {
        this.remember(
          `User rejected: ${action.label}`,
          ['email', 'rejection', action.type]
        );
      }
    }

    return result;
  }

  // ─── CALENDAR REVIEW ───────────────────────────────────────────

  async reviewCalendar(task: AgentTask): Promise<void> {
    const { daysAhead = 7 } = task.input as { daysAhead?: number };

    const now = new Date();
    const until = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const events = await this.useTool('calendar_list_events', {
      timeMin: now.toISOString(),
      timeMax: until.toISOString(),
      maxResults: 50,
    }) as CalendarEvent[];

    const context = await this.loadContext('calendar preferences meeting preferences work hours');

    const reviewPrompt = `
Review my calendar for the next ${daysAhead} days and identify:
1. Scheduling conflicts
2. Days that are overloaded (back-to-back meetings with no breaks)
3. Missing buffer time between events
4. Any events that look like they could be async instead

EVENTS:
${events.map(e => `- ${e.summary} | ${e.start} → ${e.end} | ${e.attendees?.length ?? 0} attendees`).join('\n')}

Return a JSON object:
{
  "conflicts": [{ "event1": string, "event2": string, "overlap": string }],
  "overloadedDays": [{ "date": string, "eventCount": number, "recommendation": string }],
  "suggestions": [{ "type": string, "description": string, "action": string }],
  "summary": string
}

Only return valid JSON. No markdown fences.`;

    const rawResponse = await this.think(reviewPrompt, context);

    let review: CalendarReview;
    try {
      review = JSON.parse(rawResponse) as CalendarReview;
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
        const approved = await this.proposeAction(
          task,
          suggestion.description,
          { action: suggestion.action }
        );
        if (approved) {
          this.remember(
            `Calendar: ${suggestion.description} — approved`,
            ['calendar', 'approved']
          );
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
    const approved = await this.proposeAction(
      task,
      `Send email to ${to}: "${subject}"`,
      { to, subject, body, threadId }
    );

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

    this.remember(
      `Scheduled: ${summary} on ${start}`,
      ['calendar', 'scheduled']
    );
  }

  // ─── FREEFORM ──────────────────────────────────────────────────

  async handleFreeform(task: AgentTask): Promise<void> {
    const input = task.input as { type: string; prompt?: string };
    const prompt =
      input.type === 'freeform' && typeof input.prompt === 'string'
        ? input.prompt
        : task.description;
    const context = await this.loadContext(prompt);
    const response = await this.think(prompt, context);

    this.events.emit('agent:freeform_response', {
      taskId: task.id,
      response,
    });
  }

  // ─── ACTION EXECUTOR ───────────────────────────────────────────

  private async executeAction(action: ProposedAction): Promise<void> {
    switch (action.type) {
      case 'create_draft':
        await this.useTool('gmail_create_draft', action.payload);
        break;
      case 'label_thread':
        await this.useTool('gmail_label_thread', action.payload);
        break;
      case 'gmail_send':
        await this.useTool('gmail_send', action.payload);
        break;
      case 'calendar_create_event':
        await this.useTool('calendar_create_event', action.payload);
        break;
      case 'calendar_update_event':
        await this.useTool('calendar_update_event', action.payload);
        break;
      case 'calendar_delete_event':
        await this.useTool('calendar_delete_event', action.payload);
        break;
    }
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
  type:
    | 'create_draft'
    | 'label_thread'
    | 'gmail_send'
    | 'calendar_create_event'
    | 'calendar_update_event'
    | 'calendar_delete_event';
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
    ignore: { threadId: string; reason: string }[];
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
