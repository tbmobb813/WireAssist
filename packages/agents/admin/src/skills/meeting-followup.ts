import type { Skill } from '@wireassist/core';
import type { CalendarEvent } from '../types';

const DEFAULT_HOURS_BACK = 3;

export interface MeetingFollowupInput {
  hoursBack?: number;
}

export interface MeetingFollowupNote {
  eventId: string;
  summary: string;
  followup: string;
}

// The other half of meeting_prep: that skill drafts notes BEFORE a meeting,
// this one drafts a summary + action items AFTER one ends. Same idempotency
// trick — a fixed marker string remembered per event, checked via
// loadContext()'s relevance search before following up again — so a
// frequent cron tick never re-follows-up the same meeting twice.
function followedUpMarker(eventId: string): string {
  return `meeting-followup-done:${eventId}`;
}

export const meetingFollowupSkill: Skill<MeetingFollowupInput, void> = {
  name: 'meeting_followup',
  role: 'admin',
  description:
    'Draft a summary and action items for meetings that just ended — the other half of meeting_prep.',

  async execute({ agent, task, input }) {
    const hoursBack = input.hoursBack ?? DEFAULT_HOURS_BACK;
    const now = new Date();
    const since = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);

    const events = (await agent.useTool('calendar_list_events', {
      timeMin: since.toISOString(),
      timeMax: now.toISOString(),
      maxResults: 20,
    })) as CalendarEvent[];

    // Only events that have already ended, and only ones with someone else
    // on them — same "nothing to follow up on alone" reasoning meeting_prep
    // uses for who gets prepped in the first place.
    const ended = events.filter(
      (e) => new Date(e.end).getTime() <= now.getTime() && (e.attendees?.length ?? 0) > 0
    );

    const followedUp: MeetingFollowupNote[] = [];
    for (const event of ended) {
      const marker = followedUpMarker(event.id);
      const already = await agent.loadContext(marker);
      if (already.includes(marker)) continue;

      const attendeeEmails = (event.attendees ?? []).map((a) => a.email);
      const memoryContext = await agent.loadContext(event.summary);

      const followupPrompt = `This meeting just ended. Draft a short summary and any likely action
items for Jason, based on what's known about it — no invented transcript, just what a sensible
recap looks like from the event details and any relevant memory below. If there's not enough to
say anything useful, say that plainly instead of padding it out.

EVENT: "${event.summary}" | ${event.start} → ${event.end}
ATTENDEES: ${attendeeEmails.join(', ') || 'none listed'}`;

      const followup = await agent.think(followupPrompt, memoryContext);

      followedUp.push({ eventId: event.id, summary: event.summary, followup });
      agent.remember(marker, ['admin', 'meeting-followup-done']);
      agent.remember(`${event.summary}: ${followup}`, ['admin', 'meeting-followup']);
    }

    if (followedUp.length === 0) {
      agent.emit('agent:meeting_followup_complete', {
        taskId: task.id,
        summary: 'No recently ended meetings need a follow-up.',
        followedUp: [],
      });
      return;
    }

    const summary = followedUp.map((f) => `**${f.summary}**\n${f.followup}`).join('\n\n');

    agent.emit('agent:meeting_followup_complete', {
      taskId: task.id,
      summary,
      followedUp,
    });
  },
};
