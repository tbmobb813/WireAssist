import type { Skill } from '@wireassist/core';

// Same bar as stale_approvals_nudge's DEFAULT_DAYS_STALE, but longer —
// objectives drift slower than an individual approval sitting unread.
const DEFAULT_DAYS_STALE = 5;

// SkillAgentHandle has no store-backed accessor for Objectives (unlike
// listPending(), which is backed by ApprovalQueue) — Objectives is a
// command-center-only data layer today. So the caller (the API route) does
// the ObjectiveStore I/O and hands this skill the raw per-objective
// "when did it last see activity" list; this skill owns the actual
// judgment call (which of those counts as stale) and the nudge output,
// matching every other nudge skill's division of labor as closely as that
// constraint allows.
export interface ObjectiveHealthCheckCandidate {
  id: string;
  title: string;
  latestEventAt: number | null;
}

export interface ObjectiveHealthCheckInput {
  daysStale?: number;
  objectives: ObjectiveHealthCheckCandidate[];
}

export interface StaleObjective {
  id: string;
  title: string;
  daysSinceActivity: number | null;
}

export const objectiveHealthCheckSkill: Skill<ObjectiveHealthCheckInput, void> = {
  name: 'objective_health_check_nudge',
  role: 'admin',
  description:
    'Flag active Objectives that have gone quiet — no agent activity recorded against them in too long.',

  async execute({ agent, task, input }) {
    const daysStale = input.daysStale ?? DEFAULT_DAYS_STALE;
    const now = Date.now();

    const stale: StaleObjective[] = input.objectives
      .map((o) => ({
        id: o.id,
        title: o.title,
        daysSinceActivity:
          o.latestEventAt === null
            ? null
            : Math.floor((now - o.latestEventAt) / (24 * 60 * 60 * 1000)),
      }))
      // No activity ever recorded is stale by definition; otherwise compare
      // against the threshold like every other days-since nudge.
      .filter((o) => o.daysSinceActivity === null || o.daysSinceActivity >= daysStale);

    if (stale.length === 0) {
      agent.emit('agent:objective_health_check_complete', {
        taskId: task.id,
        summary: 'Every active Objective has seen recent activity.',
        stale: [],
      });
      return;
    }

    // Deterministic, not think()-phrased — see this skill's PR description
    // for why: it keeps the route usable with no ANTHROPIC_API_KEY set,
    // matching publish_due_posts' precedent instead of stale_approvals'.
    const list = stale
      .map(
        (o) =>
          `- "${o.title}" — ${o.daysSinceActivity === null ? 'no activity recorded yet' : `quiet for ${o.daysSinceActivity}d`}`
      )
      .join('\n');
    const summary = `${stale.length} active Objective${stale.length === 1 ? ' has' : 's have'} gone quiet:\n${list}`;

    agent.emit('agent:objective_health_check_complete', {
      taskId: task.id,
      summary,
      stale,
    });
  },
};
