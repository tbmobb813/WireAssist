import type { Skill } from '@wireassist/core';
import type { Platform } from '@wireassist/trendpost-mcp';

export interface SchedulePostInput {
  content: string;
  platform: Platform;
  // Which specific brand/account this post is for — see generate-plan.ts's
  // GeneratePlanInput.account for why this matters.
  account?: string;
  scheduledAt: string;
  tags?: string[];
}

export const schedulePostSkill: Skill<SchedulePostInput, void> = {
  name: 'schedule_post',
  role: 'content',
  description: 'Schedule an approved post for publication, gated by approval.',
  requiresApproval: true,

  async execute({ agent, task, input }) {
    const { content, platform, account, scheduledAt, tags } = input;

    const approved = await agent.proposeAction(
      task,
      `Schedule ${platform} post${account ? ` for ${account}` : ''} for ${new Date(scheduledAt).toLocaleDateString()}`,
      { content, platform, account, scheduledAt }
    );

    if (!approved) return;

    const post = await agent.useTool('content_schedule_post', {
      content,
      platform,
      account,
      scheduledAt,
      tags,
      objectiveId: task.objectiveId,
    });

    agent.emit('agent:post_scheduled', { taskId: task.id, post });
    agent.remember(`Scheduled ${platform} post for ${scheduledAt}: "${content.slice(0, 60)}..."`, [
      'content',
      'scheduled',
      platform,
    ]);
  },
};
