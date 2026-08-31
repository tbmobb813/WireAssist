import type { ImageAttachment, DocumentAttachment, ProviderMessage } from '@wireassist/core';
import {
  createCalendarReviewTask,
  createEmailTriageTask,
  createFreeformTask,
  createDailyBriefingTask,
  createFollowUpNudgesTask,
  createProactiveInsightsTask,
  createBudgetWarningTask,
  createStaleApprovalsTask,
  createDetectSkillOpportunitiesTask,
  createMeetingPrepTask,
  createObjectiveHealthCheckTask,
  createTravelItineraryTask,
  createExpenseDigestTask,
  createMeetingFollowupTask,
  createDraftDocumentTask,
} from './task-factory';
import type { ObjectiveHealthCheckCandidate } from './skills/objective-health-check';

/** Convenience factories used by Command Center API routes and demos. */
export const AdminTasks = {
  triageEmail(maxEmails = 20, objectiveId?: string) {
    return createEmailTriageTask({ maxEmails, objectiveId });
  },

  reviewCalendar(daysAhead = 7, objectiveId?: string) {
    return createCalendarReviewTask({ daysAhead, objectiveId });
  },

  freeform(
    instruction: string,
    history?: ProviderMessage[],
    objectiveId?: string,
    images?: ImageAttachment[],
    documents?: DocumentAttachment[]
  ) {
    return createFreeformTask({ prompt: instruction, history, objectiveId, images, documents });
  },

  dailyBriefing(maxEmails = 20, daysAhead = 7, objectiveId?: string) {
    return createDailyBriefingTask({ maxEmails, daysAhead, objectiveId });
  },

  followUpNudges(daysStale = 3, objectiveId?: string) {
    return createFollowUpNudgesTask({ daysStale, objectiveId });
  },

  proactiveInsights(objectiveId?: string) {
    return createProactiveInsightsTask({ objectiveId });
  },

  budgetWarning(thresholdPercent = 80, objectiveId?: string) {
    return createBudgetWarningTask({ thresholdPercent, objectiveId });
  },

  staleApprovals(daysStale = 3, objectiveId?: string, backlogThreshold?: number) {
    return createStaleApprovalsTask({ daysStale, backlogThreshold, objectiveId });
  },

  detectSkillOpportunities(limit = 200, objectiveId?: string) {
    return createDetectSkillOpportunitiesTask({ limit, objectiveId });
  },

  meetingPrep(hoursAhead = 2, objectiveId?: string) {
    return createMeetingPrepTask({ hoursAhead, objectiveId });
  },

  objectiveHealthCheck(
    objectives: ObjectiveHealthCheckCandidate[],
    daysStale = 5,
    objectiveId?: string
  ) {
    return createObjectiveHealthCheckTask({ objectives, daysStale, objectiveId });
  },

  travelItinerary(daysAhead = 14, objectiveId?: string) {
    return createTravelItineraryTask({ daysAhead, objectiveId });
  },

  expenseDigest(daysAgo = 30, objectiveId?: string) {
    return createExpenseDigestTask({ daysAgo, objectiveId });
  },

  meetingFollowup(hoursBack = 3, objectiveId?: string) {
    return createMeetingFollowupTask({ hoursBack, objectiveId });
  },

  draftDocument(brief: string, title?: string, objectiveId?: string) {
    return createDraftDocumentTask({ brief, title, objectiveId });
  },
};
