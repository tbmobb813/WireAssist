import type { Skill } from '@wireassist/core';

export interface ReviewHandoffOutputInput {
  originalQuery: string;
  researchSummary: string;
  requestedPlatform: string;
  requestedTone?: string;
  producedContent: string;
  contentTaskId: string;
  attempt: number;
}

// Pilot for the delegate -> check -> redirect loop, scoped to one handoff
// pair first (Research -> Content, via research-topic.ts's offerContentDraft)
// before deciding whether to extend the pattern elsewhere. Mirrors NixOps's
// Assess stage: a fresh, independent think() call reviewing the finished
// artifact cold, with no visibility into how the producing agent reasoned
// its way there — not the same call re-checking its own work.
//
// This skill only judges and reports (agent:handoff_review_complete).
// server.ts's listener owns what happens next (retry once with feedback,
// then escalate) — orchestration lives with the other cross-agent wiring
// in server.ts (routeHandoffTask, replayOrphanedHandoffs), not inside a
// single agent's skill.
export const reviewHandoffOutputSkill: Skill<ReviewHandoffOutputInput, void> = {
  name: 'review_handoff_output',
  role: 'research',
  description:
    'Cold review of a Content draft against the research handoff that requested it — pass/fail, no visibility into how Content produced it.',

  async execute({ agent, task, input }) {
    const {
      originalQuery,
      researchSummary,
      requestedPlatform,
      requestedTone,
      producedContent,
      contentTaskId,
      attempt,
    } = input;

    const verdictRaw = await agent.think(
      `You are reviewing a ${requestedPlatform} post that the Content agent produced in response to a ` +
        `handoff you (Research) requested. You did not write this post and have no visibility into how ` +
        `Content produced it — review it cold, the way an independent editor would.\n\n` +
        `WHAT WAS ASKED FOR:\n- Topic/query: ${originalQuery}\n- Platform: ${requestedPlatform}\n` +
        (requestedTone ? `- Tone: ${requestedTone}\n` : '') +
        `\nRESEARCH FINDINGS THIS POST SHOULD BE CONSISTENT WITH:\n${researchSummary}\n\n` +
        `PRODUCED POST:\n${producedContent}\n\n` +
        `Grade strictly: does the post actually match the requested topic and platform, stay factually ` +
        `consistent with the research findings above (flag any claim the research doesn't support), and ` +
        `fit the requested tone if one was given? Give your reasoning, then end with exactly one line, ` +
        `nothing after it: "VERDICT: PASS" or "VERDICT: FAIL".`
    );

    const passed = /VERDICT:\s*PASS/i.test(verdictRaw);
    const reason = verdictRaw.replace(/VERDICT:\s*(PASS|FAIL)\s*$/i, '').trim();

    agent.emit('agent:handoff_review_complete', {
      taskId: task.id,
      contentTaskId,
      passed,
      reason,
      attempt,
      originalQuery,
      researchSummary,
      requestedPlatform,
      requestedTone,
      producedContent,
    });
  },
};
