import type { ProviderToolDefinition } from '@wireassist/core';

// LLM-facing name/description/input_schema for every tool the Admin Agent
// can be authorized to call. AdminAgent's constructor filters this down to
// whatever's actually in config.tools — being listed here never grants
// authorization on its own (useTool() still checks config.tools).
export const ADMIN_TOOL_SCHEMAS: Record<string, ProviderToolDefinition> = {
  // ── Gmail (read-only) ──────────────────────────────────────────
  gmail_list_threads: {
    name: 'gmail_list_threads',
    description:
      'List email threads from Gmail, optionally filtered by label and/or a search query.',
    inputSchema: {
      type: 'object',
      properties: {
        maxResults: { type: 'number', description: 'Max threads to return, default 20.' },
        labelIds: { type: 'array', items: { type: 'string' }, description: 'e.g. ["INBOX"]' },
        q: { type: 'string', description: 'Gmail search syntax, e.g. "is:unread from:x@y.com".' },
      },
    },
  },
  gmail_search: {
    name: 'gmail_search',
    description:
      'Search email using Gmail search syntax (from:, subject:, after:, is:unread, has:attachment, etc). Prefer this over gmail_list_threads when the user is asking to find something specific.',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Gmail search query.' },
        maxResults: { type: 'number', description: 'Max threads to return, default 20.' },
      },
      required: ['q'],
    },
  },
  gmail_get_thread: {
    name: 'gmail_get_thread',
    description: 'Get the full content (from/subject/body/date) of one email thread by id.',
    inputSchema: {
      type: 'object',
      properties: { threadId: { type: 'string' } },
      required: ['threadId'],
    },
  },
  gmail_list_labels: {
    name: 'gmail_list_labels',
    description: 'List all Gmail labels, including custom ones.',
    inputSchema: { type: 'object', properties: {} },
  },
  gmail_get_profile: {
    name: 'gmail_get_profile',
    description: "Get this account's own email address.",
    inputSchema: { type: 'object', properties: {} },
  },
  gmail_thread_last_message: {
    name: 'gmail_thread_last_message',
    description:
      "Get the sender and date of a thread's most recent message (for staleness checks).",
    inputSchema: {
      type: 'object',
      properties: { threadId: { type: 'string' } },
      required: ['threadId'],
    },
  },
  // ── Gmail (mutating — always approval-gated) ───────────────────
  gmail_create_draft: {
    name: 'gmail_create_draft',
    description: 'Create a draft email reply. Requires human approval before it is created.',
    inputSchema: {
      type: 'object',
      properties: {
        threadId: { type: 'string' },
        to: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['body'],
    },
  },
  gmail_send: {
    name: 'gmail_send',
    description: 'Send an email. Requires human approval before it is sent.',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string' },
        threadId: { type: 'string' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  gmail_label_thread: {
    name: 'gmail_label_thread',
    description: 'Add a label to an email thread (e.g. mark it URGENT or IGNORED).',
    inputSchema: {
      type: 'object',
      properties: {
        threadId: { type: 'string' },
        labelName: { type: 'string' },
      },
      required: ['threadId', 'labelName'],
    },
  },
  gmail_unlabel_thread: {
    name: 'gmail_unlabel_thread',
    description: 'Remove a label from an email thread — e.g. to correct a wrong auto-ignore.',
    inputSchema: {
      type: 'object',
      properties: {
        threadId: { type: 'string' },
        labelName: { type: 'string' },
      },
      required: ['threadId', 'labelName'],
    },
  },
  gmail_archive_thread: {
    name: 'gmail_archive_thread',
    description: 'Archive an email thread (removes it from the inbox). Requires human approval.',
    inputSchema: {
      type: 'object',
      properties: { threadId: { type: 'string' } },
      required: ['threadId'],
    },
  },
  gmail_trash_thread: {
    name: 'gmail_trash_thread',
    description: 'Move an email thread to trash. Requires human approval.',
    inputSchema: {
      type: 'object',
      properties: { threadId: { type: 'string' } },
      required: ['threadId'],
    },
  },
  gmail_mark_spam: {
    name: 'gmail_mark_spam',
    description: 'Mark an email thread as spam. Requires human approval.',
    inputSchema: {
      type: 'object',
      properties: { threadId: { type: 'string' } },
      required: ['threadId'],
    },
  },
  // ── Calendar (read-only) ────────────────────────────────────────
  calendar_list_events: {
    name: 'calendar_list_events',
    description: 'List calendar events in a time range.',
    inputSchema: {
      type: 'object',
      properties: {
        timeMin: { type: 'string', description: 'ISO 8601 start.' },
        timeMax: { type: 'string', description: 'ISO 8601 end.' },
        maxResults: { type: 'number' },
        calendarId: {
          type: 'string',
          description:
            'Defaults to the primary calendar; call calendar_list_calendars to discover others.',
        },
      },
    },
  },
  calendar_list_calendars: {
    name: 'calendar_list_calendars',
    description: 'List all calendars this account has access to (not just the primary one).',
    inputSchema: { type: 'object', properties: {} },
  },
  calendar_find_availability: {
    name: 'calendar_find_availability',
    description:
      'Find open time slots of a given duration within a time window, on the primary calendar.',
    inputSchema: {
      type: 'object',
      properties: {
        timeMin: { type: 'string' },
        timeMax: { type: 'string' },
        durationMinutes: { type: 'number' },
      },
      required: ['timeMin', 'timeMax', 'durationMinutes'],
    },
  },
  // ── Calendar (mutating — always approval-gated) ─────────────────
  calendar_create_event: {
    name: 'calendar_create_event',
    description: 'Create a calendar event, optionally recurring. Requires human approval.',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        start: { type: 'string', description: 'ISO 8601 datetime.' },
        end: { type: 'string', description: 'ISO 8601 datetime.' },
        attendees: { type: 'array', items: { type: 'string' } },
        description: { type: 'string' },
        location: { type: 'string' },
        recurrence: {
          type: 'array',
          items: { type: 'string' },
          description: 'RFC5545 RRULE lines, e.g. ["RRULE:FREQ=WEEKLY;BYDAY=MO"].',
        },
        calendarId: { type: 'string' },
      },
      required: ['summary', 'start', 'end'],
    },
  },
  calendar_update_event: {
    name: 'calendar_update_event',
    description: 'Update an existing calendar event. Requires human approval.',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'string' },
        summary: { type: 'string' },
        start: { type: 'string' },
        end: { type: 'string' },
        calendarId: { type: 'string' },
      },
      required: ['eventId'],
    },
  },
  calendar_delete_event: {
    name: 'calendar_delete_event',
    description: 'Delete a calendar event. Requires human approval.',
    inputSchema: {
      type: 'object',
      properties: { eventId: { type: 'string' }, calendarId: { type: 'string' } },
      required: ['eventId'],
    },
  },
  calendar_respond_to_event: {
    name: 'calendar_respond_to_event',
    description:
      'RSVP to a calendar invite (accept/decline/tentative). Notifies the organizer — requires human approval.',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'string' },
        response: { type: 'string', enum: ['accepted', 'declined', 'tentative'] },
        calendarId: { type: 'string' },
      },
      required: ['eventId', 'response'],
    },
  },
  // ── Sheets ────────────────────────────────────────────────────
  sheets_read: {
    name: 'sheets_read',
    description: 'Read a range of cells from a Google Sheet.',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: { type: 'string' },
        range: { type: 'string', description: 'A1 notation, e.g. "Sheet1!A1:C10".' },
      },
      required: ['spreadsheetId', 'range'],
    },
  },
  sheets_append: {
    name: 'sheets_append',
    description: 'Append rows to a Google Sheet. Requires human approval.',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: { type: 'string' },
        range: { type: 'string' },
        values: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
      },
      required: ['spreadsheetId', 'range', 'values'],
    },
  },
  sheets_update: {
    name: 'sheets_update',
    description: 'Overwrite a range of cells in a Google Sheet. Requires human approval.',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: { type: 'string' },
        range: { type: 'string' },
        values: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
      },
      required: ['spreadsheetId', 'range', 'values'],
    },
  },
  // ── Skills, exposed as composable tools (dispatched via invokeSkill(),
  // not useTool() — see AdminAgent.executeToolCall()). These run genuine
  // multi-step work internally (list -> analyze -> categorize -> propose)
  // and self-gate any mutation with their own proposeAction() calls, so
  // they execute immediately at this outer level rather than being
  // approval-gated a second time. Named with a `_skill` suffix to stay
  // visually distinct from raw MCP tool names above.
  email_triage_skill: {
    name: 'email_triage_skill',
    description:
      'Run the full email triage skill: fetch unread inbox threads, categorize them (urgent/reply-needed/fyi/ignore), draft replies, and propose actions for approval. Use this instead of gmail_list_threads when the user wants their inbox triaged, not just listed.',
    inputSchema: {
      type: 'object',
      properties: {
        maxEmails: { type: 'number', description: 'Max unread threads to triage, default 20.' },
      },
    },
  },
  calendar_review_skill: {
    name: 'calendar_review_skill',
    description:
      'Run the full calendar review skill: list upcoming events and identify conflicts, overloaded days, and missing prep time, proposing any suggested changes for approval. Use this instead of calendar_list_events when the user wants their calendar reviewed, not just listed.',
    inputSchema: {
      type: 'object',
      properties: {
        daysAhead: { type: 'number', description: 'How many days ahead to review, default 7.' },
      },
    },
  },
  // ── Delegation (dispatched via a bespoke branch in
  // AdminAgent.executeToolCall() — builds a task + emits
  // agent:handoff_requested, never useTool()/MCP or invokeSkill()) ──
  delegate_to_agent: {
    name: 'delegate_to_agent',
    description:
      "Hand this request off to another WireAssist agent to actually produce the deliverable — a real post (Content), web research (Research), a business workflow run (NixOps), a go-to-market strategy (GTM), or GitHub repo work (GitHub Dev) — instead of just describing what could be done. Use this whenever fulfilling the request well needs that agent's own tools/skills. Requires human approval before the other agent starts. The target agent won't see this conversation, so give it a self-contained prompt.",
    inputSchema: {
      type: 'object',
      properties: {
        targetRole: {
          type: 'string',
          enum: ['content', 'research', 'strategy', 'gtm', 'github'],
          description: 'Which agent to hand off to.',
        },
        prompt: { type: 'string', description: 'Self-contained instruction for the target agent.' },
      },
      required: ['targetRole', 'prompt'],
    },
  },
};

// Skill-tool names dispatched via invokeSkill() rather than useTool() — see
// AdminAgent.executeToolCall(). Kept separate from READ_ONLY_ADMIN_TOOLS
// since these are never valid useTool()/MCP calls.
export const ADMIN_SKILL_TOOLS = new Set<string>(['email_triage_skill', 'calendar_review_skill']);

// Delegation tool — kept separate from both ADMIN_SKILL_TOOLS and
// READ_ONLY_ADMIN_TOOLS since it's dispatched through neither useTool()/MCP
// nor invokeSkill(); see AdminAgent.executeToolCall().
export const ADMIN_DELEGATION_TOOLS = new Set<string>(['delegate_to_agent']);

// Tool names that only ever read data — safe to execute immediately in the
// chat tool loop without going through the approval queue. Everything else
// in ADMIN_TOOL_SCHEMAS is mutating and must be proposed for approval first.
export const READ_ONLY_ADMIN_TOOLS = new Set<string>([
  'gmail_list_threads',
  'gmail_search',
  'gmail_get_thread',
  'gmail_list_labels',
  'gmail_get_profile',
  'gmail_thread_last_message',
  'calendar_list_events',
  'calendar_list_calendars',
  'calendar_find_availability',
  'sheets_read',
]);
