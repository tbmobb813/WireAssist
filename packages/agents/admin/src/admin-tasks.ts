import {
  createCalendarReviewTask,
  createEmailTriageTask,
  createFreeformTask,
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
};
