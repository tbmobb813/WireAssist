import {
  createCalendarReviewTask,
  createEmailTriageTask,
  createFreeformTask,
  createDailyBriefingTask,
  createFollowUpNudgesTask,
} from './task-factory';

/** Convenience factories used by Command Center API routes and demos. */
export const AdminTasks = {
  triageEmail(maxEmails = 20) {
    return createEmailTriageTask({ maxEmails });
  },

  reviewCalendar(daysAhead = 7) {
    return createCalendarReviewTask({ daysAhead });
  },

  freeform(instruction: string) {
    return createFreeformTask({ prompt: instruction });
  },

  dailyBriefing(maxEmails = 20, daysAhead = 7) {
    return createDailyBriefingTask({ maxEmails, daysAhead });
  },

  followUpNudges(daysStale = 3) {
    return createFollowUpNudgesTask({ daysStale });
  },
};
