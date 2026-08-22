import { randomUUID } from 'crypto';
import type {
  AgentTask,
  ImageAttachment,
  DocumentAttachment,
  ProviderMessage,
} from '@wireassist/core';
import type { Platform } from '@wireassist/trendpost-mcp';
import type { GtmProductInput } from './types';

export const GtmTasks = {
  generateStrategy(
    product: GtmProductInput,
    offerContentDraft?: { platform: Platform; tone?: string },
    offerContentCalendar?: { platforms: Platform[] },
    objectiveId?: string
  ): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'gtm',
      description: `Generate GTM strategy for ${product.name}`,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'generate_gtm', product, offerContentDraft, offerContentCalendar },
      approvalRequired: false,
      objectiveId,
    };
  },

  generatePsychTactics(product: GtmProductInput, objectiveId?: string): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'gtm',
      description: `Generate psych tactics for ${product.name}`,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'generate_psych', product },
      approvalRequired: false,
      objectiveId,
    };
  },

  freeform(
    prompt: string,
    history?: ProviderMessage[],
    objectiveId?: string,
    images?: ImageAttachment[],
    documents?: DocumentAttachment[]
  ): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'gtm',
      description: prompt,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'freeform', prompt, history, images, documents },
      approvalRequired: false,
      objectiveId,
    };
  },
};
