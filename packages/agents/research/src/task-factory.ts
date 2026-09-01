import { randomUUID } from 'crypto';
import type {
  AgentTask,
  ImageAttachment,
  DocumentAttachment,
  ProviderMessage,
} from '@wireassist/core';
import type { Platform } from '@wireassist/trendpost-mcp';

export const ResearchTasks = {
  researchTopic(
    query: string,
    depth: 'quick' | 'deep' = 'quick',
    offerContentDraft?: { platform: Platform; tone?: string },
    objectiveId?: string,
    offerOpsHandoff?: { workflow: string }
  ): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'research',
      description: `Research: ${query}`,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: {
        type: 'research_topic',
        query,
        depth,
        resultCount: depth === 'deep' ? 10 : 5,
        offerContentDraft,
        offerOpsHandoff,
      },
      approvalRequired: true,
      objectiveId,
    };
  },

  synthesizeFindings(topic: string, objectiveId?: string): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'research',
      description: `Synthesize findings on: ${topic}`,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'synthesize_findings', topic },
      approvalRequired: true,
      objectiveId,
    };
  },

  // Chains research_topic -> synthesize_findings via the research_and_synthesize
  // SkillChain (see skills/index.ts) — a same-agent chain demonstration.
  researchAndSynthesize(
    query: string,
    depth: 'quick' | 'deep' = 'quick',
    objectiveId?: string
  ): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'research',
      description: `Research and synthesize: ${query}`,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'research_and_synthesize', query, resultCount: depth === 'deep' ? 10 : 5 },
      approvalRequired: true,
      objectiveId,
    };
  },

  marketGapDiscovery(
    marketFocus?: string,
    offerOpsHandoff?: { workflow: string },
    objectiveId?: string
  ): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'research',
      description: `Market-gap discovery: ${marketFocus ?? '(default focus)'}`,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'market_gap_discovery', marketFocus, offerOpsHandoff },
      approvalRequired: true,
      objectiveId,
    };
  },

  // Queued by server.ts's agent:content_generated listener when the
  // producing task carries a reviewContext — see review-handoff-output.ts.
  reviewHandoffOutput(input: {
    originalQuery: string;
    researchSummary: string;
    requestedPlatform: string;
    requestedTone?: string;
    producedContent: string;
    contentTaskId: string;
    attempt: number;
  }): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'research',
      description: `Review Content's ${input.requestedPlatform} draft against handoff: ${input.originalQuery}`,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'review_handoff_output', ...input },
      approvalRequired: false,
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
      agentRole: 'research',
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
