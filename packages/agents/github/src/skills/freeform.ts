import { createFreeformSkill } from '@wireassist/core';

export const freeformSkill = createFreeformSkill({
  role: 'github',
  description: 'Open-ended chat about GitHub repos, issues, and pull requests.',
  // A single ask often needs several read calls chained together
  // (search_repositories to find the repo, then list_issues/search_code/
  // etc.) — confirmed hitting the default cap of 6 on a live delegated
  // task (Content -> GitHub) before it ever produced a result.
  maxIterations: 12,
  buildCompletionEvent: ({ task, response }) => ({
    event: 'agent:github_freeform_response',
    payload: { taskId: task.id, response },
  }),
});
