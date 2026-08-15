import type { Skill } from '@wireassist/core';

export const freeformSkill: Skill<unknown, void> = {
  name: 'freeform',
  role: 'gtm',
  description: 'Open-ended chat about go-to-market strategy.',

  async execute({ agent, task }) {
    const context = await agent.loadContext(task.description);
    const response = await agent.think(task.description, context);
    agent.emit('agent:freeform_response', { taskId: task.id, response });
  },
};
