import { createFreeformSkill } from '@wireassist/core';

export const freeformSkill = createFreeformSkill({
  role: 'gtm',
  description: 'Open-ended chat about go-to-market strategy, positioning, or pricing.',
  // Same reasoning as admin/ops/github/content's freeform skills: GTM's
  // skill-tools are each a full multi-step skill invocation that costs a
  // single loop iteration but can itself run several steps internally — the
  // default cap of 6 leaves too little room to also reason about the actual
  // request afterward.
  maxIterations: 12,
});
