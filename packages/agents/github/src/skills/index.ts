import type { Skill } from '@wireassist/core';
import { freeformSkill } from './freeform';
import { proposeSkillSkill } from './propose-skill';

export const GITHUB_SKILLS: Skill[] = [freeformSkill, proposeSkillSkill];
