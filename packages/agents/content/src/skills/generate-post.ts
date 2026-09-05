import type { Skill } from '@wireassist/core';
import type { Platform } from '@wireassist/trendpost-mcp';

// Present only when this task came from the Research -> Content handoff
// pilot (research-topic.ts's offerContentDraft). Carries what's needed for
// Research's own review_handoff_output skill to grade this draft cold
// against what it actually asked for — see review-handoff-output.ts.
export interface HandoffReviewContext {
  requestedBy: 'research';
  originalTaskId: string;
  query: string;
  researchSummary: string;
  tone?: string;
  attempt: number;
}

export interface GeneratePostInput {
  topic: string;
  platform: Platform;
  // Which specific brand/account this post is for — see generate-plan.ts's
  // GeneratePlanInput.account for why this matters.
  account?: string;
  tone?: string;
  extraContext?: string;
  reviewContext?: HandoffReviewContext;
}

export const generatePostSkill: Skill<GeneratePostInput, void> = {
  name: 'generate_post',
  role: 'content',
  // Not approval-gated — generating/analyzing/remembering a draft has no
  // real-world effect yet. The actual "will this go live" checkpoint is
  // schedule_post_skill, since nothing publishes without first being
  // scheduled, and publish_due_posts_skill's cron sweep runs unattended by
  // design once something is scheduled. Gating this step too was asking
  // for approval on a process step, not a final outcome.
  description: 'Generate a single post for one platform.',

  async execute({ agent, task, input }) {
    const { topic, platform, account, tone, extraContext, reviewContext } = input;

    const memoryContext = await agent.loadContext(
      'business description products services audience'
    );
    // extraContext carries a handoff from another agent (e.g. a research finding) —
    // it takes precedence in the prompt since it's more specific to this post than
    // the agent's general business-context memory.
    const context = [extraContext, memoryContext].filter(Boolean).join('\n\n');

    const result = (await agent.useTool('content_generate', {
      topic,
      platform,
      account,
      tone,
      context,
    })) as { content: string; platform: string; topic: string; account?: string };

    agent.emit('agent:content_generated', {
      taskId: task.id,
      ...result,
      // Only present for the review pilot — server.ts's listener uses this
      // to decide whether to queue Research's cold review of this draft.
      reviewContext,
    });

    // No content_analyze call here anymore — its only consumer was the
    // approval card just removed below, and content-retro.ts already runs
    // its own separate analysis pass on published posts for retrospective
    // learning. Computing a score nothing displays was wasted latency/cost.
    //
    // No approval gate here (see the skill's own comment on why) — generating
    // and remembering a draft has no real-world effect. It still isn't
    // scheduled or posted anywhere; that's schedule_post_skill's job, with
    // its own approval, which is the actual "will this go live" checkpoint.
    agent.remember(`Generated ${platform} post about: ${topic}`, [
      'content',
      'generated',
      platform,
    ]);
    agent.emit('agent:content_approved', {
      taskId: task.id,
      content: result.content,
      platform,
      account,
    });
  },
};
