import type { Skill } from '@wireassist/core';
import { freeformSkill } from './freeform';
import { stalePrsSkill } from './stale-prs';

export const GITHUB_SKILLS: Skill[] = [freeformSkill, stalePrsSkill];
