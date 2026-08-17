import type { Skill } from '@wireassist/core';
import { emailTriageSkill } from './email-triage';
import { calendarReviewSkill } from './calendar-review';
import { sendEmailSkill } from './send-email';
import { scheduleEventSkill } from './schedule-event';
import { freeformSkill } from './freeform';
import { dailyBriefingSkill } from './daily-briefing';
import { followUpNudgesSkill } from './follow-up-nudges';
import { proactiveInsightsSkill } from './proactive-insights';
import { budgetWarningSkill } from './budget-warning';

export const ADMIN_SKILLS: Skill[] = [
  emailTriageSkill,
  calendarReviewSkill,
  sendEmailSkill,
  scheduleEventSkill,
  freeformSkill,
  dailyBriefingSkill,
  followUpNudgesSkill,
  proactiveInsightsSkill,
  budgetWarningSkill,
];

export {
  emailTriageSkill,
  calendarReviewSkill,
  sendEmailSkill,
  scheduleEventSkill,
  freeformSkill,
  dailyBriefingSkill,
  followUpNudgesSkill,
  proactiveInsightsSkill,
  budgetWarningSkill,
};
export { proposeOrAutoApprove } from './propose-or-auto-approve';
