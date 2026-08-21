import { createFreeformSkill } from '@wireassist/core';

export const freeformSkill = createFreeformSkill({
  role: 'content',
  description: 'Open-ended chat about content strategy, backed by the full tool-calling loop.',
  // A real freeform ask ("how did my recent posts do, what should I write
  // next") plausibly chains several raw read calls (content_list_posts ->
  // content_analyze -> content_list_ideas) before answering — same
  // cap-exhaustion risk already confirmed live on Admin and GitHub's
  // freeform loops.
  maxIterations: 12,
});
