import type { Skill } from '@wireassist/core';
import { extractJson, type CalendarEvent, type CalendarReview } from '../types';

export const calendarReviewSkill: Skill<{ daysAhead?: number }, CalendarReview> = {
  name: 'calendar_review',
  role: 'admin',
  description: 'Review upcoming calendar events for conflicts, overload, and missing prep time.',
  requiresApproval: true,

  async execute({ agent, task, input }) {
    const daysAhead = input.daysAhead ?? 7;

    const now = new Date();
    const until = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const events = (await agent.useTool('calendar_list_events', {
      timeMin: now.toISOString(),
      timeMax: until.toISOString(),
      maxResults: 50,
    })) as CalendarEvent[];

    const context = await agent.loadContext('calendar preferences meeting preferences work hours');

    const reviewPrompt = `
Review my calendar for the next ${daysAhead} days and identify:
1. Real scheduling conflicts (double-booked events)
2. Overloaded days — 5+ hours of meetings in one day, or 3+ meetings with no buffer between any
   of them
3. Missing prep/buffer time before anything that needs it
4. Any events that look like they could be async instead

EVENTS:
${events.map((e) => `- ${e.summary} | ${e.start} → ${e.end} | ${e.attendees?.length ?? 0} attendees`).join('\n')}

Return a JSON object:
{
  "conflicts": [{ "event1": string, "event2": string, "overlap": string }],
  "overloadedDays": [{ "date": string, "eventCount": number, "recommendation": string }],
  "suggestions": [{ "type": string, "description": string, "action": string }],
  "summary": string
}

Each "recommendation" and "suggestion.description" must name the specific event and where it
should move — not generic "consider taking more breaks" advice.

Only return valid JSON. No markdown fences.`;

    const rawResponse = await agent.think(reviewPrompt, context);

    let review: CalendarReview;
    try {
      review = extractJson<CalendarReview>(rawResponse);
    } catch {
      throw new Error('Admin Agent returned invalid JSON during calendar review');
    }

    agent.emit('agent:calendar_review_complete', {
      taskId: task.id,
      events,
      review,
    });

    // Propose and await approval for any suggested changes
    for (const suggestion of review.suggestions ?? []) {
      if (suggestion.type === 'reschedule' || suggestion.type === 'cancel') {
        const approved = await agent.proposeAction(task, suggestion.description, {
          action: suggestion.action,
        });
        if (approved) {
          agent.remember(`Calendar: ${suggestion.description} — approved`, [
            'calendar',
            'approved',
          ]);
        }
      }
    }

    return review;
  },
};
