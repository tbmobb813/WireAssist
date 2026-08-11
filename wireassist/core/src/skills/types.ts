import type { AgentRole, AgentTask } from '../agents/types';

// Narrower than BaseAgent itself — a Skill can reach these, but never
// `config`, `client`, or `status` directly.
export interface SkillAgentHandle {
  think(userMessage: string, extraContext?: string): Promise<string>;
  useTool(toolName: string, params: Record<string, unknown>): Promise<unknown>;
  loadContext(query: string): Promise<string>;
  remember(content: string, tags?: string[]): void;
  proposeAction(
    task: AgentTask,
    action: string,
    payload: Record<string, unknown>
  ): Promise<boolean>;
  emit(event: string, payload: unknown): void;
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
