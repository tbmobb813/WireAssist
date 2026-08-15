import type { Skill } from '@wireassist/core';

export const freeformSkill: Skill<unknown, void> = {
  name: 'freeform',
  role: 'content',
  description: 'Open-ended chat about content strategy.',

  async execute({ agent, task }) {
    const context = await agent.loadContext(task.description);
    const response = await agent.think(task.description, context);
    agent.emit('agent:freeform_response', { taskId: task.id, response });
  },
};
