import type { ProviderMessage, Skill } from '@wireassist/core';

export interface FreeformInput {
  type?: string;
  prompt?: string;
  history?: ProviderMessage[];
}

export const freeformSkill: Skill<FreeformInput, void> = {
  name: 'freeform',
  role: 'github',
  description: 'Open-ended chat about GitHub repos, issues, and pull requests.',

  async execute({ agent, task, input }) {
    const prompt =
      input.type === 'freeform' && typeof input.prompt === 'string'
        ? input.prompt
        : task.description;
    const context = await agent.loadContext(prompt);
    const response = await agent.runToolLoop(task, prompt, {
      extraContext: context,
      priorMessages: input.history,
    });

    agent.emit('agent:github_freeform_response', {
      taskId: task.id,
      response,
    });
  },
};
