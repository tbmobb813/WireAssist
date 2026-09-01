// Pulled out of server.ts as a pure function, mirroring route-handoff.ts and
// replay-handoffs.ts — testable without bootstrapping the full server.
//
// Pilot for the delegate -> check -> redirect loop (Research -> Content
// first; see review-handoff-output.ts). One retry with feedback, then
// escalate — the policy chosen when this was designed. MAX_REVIEW_ATTEMPTS
// is the attempt number a failing review is still allowed to retry at
// (attempt starts at 0 on the first draft, 1 after one retry).
const MAX_REVIEW_ATTEMPTS = 1;

export interface HandoffReviewCompletePayload {
  contentTaskId: string;
  passed: boolean;
  reason: string;
  attempt: number;
  originalQuery: string;
  researchSummary: string;
  requestedPlatform: string;
  requestedTone?: string;
  producedContent: string;
}

export type HandoffReviewAction =
  | { kind: 'pass' }
  | { kind: 'retry'; feedback: string }
  | { kind: 'escalate' };

export function decideHandoffReviewAction(p: HandoffReviewCompletePayload): HandoffReviewAction {
  if (p.passed) return { kind: 'pass' };
  if (p.attempt >= MAX_REVIEW_ATTEMPTS) return { kind: 'escalate' };
  return { kind: 'retry', feedback: p.reason };
}
