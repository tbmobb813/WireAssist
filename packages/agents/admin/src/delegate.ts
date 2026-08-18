import { randomUUID } from 'crypto';
import type {
  AgentRole,
  AgentTask,
  ProviderMessage,
  ProviderToolDefinition,
} from '@wireassist/core';

export const ALL_AGENT_ROLES: AgentRole[] = [
  'admin',
  'content',
  'research',
  'strategy',
  'gtm',
  'github',
];

const ROLE_LABELS: Record<AgentRole, string> = {
  admin: 'Admin',
  content: 'Content',
  research: 'Research',
  strategy: 'NixOps',
  gtm: 'GTM',
  github: 'GitHub Dev',
};

export const DELEGATE_TOOL_NAME = 'delegate_to_agent';

// Total hops allowed in one delegation chain — guards against runaway
// chains even without an exact cycle (A->B->C->D->...).
export const MAX_DELEGATION_DEPTH = 3;

export function isValidDelegationTarget(value: unknown, selfRole: AgentRole): value is AgentRole {
  return (
    typeof value === 'string' && value !== selfRole && (ALL_AGENT_ROLES as string[]).includes(value)
  );
}

export function roleLabel(role: AgentRole): string {
  return ROLE_LABELS[role];
}

// Tool schema is built per-agent (the enum excludes the calling agent's own
// role) and called before super() in each agent's constructor — so this
// stays a plain function, not a BaseAgent method (this isn't available yet
// at that point in the constructor).
export function buildDelegateToolSchema(selfRole: AgentRole): ProviderToolDefinition {
  const targets = ALL_AGENT_ROLES.filter((r) => r !== selfRole);
  return {
    name: DELEGATE_TOOL_NAME,
    description:
      'Hand this request off to another WireAssist agent to actually produce the deliverable — ' +
      'a real post (Content), web research (Research), a business workflow run (NixOps), a ' +
      'go-to-market strategy (GTM), GitHub repo work (GitHub Dev), or email/calendar work ' +
      '(Admin) — instead of just describing what could be done. Use this whenever fulfilling ' +
      "the request well needs that agent's own tools/skills, not something you can already do " +
      "yourself. Requires human approval before the other agent starts. The target agent won't " +
      'see this conversation, so give it a self-contained prompt.',
    inputSchema: {
      type: 'object',
      properties: {
        targetRole: {
          type: 'string',
          enum: targets,
          description: 'Which agent to hand off to.',
        },
        prompt: { type: 'string', description: 'Self-contained instruction for the target agent.' },
      },
      required: ['targetRole', 'prompt'],
    },
  };
}

// Loop guard: refuse if the target is already in the chain (an exact cycle,
// e.g. A->B->A) or the chain has already hit MAX_DELEGATION_DEPTH hops (a
// runaway chain even without an exact cycle, e.g. A->B->C->D->...).
export function delegationGuardError(
  chain: AgentRole[] | undefined,
  target: AgentRole
): string | null {
  const c = chain ?? [];
  if (c.includes(target)) {
    return `Cannot delegate to ${roleLabel(target)} — already part of this chain (${c
      .map(roleLabel)
      .join(' → ')}), would create a loop.`;
  }
  if (c.length >= MAX_DELEGATION_DEPTH) {
    return `Cannot delegate further — this chain has already passed through ${c.length} agents (${c
      .map(roleLabel)
      .join(' → ')}).`;
  }
  return null;
}

// Builds a freeform AgentTask for another agent, matching the exact shape
// every agent's own Tasks.freeform() factory already produces. Built inline
// here rather than importing each sibling package's factory, since every
// one of those packages already depends on @wireassist/agent-admin for
// BaseAgent — importing them back would create a circular workspace
// dependency.
export function buildDelegatedFreeformTask(
  sourceTask: AgentTask,
  targetRole: AgentRole,
  prompt: string,
  history?: ProviderMessage[]
): AgentTask {
  return {
    id: randomUUID(),
    agentRole: targetRole,
    description: prompt,
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'freeform', prompt, history },
    approvalRequired: false,
    objectiveId: sourceTask.objectiveId,
    delegationChain: [...(sourceTask.delegationChain ?? []), sourceTask.agentRole],
  };
}
