import type { Skill } from '@wireassist/core';
import { generateStrategySkill } from './generate-strategy';
import { generatePsychSkill } from './generate-psych';
import { freeformSkill } from './freeform';
import { proposeSkillSkill } from './propose-skill';

export const GTM_SKILLS: Skill[] = [
  generateStrategySkill,
  generatePsychSkill,
  freeformSkill,
  proposeSkillSkill,
];
