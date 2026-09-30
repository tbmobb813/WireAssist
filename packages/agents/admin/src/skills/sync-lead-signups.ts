import type { Skill } from '@wireassist/core';

export interface SyncLeadSignupsInput {}

export const syncLeadSignupsSkill: Skill<SyncLeadSignupsInput, void> = {
  name: 'sync_lead_signups',
  role: 'admin',
  description:
    "Pull the last 24h of signups from the lead-capture-service's leads table into today's " +
    'scoreboard totals.',

  // No agent.think() — mechanical fetch-and-record, same reasoning as
  // agent-content's check_post_metrics/sync_scoreboard_metrics.
  async execute({ agent, task }) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    let count: number;
    try {
      const result = (await agent.useTool('fetch_lead_signups', { sinceISO: since })) as {
        count: number;
      };
      count = result.count;
    } catch (err) {
      // Missing/misconfigured Supabase credentials is expected until JNix
      // sets them up (see docs/DEPLOYMENT.md) — record nothing rather than
      // writing a misleading 0, and say why in the summary instead of
      // throwing (this is a scheduled sweep, not a chat request that
      // should surface an error to a waiting user).
      agent.emit('agent:sync_lead_signups_complete', {
        taskId: task.id,
        summary: `Couldn't reach the leads source: ${err instanceof Error ? err.message : String(err)}`,
        synced: false,
      });
      return;
    }

    const date = new Date().toISOString().slice(0, 10);
    await agent.useTool('record_metric', {
      date,
      source: 'leads',
      metric: 'signups',
      value: count,
    });

    agent.emit('agent:sync_lead_signups_complete', {
      taskId: task.id,
      summary: `Synced ${count} lead signup(s) in the last 24h.`,
      synced: true,
      count,
    });
  },
};
