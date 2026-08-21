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
  role: 'content',
  description: 'Open-ended chat about content strategy, backed by the full tool-calling loop.',

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
      // A real freeform ask ("how did my recent posts do, what should I
      // write next") plausibly chains several raw read calls
      // (content_list_posts -> content_analyze -> content_list_ideas)
      // before answering — same cap-exhaustion risk already confirmed live
      // on Admin and GitHub's freeform loops.
      maxIterations: 12,
    });

    agent.emit('agent:freeform_response', { taskId: task.id, response });

    // Tagged for detect_skill_opportunities' later pattern search — after
    // handling, not before, so a request that errors doesn't get
    // remembered as a "real" pattern data point.
    agent.remember(prompt, [task.agentRole, 'freeform_request']);
  },
};
