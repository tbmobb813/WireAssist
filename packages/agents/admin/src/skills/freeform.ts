import { createFreeformSkill } from '@wireassist/core';

export const freeformSkill = createFreeformSkill({
  role: 'admin',
  description: 'Open-ended chat, backed by the full tool-calling loop.',
  // Admin's skill-tools (email_triage_skill, calendar_review_skill) are
  // each a full multi-step skill invocation that costs a single loop
  // iteration but can itself run a whole approval flow internally — the
  // default cap of 6 leaves too little room to also reason about the
  // actual request (or delegate_to_agent) afterward.
  maxIterations: 12,
});
