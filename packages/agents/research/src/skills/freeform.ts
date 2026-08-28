import { createFreeformSkill } from '@wireassist/core';

export const freeformSkill = createFreeformSkill({
  role: 'research',
  description: 'Open-ended research chat, backed by the full tool-calling loop.',
  // Same reasoning as admin/ops/github/content's freeform skills: research's
  // skill-tools (research_topic_skill, synthesize_findings_skill) are each a
  // full multi-step skill invocation that costs a single loop iteration but
  // can itself run several steps internally — the default cap of 6 leaves
  // too little room to also reason about the actual request afterward.
  maxIterations: 12,
});
