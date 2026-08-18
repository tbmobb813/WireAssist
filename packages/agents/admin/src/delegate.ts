import { randomUUID } from 'crypto';
import type { AgentRole, AgentTask, ProviderMessage } from '@wireassist/core';

export const DELEGATABLE_ROLES = ['content', 'research', 'strategy', 'gtm', 'github'] as const;
export type DelegatableRole = (typeof DELEGATABLE_ROLES)[number];

const ROLE_LABELS: Record<DelegatableRole, string> = {
  content: 'Content',
  research: 'Research',
  strategy: 'NixOps',
  gtm: 'GTM',
  github: 'GitHub Dev',
};

export function isDelegatableRole(value: unknown): value is DelegatableRole {
  return typeof value === 'string' && (DELEGATABLE_ROLES as readonly string[]).includes(value);
}

export function roleLabel(role: DelegatableRole): string {
  return ROLE_LABELS[role];
}

// Builds a freeform AgentTask for another agent, matching the exact shape
// every agent's own Tasks.freeform() factory already produces. Built inline
// here rather than importing each sibling package's factory, since every
// one of those packages already depends on @wireassist/agent-admin for
// BaseAgent — importing them back would create a circular workspace
// dependency.
export function buildDelegatedFreeformTask(
  targetRole: DelegatableRole,
  prompt: string,
  history?: ProviderMessage[],
  objectiveId?: string
): AgentTask {
  return {
    id: randomUUID(),
    agentRole: targetRole as AgentRole,
    description: prompt,
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'freeform', prompt, history },
    approvalRequired: false,
    objectiveId,
  };
}
