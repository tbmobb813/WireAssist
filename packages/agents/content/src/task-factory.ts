import { randomUUID } from 'crypto';
import type {
  AgentTask,
  ImageAttachment,
  DocumentAttachment,
  ProviderMessage,
} from '@wireassist/core';
import type { Platform } from '@wireassist/trendpost-mcp';
import type { TimelineWeekInput } from './skills/generate-plan-from-timeline';

export const ContentTasks = {
  // account: which specific brand/account (e.g. "techtrendwire",
  // "mindtype_studio", "nixlevel") this content is for — appended as the
  // last param on every one of these builders specifically so no existing
  // positional call site has to change. See generate-plan.ts's
  // GeneratePlanInput.account for why this field exists at all.
  generatePost(
    topic: string,
    platform: Platform,
    tone?: string,
    extraContext?: string,
    objectiveId?: string,
    account?: string
  ): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'content',
      description: `Generate ${platform} post about: ${topic}`,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'generate_post', topic, platform, tone, extraContext, account },
      approvalRequired: true,
      objectiveId,
    };
  },

  generatePlan(
    platforms: Platform[],
    weeksAhead = 1,
    postsPerWeek = 3,
    businessContext?: string,
    objectiveId?: string,
    account?: string
  ): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'content',
      description: `Generate ${weeksAhead}-week content plan for ${platforms.join(', ')}`,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: {
        type: 'generate_plan',
        platforms,
        weeksAhead,
        postsPerWeek,
        businessContext,
        account,
      },
      approvalRequired: true,
      objectiveId,
    };
  },

  generateAndScheduleCampaign(
    platforms: Platform[],
    weeksAhead = 1,
    postsPerWeek = 3,
    businessContext?: string,
    objectiveId?: string,
    account?: string
  ): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'content',
      description: `Generate and schedule ${weeksAhead}-week campaign for ${platforms.join(', ')}`,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: {
        type: 'generate_and_schedule_campaign',
        platforms,
        weeksAhead,
        postsPerWeek,
        businessContext,
        account,
      },
      approvalRequired: true,
      objectiveId,
    };
  },

  schedulePost(
    content: string,
    platform: Platform,
    scheduledAt: string,
    tags?: string[],
    objectiveId?: string,
    account?: string
  ): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'content',
      description: `Schedule ${platform} post for ${new Date(scheduledAt).toLocaleDateString()}`,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'schedule_post', content, platform, scheduledAt, tags, account },
      approvalRequired: true,
      objectiveId,
    };
  },

  analyzePost(content: string, platform: Platform, objectiveId?: string): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'content',
      description: `Analyze ${platform} post quality`,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'analyze_post', content, platform },
      approvalRequired: false,
      objectiveId,
    };
  },

  listScheduled(daysAhead = 14, objectiveId?: string): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'content',
      description: `List scheduled posts for next ${daysAhead} days`,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'list_scheduled', daysAhead },
      approvalRequired: false,
      objectiveId,
    };
  },

  generatePlanFromTimeline(
    productName: string,
    timeline: TimelineWeekInput[],
    platforms: Platform[],
    objectiveId?: string
  ): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'content',
      description: `Generate content calendar from launch timeline for ${productName}`,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'generate_plan_from_timeline', productName, timeline, platforms },
      approvalRequired: true,
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
      agentRole: 'content',
      description: prompt,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'freeform', prompt, history, images, documents },
      approvalRequired: false,
      objectiveId,
    };
  },

  publishDuePosts(objectiveId?: string): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'content',
      description: 'Publish scheduled posts whose time has arrived',
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'publish_due_posts' },
      approvalRequired: false,
      objectiveId,
    };
  },

  contentRetro(daysAgo = 30, objectiveId?: string): AgentTask {
    return {
      id: randomUUID(),
      agentRole: 'content',
      description: `Content performance retro over the last ${daysAgo} days`,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'content_retro', daysAgo },
      approvalRequired: false,
      objectiveId,
    };
  },
};
