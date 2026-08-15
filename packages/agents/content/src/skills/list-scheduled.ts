import type { Skill } from '@wireassist/core';

export interface ListScheduledInput {
  daysAhead?: number;
}

export const listScheduledSkill: Skill<ListScheduledInput, void> = {
  name: 'list_scheduled',
  role: 'content',
  description: 'List posts scheduled in the coming days.',

  async execute({ agent, task, input }) {
    const posts = await agent.useTool('content_list_posts', {
      daysAhead: input.daysAhead ?? 14,
    });

    agent.emit('agent:scheduled_posts', { taskId: task.id, posts });
  },
};
