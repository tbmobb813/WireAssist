import type { ProviderType } from '../types';
import type { ProviderToolDefinition } from '../providers/base';

export type AgentRole = 'admin' | 'content' | 'research' | 'strategy' | 'gtm' | 'github';

export type AgentStatus = 'idle' | 'running' | 'waiting_approval' | 'error';

export interface AgentConfig {
  role: AgentRole;
  name: string;
  systemPrompt: string;
  tools: string[];
  maxTokens?: number;
  model?: string;
  // Which @wireassist/core Provider to route through. Defaults to 'anthropic'
  // (see DEFAULT_PROVIDER in BaseAgent) — set this or WIREASSIST_PROVIDER to
  // route through OpenRouter or another provider instead.
  provider?: ProviderType;
  // LLM-facing name/description/JSON-schema for each entry in `tools`, used
  // by BaseAgent.runToolLoop() to let the model choose which tool to call.
  // Only tools with both a config.tools entry AND a schema here are ever
  // offered to the model — `tools` stays the authorization boundary
  // (enforced in useTool()), this is purely presentation.
  toolSchemas?: Record<string, ProviderToolDefinition>;
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
  // Optional tag linking this task to a cross-agent Objective (see
  // wireassist/core/src/objectives/store.ts). Purely a coordination/tracking
  // tag — never required, never enforced.
  objectiveId?: string;
  // Chain of agent roles this task has already passed through via
  // delegate_to_agent, oldest first — used only to cap/guard chain depth so
  // a delegation chain can't ping-pong forever. Never required, never
  // enforced outside the delegation path itself.
  delegationChain?: AgentRole[];
}
