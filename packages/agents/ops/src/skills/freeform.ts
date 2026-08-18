import type { ProviderMessage, Skill } from '@wireassist/core';

export interface OpsFreeformInput {
  prompt: string;
  history?: ProviderMessage[];
}

export const opsFreeformSkill: Skill<OpsFreeformInput, void> = {
  name: 'freeform',
  role: 'strategy',
  description: 'Open-ended question about the business/ops workflows.',

  async execute({ agent, task, input }) {
    const context = await agent.loadContext(input.prompt);
    const response = await agent.runToolLoop(task, input.prompt, {
      extraContext: context || undefined,
      priorMessages: input.history,
      // A real business question plausibly chains several raw read calls
      // (sheets_read, list_workflows, a content-check call) before
      // answering — same cap-exhaustion risk already confirmed live on
      // Admin and GitHub's freeform loops.
      maxIterations: 12,
    });
    task.output = { response };
    agent.emit('agent:ops_freeform_response', {
      agentRole: task.agentRole,
      taskId: task.id,
      response,
    });
  },
};
