import { randomUUID } from 'crypto';
import type { AgentTask } from '@wireassist/core';
import type { OpsTaskInput } from './nixops-agent';

function baseTask(description: string, input: OpsTaskInput): AgentTask {
  const now = new Date();
  return {
    id: randomUUID(),
    agentRole: 'strategy',
    description,
    status: 'queued',
    createdAt: now,
    updatedAt: now,
    input: input as unknown as Record<string, unknown>,
    approvalRequired: true,
  };
}

export function createWorkflowRunTask(params: {
  workflow: string;
  brief: string;
  description?: string;
}): AgentTask {
  return baseTask(params.description ?? `Run workflow "${params.workflow}": ${params.brief}`, {
    type: 'run_workflow',
    workflow: params.workflow,
    brief: params.brief,
  });
}

export function createOpsFreeformTask(params: { prompt: string; description?: string }): AgentTask {
  return baseTask(params.description ?? params.prompt, {
    type: 'freeform',
    prompt: params.prompt,
  });
}
