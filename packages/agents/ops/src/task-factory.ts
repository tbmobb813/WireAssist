import { randomUUID } from 'crypto';
import type {
  AgentTask,
  ImageAttachment,
  DocumentAttachment,
  ProviderMessage,
} from '@wireassist/core';
import type { OpsTaskInput } from './nixops-agent';

function baseTask(description: string, input: OpsTaskInput, objectiveId?: string): AgentTask {
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
    objectiveId,
  };
}

export function createWorkflowRunTask(params: {
  workflow: string;
  brief: string;
  description?: string;
  objectiveId?: string;
}): AgentTask {
  return baseTask(
    params.description ?? `Run workflow "${params.workflow}": ${params.brief}`,
    {
      type: 'run_workflow',
      workflow: params.workflow,
      brief: params.brief,
    },
    params.objectiveId
  );
}

export function createOpsFreeformTask(params: {
  prompt: string;
  description?: string;
  history?: ProviderMessage[];
  images?: ImageAttachment[];
  documents?: DocumentAttachment[];
  objectiveId?: string;
}): AgentTask {
  return baseTask(
    params.description ?? params.prompt,
    {
      type: 'freeform',
      prompt: params.prompt,
      history: params.history,
      images: params.images,
      documents: params.documents,
    },
    params.objectiveId
  );
}

export function createTrustGraduationNudgesTask(options?: {
  description?: string;
  objectiveId?: string;
}): AgentTask {
  return baseTask(
    options?.description ?? "Nudge JNix to graduate any workflow's trust stage after a streak.",
    { type: 'trust_graduation_nudges' },
    options?.objectiveId
  );
}
