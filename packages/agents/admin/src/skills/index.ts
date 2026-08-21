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
import { staleApprovalsSkill } from './stale-approvals';
import { proposeSkillSkill } from './propose-skill';
import { detectSkillOpportunitiesSkill } from './detect-skill-opportunities';
import { meetingPrepSkill } from './meeting-prep';
import { objectiveHealthCheckSkill } from './objective-health-check';
import { travelItinerarySkill } from './travel-itinerary';
import { expenseDigestSkill } from './expense-digest';
import { meetingFollowupSkill } from './meeting-followup';
import { draftDocumentSkill } from './draft-document';

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
  staleApprovalsSkill,
  proposeSkillSkill,
  detectSkillOpportunitiesSkill,
  meetingPrepSkill,
  objectiveHealthCheckSkill,
  travelItinerarySkill,
  expenseDigestSkill,
  meetingFollowupSkill,
  draftDocumentSkill,
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
  staleApprovalsSkill,
  proposeSkillSkill,
  detectSkillOpportunitiesSkill,
  meetingPrepSkill,
  objectiveHealthCheckSkill,
  travelItinerarySkill,
  expenseDigestSkill,
  meetingFollowupSkill,
  draftDocumentSkill,
};
export { proposeOrAutoApprove } from './propose-or-auto-approve';
