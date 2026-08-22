import type { AgentRole, AgentTask } from '../agents/types';
import type { ApprovalRequest } from '../approval/types';
import type { ImageAttachment, DocumentAttachment, ProviderMessage } from '../providers/base';

// Narrower than BaseAgent itself — a Skill can reach these, but never
// `config`, `client`, or `status` directly.
export interface SkillAgentHandle {
  think(userMessage: string, extraContext?: string, maxTokensOverride?: number): Promise<string>;
  useTool(toolName: string, params: Record<string, unknown>): Promise<unknown>;
  loadContext(query: string): Promise<string>;
  remember(content: string, tags?: string[]): void;
  proposeAction(
    task: AgentTask,
    action: string,
    payload: Record<string, unknown>
  ): Promise<boolean>;
  emit(event: string, payload: unknown): void;
  // Multi-turn tool-calling loop (see BaseAgent.runToolLoop). Falls back to
  // a plain think() call when the agent's provider doesn't support tool
  // calling or it has no toolSchemas configured — always safe to call.
  runToolLoop(
    task: AgentTask,
    userMessage: string,
    opts?: {
      extraContext?: string;
      maxIterations?: number;
      priorMessages?: ProviderMessage[];
      images?: ImageAttachment[];
      documents?: DocumentAttachment[];
    }
  ): Promise<string>;
  // Approved/rejected decision history — for skills that reflect on
  // patterns in what's been approved vs. rejected over time. Omitting
  // agentRole returns history across every agent, not just this one.
  listDecisions(params?: { agentRole?: AgentRole; limit?: number }): ApprovalRequest[];
  // Still-unresolved approval requests, across every agent — for skills
  // that flag approvals sitting too long without a decision.
  listPending(): ApprovalRequest[];
}

export interface SkillExecutionContext<TInput = unknown> {
  agent: SkillAgentHandle;
  task: AgentTask;
  input: TInput;
}

// One unit of capability — one former `case` branch of a switch statement.
export interface Skill<TInput = unknown, TOutput = unknown> {
  name: string;
  role: AgentRole;
  description: string;
  // Informational only — not enforced by the executor. Skills that need
  // approval call `agent.proposeAction()` themselves inside `execute()`.
  requiresApproval?: boolean;
  execute(ctx: SkillExecutionContext<TInput>): Promise<TOutput>;
}

export interface SkillChainStep<TPrevOutput = unknown, TStepInput = unknown> {
  skill: string;
  mapInput?: (previousOutput: TPrevOutput, task: AgentTask) => TStepInput;
  continueIf?: (previousOutput: TPrevOutput) => boolean;
}

// A fixed pipeline of skills run in sequence.
export interface SkillChain {
  name: string;
  role: AgentRole;
  description: string;
  steps: SkillChainStep[];
}

// Type-inference helper — no runtime behavior.
export function defineSkill<TInput = unknown, TOutput = unknown>(
  skill: Skill<TInput, TOutput>
): Skill<TInput, TOutput> {
  return skill;
}
