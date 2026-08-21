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
  createObjectiveHealthCheckTask,
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

  staleApprovals(daysStale = 3, objectiveId?: string) {
    return createStaleApprovalsTask({ daysStale, objectiveId });
  },

  detectSkillOpportunities(limit = 200, objectiveId?: string) {
    return createDetectSkillOpportunitiesTask({ limit, objectiveId });
  },

  objectiveHealthCheck(
    objectives: ObjectiveHealthCheckCandidate[],
    daysStale = 5,
    objectiveId?: string
  ) {
    return createObjectiveHealthCheckTask({ objectives, daysStale, objectiveId });
  },
};
