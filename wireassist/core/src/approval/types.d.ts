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
//# sourceMappingURL=types.d.ts.map
