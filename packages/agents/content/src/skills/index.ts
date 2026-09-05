import type { Skill } from '@wireassist/core';
import { generatePostSkill } from './generate-post';
import { generatePlanSkill } from './generate-plan';
import { generateAndScheduleCampaignSkill } from './generate-and-schedule-campaign';
import { generatePlanFromTimelineSkill } from './generate-plan-from-timeline';
import { schedulePostSkill } from './schedule-post';
import { analyzePostSkill } from './analyze-post';
import { listScheduledSkill } from './list-scheduled';
import { freeformSkill } from './freeform';
import { publishDuePostsSkill } from './publish-due-posts';
import { proposeSkillSkill } from './propose-skill';
import { contentRetroSkill } from './content-retro';

export const CONTENT_SKILLS: Skill[] = [
  generatePostSkill,
  generatePlanSkill,
  generateAndScheduleCampaignSkill,
  generatePlanFromTimelineSkill,
  schedulePostSkill,
  analyzePostSkill,
  listScheduledSkill,
  freeformSkill,
  publishDuePostsSkill,
  proposeSkillSkill,
  contentRetroSkill,
];
