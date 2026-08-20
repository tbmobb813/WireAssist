import type { ImageAttachment, ProviderMessage, Skill } from '@wireassist/core';

export interface FreeformInput {
  type?: string;
  prompt?: string;
  history?: ProviderMessage[];
  images?: ImageAttachment[];
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
    const response = await agent.runToolLoop(task, prompt, {
      extraContext: context,
      priorMessages: input.history,
      images: input.images,
      // Admin's skill-tools (email_triage_skill, calendar_review_skill) are
      // each a full multi-step skill invocation that costs a single loop
      // iteration but can itself run a whole approval flow internally —
      // the default cap of 6 leaves too little room to also reason about
      // the actual request (or delegate_to_agent) afterward.
      maxIterations: 12,
    });

    agent.emit('agent:freeform_response', {
      taskId: task.id,
      response,
    });
  },
};
