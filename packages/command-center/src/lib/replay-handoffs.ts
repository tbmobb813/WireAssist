import type { ApprovalRequest } from '@wireassist/core';
import { logger } from '@wireassist/core/logger';

// Pulled out of server.ts as a pure function, mirroring route-handoff.ts —
// testable without bootstrapping the full server (agents/DB/events bus).
//
// Replays exactly the orphaned approvals that carry a resumeTask: an
// approval that was granted but whose continuation never got the chance to
// run agent:handoff_requested itself (issue #184's failure mode, applied
// specifically to handoffs — see ApprovalRequest.resumeTask). Orphaned
// approvals with no resumeTask (e.g. a plain "store findings" gate) aren't
// handoffs and are left untouched for the existing manual-review flow.
export function replayOrphanedHandoffs(
  orphaned: ApprovalRequest[],
  emitHandoff: (task: NonNullable<ApprovalRequest['resumeTask']>) => void,
  markConsumed: (id: string) => void
): ApprovalRequest[] {
  const replayable = orphaned.filter(
    (a): a is ApprovalRequest & { resumeTask: NonNullable<ApprovalRequest['resumeTask']> } =>
      a.resumeTask !== undefined
  );
  for (const a of replayable) {
    logger.info(
      `↻ Replaying orphaned handoff: "${a.action}" (${a.agentRole} approval ${a.id}) — ` +
        `approved before a restart, never consumed by a live process.`
    );
    emitHandoff(a.resumeTask);
    markConsumed(a.id);
  }
  return replayable;
}
