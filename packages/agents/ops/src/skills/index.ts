import type { Skill } from '@wireassist/core';
import { runWorkflowSkill } from './run-workflow';
import { opsFreeformSkill } from './freeform';
import { trustGraduationNudgesSkill } from './trust-graduation-nudges';
import { proposeSkillSkill } from './propose-skill';

export const OPS_SKILLS: Skill[] = [
  runWorkflowSkill,
  opsFreeformSkill,
  trustGraduationNudgesSkill,
  proposeSkillSkill,
];
