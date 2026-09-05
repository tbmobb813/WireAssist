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

// Models sometimes ignore "return only JSON" and wrap the object in ```json
// fences, or add a sentence of preamble/commentary before or after it —
// stripping fence markers alone leaves that surrounding prose in place and
// JSON.parse rejects the whole thing. Slicing from the first '{' to the
// last '}' discards anything outside the object regardless of why it's
// there, then fence-stripping (still needed for a fence that survives
// inside that range, e.g. "```json\n{...}\n```" with no outer prose) runs
// on what's left.
export function extractJson<T>(raw: string): T {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  const sliced = start !== -1 && end !== -1 && end > start ? raw.slice(start, end + 1) : raw;
  const clean = sliced.replace(/```json|```/g, '').trim();
  return JSON.parse(clean) as T;
}
