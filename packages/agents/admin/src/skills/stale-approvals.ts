import type { Skill } from '@wireassist/core';

// Same bar as follow_up_nudges' DEFAULT_DAYS_STALE — 3 days without a
// decision is "this is stuck," not "still being reviewed."
const DEFAULT_DAYS_STALE = 3;

export interface StaleApprovalsInput {
  daysStale?: number;
}

export interface StaleApproval {
  id: string;
  agentRole: string;
  action: string;
  daysPending: number;
}

export const staleApprovalsSkill: Skill<StaleApprovalsInput, void> = {
  name: 'stale_approvals_nudge',
  role: 'admin',
  description:
    'Flag approval requests that have been sitting pending for too long without a decision.',

  async execute({ agent, task, input }) {
    const daysStale = input.daysStale ?? DEFAULT_DAYS_STALE;
    const now = Date.now();

    const stale: StaleApproval[] = agent
      .listPending()
      .map((p) => ({
        id: p.id,
        agentRole: p.agentRole,
        action: p.action,
        daysPending: Math.floor((now - new Date(p.createdAt).getTime()) / (24 * 60 * 60 * 1000)),
      }))
      .filter((p) => p.daysPending >= daysStale);

    if (stale.length === 0) {
      agent.emit('agent:stale_approvals_complete', {
        taskId: task.id,
        summary: 'No approvals have been sitting stale.',
        stale: [],
      });
      return;
    }

    const list = stale
      .map((s) => `- (${s.agentRole}) "${s.action}" — pending ${s.daysPending}d`)
      .join('\n');

    const summary = await agent.think(
      `Write a short, direct paragraph for Jason listing these approval requests that have been ` +
        `sitting unresolved too long. Name each one and how long it's been waiting, and nudge him ` +
        `to go decide — no generic "you might want to review your approvals" filler.\n\n` +
        `STALE APPROVALS:\n${list}`
    );

    agent.emit('agent:stale_approvals_complete', {
      taskId: task.id,
      summary,
      stale,
    });
  },
};
