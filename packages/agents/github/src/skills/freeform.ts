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
      images: input.images,
      documents: input.documents,
      // A single ask often needs several read calls chained together
      // (search_repositories to find the repo, then list_issues/search_code/
      // etc.) — confirmed hitting the default cap of 6 on a live delegated
      // task (Content -> GitHub) before it ever produced a result.
      maxIterations: 12,
    });

    agent.emit('agent:github_freeform_response', {
      taskId: task.id,
      response,
    });
  },
};
