import { randomUUID } from 'crypto';
import type { AgentTask } from '@wireassist/core';
import type { Platform } from '@wireassist/trendpost-mcp';
import type { GtmProductInput } from './types';

export const GtmTasks = {
  generateStrategy(
    product: GtmProductInput,
    offerContentDraft?: { platform: Platform; tone?: string }
  ): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'gtm',
      description: `Generate GTM strategy for ${product.name}`,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'generate_gtm', product, offerContentDraft },
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
