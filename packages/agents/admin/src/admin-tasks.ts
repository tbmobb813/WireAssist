import type { ProviderMessage } from '@wireassist/core';
import {
  createCalendarReviewTask,
  createEmailTriageTask,
  createFreeformTask,
  createDailyBriefingTask,
  createFollowUpNudgesTask,
  createProactiveInsightsTask,
  createBudgetWarningTask,
  createStaleApprovalsTask,
} from './task-factory';

/** Convenience factories used by Command Center API routes and demos. */
export const AdminTasks = {
  triageEmail(maxEmails = 20) {
    return createEmailTriageTask({ maxEmails });
  },

  reviewCalendar(daysAhead = 7) {
    return createCalendarReviewTask({ daysAhead });
  },

  freeform(instruction: string, history?: ProviderMessage[]) {
    return createFreeformTask({ prompt: instruction, history });
  },

  dailyBriefing(maxEmails = 20, daysAhead = 7) {
    return createDailyBriefingTask({ maxEmails, daysAhead });
  },

  followUpNudges(daysStale = 3) {
    return createFollowUpNudgesTask({ daysStale });
  },

  proactiveInsights() {
    return createProactiveInsightsTask();
  },

  budgetWarning(thresholdPercent = 80) {
    return createBudgetWarningTask({ thresholdPercent });
  },

  staleApprovals(daysStale = 3) {
    return createStaleApprovalsTask({ daysStale });
  },
};
