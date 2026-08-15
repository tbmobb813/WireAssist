import type { Skill } from '@wireassist/core';

export interface FreeformInput {
  type?: string;
  prompt?: string;
}

export const freeformSkill: Skill<FreeformInput, void> = {
  name: 'freeform',
  role: 'admin',
  description: 'Open-ended chat, backed by the full tool-calling loop.',

  async execute({ agent, task, input }) {
    const prompt =
      input.type === 'freeform' && typeof input.prompt === 'string'
        ? input.prompt
        : task.description;
    const context = await agent.loadContext(prompt);
    const response = await agent.runToolLoop(task, prompt, { extraContext: context });

    agent.emit('agent:freeform_response', {
      taskId: task.id,
      response,
    });
  },
};
