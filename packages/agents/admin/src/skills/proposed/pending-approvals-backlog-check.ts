import type { Skill } from '@wireassist/core';

export interface PendingApprovalsBacklogCheckInput {
  threshold?: number;
}

export interface PendingApprovalsBacklogCheckOutput {
  pendingCount: number;
  flagged: boolean;
}

export const pendingApprovalsBacklogCheckSkill: Skill<
  PendingApprovalsBacklogCheckInput,
  PendingApprovalsBacklogCheckOutput
> = {
  name: 'pending_approvals_backlog_check',
  role: 'admin',
  description:
    'Checks how many approvals are still pending, and if the count exceeds a threshold (default 5), saves a memory note flagging it as a backlog worth reviewing. Intended to run as a periodic self-check.',

  async execute({ agent, input }) {
    const threshold = input.threshold ?? 5;

    const pending = agent.listPending();
    const pendingCount = pending.length;

    if (pendingCount > threshold) {
      const summary = pending
        .slice(0, 10)
        .map((p: any) => `- ${p.description ?? p.action ?? p.id ?? '(unlabeled item)'}`)
        .join('\n');

      agent.remember(
        `Pending approvals backlog: ${pendingCount} items awaiting approval (threshold ${threshold}). ` +
          `Worth reviewing so nothing important gets stuck. Sample:\n${summary}`,
        ['backlog', 'pending_approvals', 'self_check']
      );

      return { pendingCount, flagged: true };
    }

    return { pendingCount, flagged: false };
  },
};
