import type { Skill } from '@wireassist/core';
import type { CalendarEvent, GmailThread } from '../types';

const DEFAULT_DAYS_AHEAD = 14;

// Broad enough to catch most airline/hotel/rental-car confirmation emails
// without needing a labeled inbox convention — the same "search, then let
// think() judge relevance" approach meeting_prep already uses for attendee
// threads.
const TRAVEL_QUERY =
  'subject:(flight OR itinerary OR "booking confirmation" OR "reservation confirmation" OR ' +
  'boarding OR hotel OR "e-ticket")';

export interface TravelItineraryInput {
  daysAhead?: number;
}

export const travelItinerarySkill: Skill<TravelItineraryInput, void> = {
  name: 'travel_itinerary_digest',
  role: 'admin',
  description:
    'Scan for upcoming travel confirmations and calendar events, and compile a single itinerary digest.',

  async execute({ agent, task, input }) {
    const daysAhead = input.daysAhead ?? DEFAULT_DAYS_AHEAD;
    const now = new Date();
    const until = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const [threads, events] = await Promise.all([
      agent.useTool('gmail_search', { q: TRAVEL_QUERY, maxResults: 15 }) as Promise<GmailThread[]>,
      agent.useTool('calendar_list_events', {
        timeMin: now.toISOString(),
        timeMax: until.toISOString(),
        maxResults: 30,
      }) as Promise<CalendarEvent[]>,
    ]);

    if (threads.length === 0 && events.length === 0) {
      agent.emit('agent:travel_itinerary_digest_complete', {
        taskId: task.id,
        summary: 'No upcoming travel detected.',
        hasTravel: false,
      });
      return;
    }

    const digestPrompt = `Compile a clear travel itinerary digest for Jason from the raw material
below. Group by trip if more than one is evident. Include dates, times, confirmation numbers,
and locations wherever the source material has them. If none of this actually looks like travel
(false-positive keyword matches), say so plainly instead of forcing an itinerary out of it.

RECENT EMAILS MATCHING TRAVEL KEYWORDS:
${threads.length > 0 ? threads.map((t) => `- ${t.snippet}`).join('\n') : 'None found.'}

CALENDAR EVENTS IN THE NEXT ${daysAhead} DAYS:
${
  events.length > 0
    ? events.map((e) => `- "${e.summary}" | ${e.start} → ${e.end}`).join('\n')
    : 'None found.'
}`;

    const summary = await agent.think(digestPrompt);

    agent.emit('agent:travel_itinerary_digest_complete', {
      taskId: task.id,
      summary,
      hasTravel: true,
    });
  },
};
