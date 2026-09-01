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
  tone?: string;
  extraContext?: string;
  reviewContext?: HandoffReviewContext;
}

export const generatePostSkill: Skill<GeneratePostInput, void> = {
  name: 'generate_post',
  role: 'content',
  description: 'Generate a single post for one platform, gated by approval.',
  requiresApproval: true,

  async execute({ agent, task, input }) {
    const { topic, platform, tone, extraContext, reviewContext } = input;

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
      tone,
      context,
    })) as { content: string; platform: string; topic: string };

    agent.emit('agent:content_generated', {
      taskId: task.id,
      ...result,
      // Only present for the review pilot — server.ts's listener uses this
      // to decide whether to queue Research's cold review of this draft.
      reviewContext,
    });

    const analysis = (await agent.useTool('content_analyze', {
      content: result.content,
      platform,
    })) as { score: number; estimatedEngagement: string; suggestion: string };

    // Wording matters here: approving this only saves the draft to memory —
    // it does NOT schedule or post anything (that's schedule_post_skill, a
    // separate approval with its own scheduledAt). Earlier phrasing ("Post
    // to {platform}: ...") implied this approval alone would publish, which
    // it never did — approved drafts just sat in memory with no scheduled
    // slot and no visible next step.
    const approved = await agent.proposeAction(
      task,
      `Save this ${platform} draft? (still needs to be scheduled separately): "${result.content.slice(0, 80)}..."`,
      { content: result.content, platform, analysis }
    );

    if (approved) {
      agent.remember(`Generated approved ${platform} post about: ${topic}`, [
        'content',
        'approved',
        platform,
      ]);
      agent.emit('agent:content_approved', {
        taskId: task.id,
        content: result.content,
        platform,
      });
    } else {
      agent.remember(`User rejected ${platform} post about: ${topic}. May need different angle.`, [
        'content',
        'rejected',
        platform,
      ]);
    }
  },
};
