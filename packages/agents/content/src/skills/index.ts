import type { Skill } from '@wireassist/core';
import { generatePostSkill } from './generate-post';
import { generatePlanSkill } from './generate-plan';
import { generatePlanFromTimelineSkill } from './generate-plan-from-timeline';
import { schedulePostSkill } from './schedule-post';
import { analyzePostSkill } from './analyze-post';
import { listScheduledSkill } from './list-scheduled';
import { freeformSkill } from './freeform';
import { publishDuePostsSkill } from './publish-due-posts';
import { proposeSkillSkill } from './propose-skill';

export const CONTENT_SKILLS: Skill[] = [
  generatePostSkill,
  generatePlanSkill,
  generatePlanFromTimelineSkill,
  schedulePostSkill,
  analyzePostSkill,
  listScheduledSkill,
  freeformSkill,
  publishDuePostsSkill,
  proposeSkillSkill,
];
