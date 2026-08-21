import { createFreeformSkill } from '@wireassist/core';

export const freeformSkill = createFreeformSkill({
  role: 'research',
  description: 'Open-ended research chat, backed by the full tool-calling loop.',
});
