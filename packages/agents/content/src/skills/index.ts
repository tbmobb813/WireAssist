import type { Skill } from '@wireassist/core';
import { generatePostSkill } from './generate-post';
import { generatePlanSkill } from './generate-plan';
import { generatePlanFromTimelineSkill } from './generate-plan-from-timeline';
import { schedulePostSkill } from './schedule-post';
import { analyzePostSkill } from './analyze-post';
import { listScheduledSkill } from './list-scheduled';
import { freeformSkill } from './freeform';

export const CONTENT_SKILLS: Skill[] = [
  generatePostSkill,
  generatePlanSkill,
  generatePlanFromTimelineSkill,
  schedulePostSkill,
  analyzePostSkill,
  listScheduledSkill,
  freeformSkill,
];
