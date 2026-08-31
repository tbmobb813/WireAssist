import type { Skill } from '@wireassist/core';

// Same bar as follow_up_nudges' DEFAULT_DAYS_STALE — 3 days without a
// decision is "this is stuck," not "still being reviewed."
const DEFAULT_DAYS_STALE = 3;

// The "Approval Backlog Watcher" idea (drafted six separate times before
// being built — see issue history) asked for a nudge once the pending
// COUNT crosses a threshold, independent of any single item's age: a pile
// of 20 approvals all created ten minutes ago wouldn't trip the age check
// above, but is still a backlog forming. Both signals matter; this file
// checks both rather than being two separate skills.
const DEFAULT_BACKLOG_THRESHOLD = 5;

export interface StaleApprovalsInput {
  daysStale?: number;
  backlogThreshold?: number;
}

export interface StaleApproval {
  id: string;
  agentRole: string;
  action: string;
  daysPending: number;
}

export interface OrphanedApproval {
  id: string;
  agentRole: string;
  action: string;
}

export const staleApprovalsSkill: Skill<StaleApprovalsInput, void> = {
  name: 'stale_approvals_nudge',
  role: 'admin',
  description:
    'Flag approval requests stuck in three ways: sitting pending too long, piled up past a ' +
    'count threshold regardless of age, or already approved but never acted on (a restart ' +
    'orphaned them — see issue #184).',

  async execute({ agent, task, input }) {
    const daysStale = input.daysStale ?? DEFAULT_DAYS_STALE;
    const backlogThreshold = input.backlogThreshold ?? DEFAULT_BACKLOG_THRESHOLD;
    const now = Date.now();

    const pending = agent.listPending();

    const stale: StaleApproval[] = pending
      .map((p) => ({
        id: p.id,
        agentRole: p.agentRole,
        action: p.action,
        daysPending: Math.floor((now - new Date(p.createdAt).getTime()) / (24 * 60 * 60 * 1000)),
      }))
      .filter((p) => p.daysPending >= daysStale);

    const orphaned: OrphanedApproval[] = agent.listOrphanedApprovals().map((p) => ({
      id: p.id,
      agentRole: p.agentRole,
      action: p.action,
    }));

    const backlogSize = pending.length;
    const overThreshold = backlogSize >= backlogThreshold;

    if (stale.length === 0 && orphaned.length === 0 && !overThreshold) {
      agent.emit('agent:stale_approvals_complete', {
        taskId: task.id,
        summary: 'No approvals have been sitting stale.',
        stale: [],
        orphaned: [],
      });
      return;
    }

    const sections: string[] = [];
    if (stale.length > 0) {
      sections.push(
        `STUCK PENDING (${daysStale}+ days without a decision):\n` +
          stale
            .map((s) => `- (${s.agentRole}) "${s.action}" — pending ${s.daysPending}d`)
            .join('\n')
      );
    }
    if (overThreshold) {
      sections.push(
        `BACKLOG SIZE: ${backlogSize} approvals currently pending (threshold: ${backlogThreshold}) — ` +
          `even the fresh ones are piling up faster than they're being reviewed.`
      );
    }
    if (orphaned.length > 0) {
      sections.push(
        `APPROVED BUT NEVER RUN (a restart orphaned these — the approval was granted, but no ` +
          `process was left alive to act on it; re-trigger manually if still needed):\n` +
          orphaned.map((o) => `- (${o.agentRole}) "${o.action}"`).join('\n')
      );
    }

    const summary = await agent.think(
      `Write a short, direct paragraph for Jason covering the approval-queue problems below. Be ` +
        `concrete about what's wrong and what he should do — no generic "you might want to review ` +
        `your approvals" filler. If more than one section is present, cover all of them, but keep it tight.\n\n` +
        sections.join('\n\n')
    );

    agent.emit('agent:stale_approvals_complete', {
      taskId: task.id,
      summary,
      stale,
      orphaned,
    });
  },
};
