import type { Skill } from '@wireassist/core';
import { freeformSkill } from './freeform';
import { proposeSkillSkill } from './propose-skill';
import { stalePrsSkill } from './stale-prs';

export const GITHUB_SKILLS: Skill[] = [freeformSkill, proposeSkillSkill, stalePrsSkill];
