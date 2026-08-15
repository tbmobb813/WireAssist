import type { Skill } from '@wireassist/core';

export interface OpsFreeformInput {
  prompt: string;
}

export const opsFreeformSkill: Skill<OpsFreeformInput, void> = {
  name: 'freeform',
  role: 'strategy',
  description: 'Open-ended question about the business/ops workflows.',

  async execute({ agent, task, input }) {
    const context = await agent.loadContext(input.prompt);
    const response = await agent.runToolLoop(task, input.prompt, {
      extraContext: context || undefined,
    });
    task.output = { response };
    agent.emit('agent:ops_freeform_response', {
      agentRole: task.agentRole,
      taskId: task.id,
      response,
    });
  },
};
