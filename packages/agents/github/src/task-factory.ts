import { randomUUID } from 'crypto';
import type {
  AgentTask,
  ImageAttachment,
  DocumentAttachment,
  ProviderMessage,
} from '@wireassist/core';
import type { StalePrCandidate } from './skills/stale-prs';

export const GitHubTasks = {
  freeform(
    prompt: string,
    history?: ProviderMessage[],
    objectiveId?: string,
    images?: ImageAttachment[],
    documents?: DocumentAttachment[]
  ): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'github',
      description: prompt,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'freeform', prompt, history, images, documents },
      approvalRequired: false,
      objectiveId,
    };
  },

  stalePrs(pullRequests: StalePrCandidate[], daysStale = 5, objectiveId?: string): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'github',
      description: 'Flag open pull requests that have gone too long without an update.',
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'stale_prs_nudge', daysStale, pullRequests },
      approvalRequired: false,
      objectiveId,
    };
  },
};
