import { randomUUID } from 'crypto';
import type { AgentTask, ProviderMessage } from '@wireassist/core';

export const GitHubTasks = {
  freeform(prompt: string, history?: ProviderMessage[], objectiveId?: string): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'github',
      description: prompt,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'freeform', prompt, history },
      approvalRequired: false,
      objectiveId,
    };
  },
};
