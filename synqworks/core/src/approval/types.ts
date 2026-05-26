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
}
