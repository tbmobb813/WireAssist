import type { Skill } from '@wireassist/core';
import { emailTriageSkill } from './email-triage';
import { calendarReviewSkill } from './calendar-review';

export interface DailyBriefingInput {
  maxEmails?: number;
  daysAhead?: number;
}

// Composes email-triage and calendar-review directly — skills are just
// objects with an execute() method, so one skill can call another's
// execute() in code. No SkillChain needed here: their outputs don't thread
// linearly into each other, they just both need to happen and get
// summarized together.
export const dailyBriefingSkill: Skill<DailyBriefingInput, void> = {
  name: 'daily_briefing',
  role: 'admin',
  description: 'Combined morning digest: inbox triage + calendar review in one run.',

  async execute({ agent, task, input }) {
    const triage = await emailTriageSkill.execute({
      agent,
      task,
      input: { maxEmails: input.maxEmails },
    });

    const calendarReview = await calendarReviewSkill.execute({
      agent,
      task,
      input: { daysAhead: input.daysAhead },
    });

    const digestPrompt = `Write a 3-5 sentence "good morning" digest for Jason combining these two
reports. Lead with whatever is most time-sensitive across either one. Be direct, no filler.

INBOX TRIAGE SUMMARY:
${triage.summary}
Urgent: ${triage.categories.urgent.length}, Reply needed: ${triage.categories.replyNeeded.length}

CALENDAR REVIEW SUMMARY:
${calendarReview.summary}
Conflicts: ${calendarReview.conflicts.length}, Overloaded days: ${calendarReview.overloadedDays.length}`;

    const summary = await agent.think(digestPrompt);

    agent.emit('agent:daily_briefing_complete', {
      taskId: task.id,
      summary,
      triageSummary: triage.summary,
      calendarSummary: calendarReview.summary,
    });
  },
};
