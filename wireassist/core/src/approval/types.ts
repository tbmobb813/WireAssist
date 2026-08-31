import type { AgentRole } from '../agents/types';
import type { AgentTask } from '../agents/types';

export interface ApprovalRequest {
  id: string;
  taskId: string;
  agentRole: AgentRole;
  action: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  resolvedAt?: Date;
  /** Set the moment a live process observed status='approved' — see ApprovalQueue.getOrphanedApprovals(). */
  consumedAt?: Date;
  /** Set when a restart auto-rejects a stale pending/orphaned row — distinguishes that from a human rejection. */
  resolutionNote?: string;
  /**
   * A fully-formed AgentTask to hand off if this request gets approved,
   * captured at proposal time rather than built inside the continuation
   * that runs after approval. Without this, an approval whose continuation
   * never got the chance to run (issue #184's exact failure mode) is lost
   * for good — this is what makes it recoverable: a restart can re-emit
   * the handoff itself from durable state instead of just flagging that
   * one went missing. See ApprovalQueue.getOrphanedApprovals() and
   * server.ts's replay of orphaned approvals that carry one of these.
   */
  resumeTask?: AgentTask;
}

export interface IApprovalQueue {
  request(params: {
    taskId: string;
    agentRole: AgentRole;
    action: string;
    payload: Record<string, unknown>;
    resumeTask?: AgentTask;
  }): Promise<boolean>;
  resolve(id: string, approved: boolean): void;
  getPending(): ApprovalRequest[];
  // Approved but never observed by a live process — see ApprovalQueue's
  // implementation for why this can happen and why age alone can't detect
  // it (issue #184).
  getOrphanedApprovals(): ApprovalRequest[];
  // Approved/rejected history, most recently resolved first — for agents
  // reflecting on patterns in what's been approved vs. rejected over time.
  getResolved(params?: { agentRole?: AgentRole; limit?: number }): ApprovalRequest[];
}
