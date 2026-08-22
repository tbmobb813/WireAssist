export type AgentRole = 'admin' | 'content' | 'research' | 'strategy';
export type AgentStatus = 'idle' | 'running' | 'waiting_approval' | 'error';
export interface AgentConfig {
  role: AgentRole;
  name: string;
  systemPrompt: string;
  tools: string[];
  maxTokens?: number;
  model?: string;
}
export interface AgentTask {
  id: string;
  agentRole: AgentRole;
  description: string;
  status:
    | 'queued'
    | 'running'
    | 'awaiting_approval'
    | 'approved'
    | 'rejected'
    | 'complete'
    | 'failed';
  createdAt: Date;
  updatedAt: Date;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  approvalRequired: boolean;
  approvalAction?: string;
}
//# sourceMappingURL=types.d.ts.map
