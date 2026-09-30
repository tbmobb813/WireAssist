import type { Skill } from '@wireassist/core';

interface MetricRow {
  date: string;
  source: string;
  metric: string;
  value: number;
}

export interface ScoreboardDigestInput {}

function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export const scoreboardDigestSkill: Skill<ScoreboardDigestInput, void> = {
  name: 'scoreboard_digest',
  role: 'admin',
  description:
    'Weekly synthesis over every scoreboard source (content engagement, lead signups): what ' +
    'moved, any real win, and one suggested next action.',

  // Unlike the mechanical sync skills (sync_scoreboard_metrics,
  // sync_lead_signups), this always calls think() — same reasoning as
  // content_retro: a quiet week with nothing new is still worth a real
  // note, not silence.
  async execute({ agent, task }) {
    const thisWeek = (await agent.useTool('list_metrics', {
      from: isoDaysAgo(7),
    })) as MetricRow[];
    const lastWeek = (await agent.useTool('list_metrics', {
      from: isoDaysAgo(14),
      to: isoDaysAgo(8),
    })) as MetricRow[];

    if (thisWeek.length === 0) {
      const summary = await agent.think(
        'No scoreboard data has been recorded in the last 7 days. Write a short, direct note ' +
          'for Jason about this — likely means the sync crons (sync_scoreboard_metrics, ' +
          "sync_lead_signups) aren't running yet or just got set up. Don't invent numbers."
      );
      agent.emit('agent:scoreboard_digest_complete', { taskId: task.id, summary, hasData: false });
      return;
    }

    // Group by source::metric — content_* metrics are cumulative running
    // totals as of each day (sync_scoreboard_metrics re-sums everything
    // known each run), so the latest day's value is what matters; leads
    // signups is a per-day count (last-24h at sync time), so the sum
    // across the window is what matters. Both are included per group so
    // the model can pick correctly rather than guess — explained in the
    // prompt below, not silently computed one way.
    const group = (rows: MetricRow[]): Map<string, MetricRow[]> => {
      const m = new Map<string, MetricRow[]>();
      for (const r of rows) {
        const key = `${r.source}::${r.metric}`;
        const list = m.get(key) ?? [];
        list.push(r);
        m.set(key, list);
      }
      return m;
    };

    const thisWeekGrouped = group(thisWeek);
    const lastWeekGrouped = group(lastWeek);

    const lines = [...thisWeekGrouped.entries()].map(([key, rows]) => {
      const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
      const latest = sorted[sorted.length - 1].value;
      const sum = sorted.reduce((s, r) => s + r.value, 0);
      const priorSorted = (lastWeekGrouped.get(key) ?? []).sort((a, b) =>
        a.date.localeCompare(b.date)
      );
      const priorLatest = priorSorted[priorSorted.length - 1]?.value;
      return (
        `- ${key}: latest value ${latest}, sum over the last 7 days ${sum}` +
        (priorLatest !== undefined
          ? ` (prior week's latest value: ${priorLatest})`
          : ' (no data from the prior week to compare)')
      );
    });

    const summary = await agent.think(
      `Write a short, direct weekly scoreboard digest for Jason. For content_* metrics, the ` +
        `meaningful number is "latest value" (a cumulative running total, not additive across ` +
        `days). For leads::signups, the meaningful number is "sum over the last 7 days" (each ` +
        `day's value is that day's new signups, not a running total). Identify anything that's a ` +
        `real win (e.g. signups up meaningfully week over week), anything flat or declining, and ` +
        `one concrete suggested action — no filler, no generic "keep monitoring" advice.\n\n` +
        `SCOREBOARD DATA:\n${lines.join('\n')}`
    );

    agent.emit('agent:scoreboard_digest_complete', { taskId: task.id, summary, hasData: true });
    agent.remember(`Scoreboard digest:\n\n${summary}`, ['scoreboard', 'digest']);
  },
};
