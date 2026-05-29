import { randomUUID } from 'crypto';
import type { AgentTask } from '@synqworks/core';

export const ResearchTasks = {
  researchTopic(query: string, depth: 'quick' | 'deep' = 'quick'): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'research',
      description: `Research: ${query}`,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'research_topic', query, depth, resultCount: depth === 'deep' ? 10 : 5 },
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
};
