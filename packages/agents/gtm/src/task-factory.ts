import { randomUUID } from 'crypto';
import type { AgentTask } from '@wireassist/core';
import type { GtmProductInput } from './types';

export const GtmTasks = {
  generateStrategy(product: GtmProductInput): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'gtm',
      description: `Generate GTM strategy for ${product.name}`,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'generate_gtm', product },
      approvalRequired: false,
    };
  },

  generatePsychTactics(product: GtmProductInput): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'gtm',
      description: `Generate psych tactics for ${product.name}`,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'generate_psych', product },
      approvalRequired: false,
    };
  },
};
