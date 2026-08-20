import { randomUUID } from 'crypto';
import type { AgentTask, ImageAttachment, ProviderMessage } from '@wireassist/core';

export const GitHubTasks = {
  freeform(
    prompt: string,
    history?: ProviderMessage[],
    objectiveId?: string,
    images?: ImageAttachment[]
  ): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'github',
      description: prompt,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'freeform', prompt, history, images },
      approvalRequired: false,
      objectiveId,
    };
  },
};
