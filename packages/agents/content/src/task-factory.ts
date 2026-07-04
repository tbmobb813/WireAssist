import { randomUUID } from 'crypto';
import type { AgentTask } from '@wireassist/core';
import type { Platform } from '@wireassist/trendpost-mcp';

export const ContentTasks = {
  generatePost(topic: string, platform: Platform, tone?: string): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'content',
      description: `Generate ${platform} post about: ${topic}`,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'generate_post', topic, platform, tone },
      approvalRequired: true,
    };
  },

  generatePlan(platforms: Platform[], weeksAhead = 1, postsPerWeek = 3): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'content',
      description: `Generate ${weeksAhead}-week content plan for ${platforms.join(', ')}`,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'generate_plan', platforms, weeksAhead, postsPerWeek },
      approvalRequired: true,
    };
  },

  schedulePost(
    content: string,
    platform: Platform,
    scheduledAt: string,
    tags?: string[]
  ): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'content',
      description: `Schedule ${platform} post for ${new Date(scheduledAt).toLocaleDateString()}`,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'schedule_post', content, platform, scheduledAt, tags },
      approvalRequired: true,
    };
  },

  analyzePost(content: string, platform: Platform): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'content',
      description: `Analyze ${platform} post quality`,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'analyze_post', content, platform },
      approvalRequired: false,
    };
  },

  listScheduled(daysAhead = 14): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'content',
      description: `List scheduled posts for next ${daysAhead} days`,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'list_scheduled', daysAhead },
      approvalRequired: false,
    };
  },
};
