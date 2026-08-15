import type { Skill } from '@wireassist/core';
import { runWorkflowSkill } from './run-workflow';
import { opsFreeformSkill } from './freeform';

export const OPS_SKILLS: Skill[] = [runWorkflowSkill, opsFreeformSkill];
