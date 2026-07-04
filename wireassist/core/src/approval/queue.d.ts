import type { ApprovalRequest } from './types';
import type { AgentRole } from '../agents/types';
export declare class ApprovalQueue {
  private db;
  constructor(dbPath: string);
  private init;
  request(params: {
    taskId: string;
    agentRole: AgentRole;
    action: string;
    payload: Record<string, unknown>;
  }): Promise<boolean>;
  resolve(id: string, approved: boolean): void;
  getPending(): ApprovalRequest[];
}
//# sourceMappingURL=queue.d.ts.map
