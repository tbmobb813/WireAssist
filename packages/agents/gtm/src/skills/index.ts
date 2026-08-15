import type { Skill } from '@wireassist/core';
import { generateStrategySkill } from './generate-strategy';
import { generatePsychSkill } from './generate-psych';
import { freeformSkill } from './freeform';

export const GTM_SKILLS: Skill[] = [generateStrategySkill, generatePsychSkill, freeformSkill];
