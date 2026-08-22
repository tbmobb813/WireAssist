// Shared types for the Admin Agent's skills and its public API. Split out
// of admin-agent.ts so skill modules (packages/agents/admin/src/skills/*)
// can depend on these without importing the AdminAgent class itself.

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

export interface TriageCategories {
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

export interface CalendarReview {
  conflicts: { event1: string; event2: string; overlap: string }[];
  overloadedDays: { date: string; eventCount: number; recommendation: string }[];
  suggestions: { type: string; description: string; action: string }[];
  summary: string;
}

// Models sometimes wrap JSON in ```json fences despite being told not to —
// strip them before parsing rather than failing the whole task.
export function extractJson<T>(raw: string): T {
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean) as T;
}
