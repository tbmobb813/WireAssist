import type { AgentRole, AgentTask } from '../agents/types';
import type { ImageAttachment, DocumentAttachment, ProviderMessage } from '../providers/base';
import type { Skill } from './types';

export interface FreeformInput {
  type?: string;
  prompt?: string;
  history?: ProviderMessage[];
  images?: ImageAttachment[];
  documents?: DocumentAttachment[];
}

// Same shape all 6 agents' freeform skills used before this factory existed
// — a task queued as anything other than `type: 'freeform'` (e.g. routed
// through a composite skill) falls back to task.description instead of an
// undefined prompt.
function defaultResolvePrompt(task: AgentTask, input: FreeformInput): string {
  return input.type === 'freeform' && typeof input.prompt === 'string'
    ? input.prompt
    : task.description;
}

function defaultBuildCompletionEvent(params: { task: AgentTask; response: string }): {
  event: string;
  payload: Record<string, unknown>;
} {
  return {
    event: 'agent:freeform_response',
    payload: { taskId: params.task.id, response: params.response },
  };
}

export interface FreeformSkillConfig {
  role: AgentRole;
  description: string;
  // Real per-agent variance (git history shows this needed genuine tuning,
  // not mechanical propagation) — passed straight through to
  // runToolLoop(), omitted entirely (not defaulted to some fixed number)
  // when an agent doesn't set it, matching every agent's own prior behavior.
  maxIterations?: number;
  // Override for the one agent (Ops) whose input shape and prompt-fallback
  // logic differs from the other five's.
  resolvePrompt?: (task: AgentTask, input: FreeformInput) => string;
  // Override for the two agents (GitHub, Ops) whose completion event name
  // and/or payload shape differs from the other four's.
  buildCompletionEvent?: (params: { task: AgentTask; response: string }) => {
    event: string;
    payload: Record<string, unknown>;
  };
  // Override for the one agent (Ops) that assigns task.output before
  // emitting — no other agent does this.
  onBeforeEmit?: (task: AgentTask, response: string) => void;
}

// Modeled on buildDelegateToolSchema()/buildDelegatedFreeformTask()'s
// existing role-parameterized-factory pattern in
// packages/agents/admin/src/delegate.ts — real precedent for a shared
// factory living in a place every agent package already depends on, rather
// than each agent hand-copying near-identical logic (this skill was
// ~70-90% structurally identical across all 6 copies before this factory).
export function createFreeformSkill(config: FreeformSkillConfig): Skill<FreeformInput, void> {
  const resolvePrompt = config.resolvePrompt ?? defaultResolvePrompt;
  const buildCompletionEvent = config.buildCompletionEvent ?? defaultBuildCompletionEvent;

  return {
    name: 'freeform',
    role: config.role,
    description: config.description,

    async execute({ agent, task, input }) {
      const prompt = resolvePrompt(task, input);
      const context = await agent.loadContext(prompt);
      const response = await agent.runToolLoop(task, prompt, {
        extraContext: context,
        priorMessages: input.history,
        images: input.images,
        documents: input.documents,
        ...(config.maxIterations !== undefined ? { maxIterations: config.maxIterations } : {}),
      });

      config.onBeforeEmit?.(task, response);

      const { event, payload } = buildCompletionEvent({ task, response });
      agent.emit(event, payload);
    },
  };
}
