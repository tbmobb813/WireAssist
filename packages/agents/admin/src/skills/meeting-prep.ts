import type { Skill } from '@wireassist/core';
import type { CalendarEvent, GmailThread } from '../types';

const DEFAULT_HOURS_AHEAD = 2;

export interface MeetingPrepInput {
  hoursAhead?: number;
}

export interface MeetingPrepNote {
  eventId: string;
  summary: string;
  prep: string;
}

// SkillAgentHandle has no dedicated "have I already done X" accessor, so
// idempotency (never re-prep the same meeting on the next 30-minute tick)
// is built on loadContext()'s existing relevance search: remember() a fixed
// marker string per event, then check for that exact same string before
// prepping again. Querying with the identical text it was stored as gives a
// near-1.0 cosine similarity against its own past embedding — reliable, not
// a fuzzy guess — so this needs no new core surface.
function preppedMarker(eventId: string): string {
  return `meeting-prep-done:${eventId}`;
}

export const meetingPrepSkill: Skill<MeetingPrepInput, void> = {
  name: 'meeting_prep',
  role: 'admin',
  description:
    'Draft prep notes for meetings starting soon — attendees, recent email threads with them, suggested talking points.',

  async execute({ agent, task, input }) {
    const hoursAhead = input.hoursAhead ?? DEFAULT_HOURS_AHEAD;
    const now = new Date();
    const until = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

    const events = (await agent.useTool('calendar_list_events', {
      timeMin: now.toISOString(),
      timeMax: until.toISOString(),
      maxResults: 20,
    })) as CalendarEvent[];

    // A meeting with nobody else on it has no "prep" to speak of — nothing
    // to look up threads for, no one to brief Jason on.
    const meetings = events.filter((e) => (e.attendees?.length ?? 0) > 0);

    const prepared: MeetingPrepNote[] = [];
    for (const event of meetings) {
      const marker = preppedMarker(event.id);
      const already = await agent.loadContext(marker);
      if (already.includes(marker)) continue;

      const attendeeEmails = (event.attendees ?? []).map((a) => a.email);
      const threads = (await agent.useTool('gmail_search', {
        q: attendeeEmails.map((email) => `from:${email} OR to:${email}`).join(' OR '),
        maxResults: 10,
      })) as GmailThread[];

      const memoryContext = await agent.loadContext(event.summary);

      const prepPrompt = `Draft short, direct prep notes for Jason ahead of this upcoming meeting —
attendees, any relevant open email thread, and one or two suggested talking points if the
context supports it. No filler like "have a great meeting."

EVENT: "${event.summary}" | ${event.start} → ${event.end}
ATTENDEES: ${attendeeEmails.join(', ') || 'none listed'}

RECENT EMAIL THREADS INVOLVING THEM:
${threads.length > 0 ? threads.map((t) => `- ${t.snippet}`).join('\n') : 'None found.'}`;

      const prep = await agent.think(prepPrompt, memoryContext);

      prepared.push({ eventId: event.id, summary: event.summary, prep });
      agent.remember(marker, ['admin', 'meeting-prep-done']);
    }

    if (prepared.length === 0) {
      agent.emit('agent:meeting_prep_complete', {
        taskId: task.id,
        summary: 'No upcoming meetings need prep.',
        prepared: [],
      });
      return;
    }

    const summary = prepared.map((p) => `**${p.summary}**\n${p.prep}`).join('\n\n');

    agent.emit('agent:meeting_prep_complete', {
      taskId: task.id,
      summary,
      prepared,
    });
  },
};
