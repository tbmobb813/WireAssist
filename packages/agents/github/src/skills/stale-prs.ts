import type { Skill } from '@wireassist/core';

// Same bar as admin's stale_approvals_nudge — an item sitting untouched
// this long is "this is stuck," not "still in review."
const DEFAULT_DAYS_STALE = 5;

// SkillAgentHandle.useTool() is unusable here — GitHubAgent's config.tools
// is deliberately empty (see github-agent.ts's constructor comment; GitHub
// calls go through the real MCP client via runToolLoop()/executeToolCall(),
// not the generic useTool() path). So the caller (the API route) fetches
// the open PR list via GitHubAgent.callReadOnlyTool() — the same
// bypass-the-chat-loop mechanism already used for /api/github/repos — and
// hands this skill the raw list; this skill owns the staleness judgment
// and nudge output, matching objective_health_check_nudge's division of
// labor for the same underlying constraint.
export interface StalePrCandidate {
  number: number;
  title: string;
  url: string;
  updatedAt: string;
}

export interface StalePrsInput {
  daysStale?: number;
  pullRequests: StalePrCandidate[];
}

export interface StalePr {
  number: number;
  title: string;
  url: string;
  daysStale: number;
}

export const stalePrsSkill: Skill<StalePrsInput, void> = {
  name: 'stale_prs_nudge',
  role: 'github',
  description: 'Flag open pull requests that have gone too long without an update.',

  async execute({ agent, task, input }) {
    const daysStale = input.daysStale ?? DEFAULT_DAYS_STALE;
    const now = Date.now();

    const stale: StalePr[] = input.pullRequests
      .map((pr) => ({
        number: pr.number,
        title: pr.title,
        url: pr.url,
        daysStale: Math.floor((now - new Date(pr.updatedAt).getTime()) / (24 * 60 * 60 * 1000)),
      }))
      .filter((pr) => pr.daysStale >= daysStale);

    if (stale.length === 0) {
      agent.emit('agent:stale_prs_complete', {
        taskId: task.id,
        summary: 'No open pull requests have gone stale.',
        stale: [],
      });
      return;
    }

    // Deterministic, not think()-phrased — same reasoning as
    // objective_health_check_nudge: keeps the route usable with no
    // ANTHROPIC_API_KEY set.
    const list = stale
      .map((pr) => `- #${pr.number} "${pr.title}" — no update in ${pr.daysStale}d (${pr.url})`)
      .join('\n');
    const summary = `${stale.length} open pull request${stale.length === 1 ? ' has' : 's have'} gone stale:\n${list}`;

    agent.emit('agent:stale_prs_complete', {
      taskId: task.id,
      summary,
      stale,
    });
  },
};
