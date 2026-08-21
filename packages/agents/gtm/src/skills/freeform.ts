import type { ImageAttachment, DocumentAttachment, ProviderMessage, Skill } from '@wireassist/core';

export interface FreeformInput {
  type?: string;
  prompt?: string;
  history?: ProviderMessage[];
  images?: ImageAttachment[];
  documents?: DocumentAttachment[];
}

export const freeformSkill: Skill<FreeformInput, void> = {
  name: 'freeform',
  role: 'gtm',
  description: 'Open-ended chat about go-to-market strategy, positioning, or pricing.',

  async execute({ agent, task, input }) {
    const prompt =
      input.type === 'freeform' && typeof input.prompt === 'string'
        ? input.prompt
        : task.description;
    const context = await agent.loadContext(prompt);
    const response = await agent.runToolLoop(task, prompt, {
      extraContext: context,
      priorMessages: input.history,
      images: input.images,
      documents: input.documents,
    });

    agent.emit('agent:freeform_response', {
      taskId: task.id,
      response,
    });

    // Tagged for detect_skill_opportunities' later pattern search — after
    // handling, not before, so a request that errors doesn't get
    // remembered as a "real" pattern data point.
    agent.remember(prompt, [task.agentRole, 'freeform_request']);
  },
};
