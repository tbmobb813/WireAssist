import type { Skill } from '@wireassist/core';
import type { GmailThread } from '../types';

const DEFAULT_DAYS_STALE = 3;
// Cap the sent-mail lookback window so a large sent folder doesn't blow up
// token/API usage — anything older than this isn't "still waiting," it's
// just old.
const LOOKBACK_DAYS = 30;

export interface FollowUpNudgesInput {
  daysStale?: number;
}

interface StaleThread {
  threadId: string;
  from: string;
  subject: string;
  daysSinceLastMessage: number;
}

export const followUpNudgesSkill: Skill<FollowUpNudgesInput, void> = {
  name: 'follow_up_nudges',
  role: 'admin',
  description:
    'Find sent threads where the last message was from Jason and nobody has replied in N days, and propose a follow-up nudge for each.',

  async execute({ agent, task, input }) {
    const daysStale = input.daysStale ?? DEFAULT_DAYS_STALE;

    const profile = (await agent.useTool('gmail_get_profile', {})) as { emailAddress: string };
    const ownEmail = profile.emailAddress.toLowerCase();

    const threads = (await agent.useTool('gmail_search', {
      q: `in:sent newer_than:${LOOKBACK_DAYS}d`,
      maxResults: 50,
    })) as GmailThread[];

    const now = Date.now();
    const staleThreads: StaleThread[] = [];

    for (const thread of threads) {
      const lastMessage = (await agent.useTool('gmail_thread_last_message', {
        threadId: thread.id,
      })) as { from: string; date: string } | null;
      if (!lastMessage) continue;

      const fromIsMe = lastMessage.from.toLowerCase().includes(ownEmail);
      if (!fromIsMe) continue; // most recent reply came from the other side

      const lastMessageDate = new Date(lastMessage.date);
      if (Number.isNaN(lastMessageDate.getTime())) continue;

      const daysSince = Math.floor((now - lastMessageDate.getTime()) / (24 * 60 * 60 * 1000));
      if (daysSince < daysStale) continue;

      staleThreads.push({
        threadId: thread.id,
        from: lastMessage.from,
        subject: thread.snippet.slice(0, 80),
        daysSinceLastMessage: daysSince,
      });
    }

    agent.emit('agent:follow_up_nudges_complete', {
      taskId: task.id,
      staleThreads,
    });

    if (staleThreads.length === 0) return;

    const context = await agent.loadContext('email tone follow-up nudge preferences');

    for (const stale of staleThreads) {
      const draftPrompt = `Draft a short, polite follow-up check-in for this thread — Jason sent the
last message ${stale.daysSinceLastMessage} days ago and hasn't heard back. Keep it brief, low-
pressure, and in Jason's voice. Just the email body, no subject line.

Thread snippet: ${stale.subject}
Recipient: ${stale.from}`;

      const draftBody = await agent.think(draftPrompt, context);

      const approved = await agent.proposeAction(
        task,
        `Follow-up nudge: "${stale.subject}" (${stale.daysSinceLastMessage}d, no reply)`,
        { threadId: stale.threadId, body: draftBody }
      );

      if (approved) {
        await agent.useTool('gmail_create_draft', { threadId: stale.threadId, body: draftBody });
        agent.remember(`Drafted follow-up nudge for thread with ${stale.from}`, [
          'email',
          'follow-up',
          'approved',
        ]);
      }
    }
  },
};
