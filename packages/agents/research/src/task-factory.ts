import { randomUUID } from 'crypto';
import type { AgentTask, ProviderMessage } from '@wireassist/core';
import type { Platform } from '@wireassist/trendpost-mcp';

export const ResearchTasks = {
  researchTopic(
    query: string,
    depth: 'quick' | 'deep' = 'quick',
    offerContentDraft?: { platform: Platform; tone?: string }
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
      },
      approvalRequired: true,
    };
  },

  synthesizeFindings(topic: string): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'research',
      description: `Synthesize findings on: ${topic}`,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'synthesize_findings', topic },
      approvalRequired: true,
    };
  },

  // Chains research_topic -> synthesize_findings via the research_and_synthesize
  // SkillChain (see skills/index.ts) — a same-agent chain demonstration.
  researchAndSynthesize(query: string, depth: 'quick' | 'deep' = 'quick'): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'research',
      description: `Research and synthesize: ${query}`,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'research_and_synthesize', query, resultCount: depth === 'deep' ? 10 : 5 },
      approvalRequired: true,
    };
  },

  freeform(prompt: string, history?: ProviderMessage[]): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'research',
      description: prompt,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'freeform', prompt, history },
      approvalRequired: false,
    };
  },
};
