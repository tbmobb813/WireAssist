import type { AgentRole } from '../agents/types';

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
}

export interface IApprovalQueue {
  request(params: {
    taskId: string;
    agentRole: AgentRole;
    action: string;
    payload: Record<string, unknown>;
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
