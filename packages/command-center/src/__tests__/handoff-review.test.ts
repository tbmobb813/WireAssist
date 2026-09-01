import {
  decideHandoffReviewAction,
  type HandoffReviewCompletePayload,
} from '../lib/handoff-review';

function makePayload(
  overrides: Partial<HandoffReviewCompletePayload> = {}
): HandoffReviewCompletePayload {
  return {
    contentTaskId: 'content-1',
    passed: false,
    reason: 'Draft invents a claim the research does not support.',
    attempt: 0,
    originalQuery: 'AI trends',
    researchSummary: 'summary',
    requestedPlatform: 'linkedin',
    producedContent: 'draft text',
    ...overrides,
  };
}

describe('decideHandoffReviewAction()', () => {
  it('passes through when the review passed, regardless of attempt', () => {
    expect(decideHandoffReviewAction(makePayload({ passed: true, attempt: 0 }))).toEqual({
      kind: 'pass',
    });
    expect(decideHandoffReviewAction(makePayload({ passed: true, attempt: 1 }))).toEqual({
      kind: 'pass',
    });
  });

  it('retries with the failure reason as feedback on the first failure', () => {
    const action = decideHandoffReviewAction(
      makePayload({ passed: false, attempt: 0, reason: 'wrong tone' })
    );
    expect(action).toEqual({ kind: 'retry', feedback: 'wrong tone' });
  });

  it('escalates instead of retrying again once the retry has also failed', () => {
    const action = decideHandoffReviewAction(makePayload({ passed: false, attempt: 1 }));
    expect(action).toEqual({ kind: 'escalate' });
  });

  it('never retries more than once even if attempt is somehow higher', () => {
    const action = decideHandoffReviewAction(makePayload({ passed: false, attempt: 5 }));
    expect(action).toEqual({ kind: 'escalate' });
  });
});
