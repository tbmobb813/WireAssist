import {
  type AgentConfig,
  type AgentTask,
  type IApprovalQueue,
  type MemoryStore,
  type MCPClient,
  type EventBus,
} from '@synqworks/core';
import { BaseAgent } from '@synqworks/agent-admin';
import type { Platform } from '@synqworks/synqpost-mcp';

const CONTENT_SYSTEM_PROMPT = `You are the Content Agent for SynqWorks.
You help solo operators build a consistent, authentic content presence.

PRINCIPLES:
- Quality over quantity. One great post beats five mediocre ones.
- You understand the operator's business deeply before generating content.
- You NEVER post without explicit human approval.
- You learn what content performs well and apply it to future work.
- You coordinate with the Admin Agent — if there's a product launch or event, you create content for it.

YOUR CAPABILITIES:
- Generate single posts for any platform
- Create weekly content plans
- Analyze and improve existing content
- Schedule approved posts
- Track what's been posted and what's coming up`;

export class ContentAgent extends BaseAgent {
  constructor(deps: {
    approval: IApprovalQueue;
    memory: MemoryStore;
    mcp: MCPClient;
    events: EventBus;
  }) {
    const config: AgentConfig = {
      role: 'content',
      name: 'Content Agent',
      systemPrompt: CONTENT_SYSTEM_PROMPT,
      tools: [
        'content_generate',
        'content_generate_plan',
        'content_schedule_post',
        'content_list_posts',
        'content_delete_post',
        'content_list_ideas',
        'content_analyze',
      ],
      model: 'claude-sonnet-4-20250514',
      maxTokens: 4096,
    };
    super(config, deps);
  }

  async run(task: AgentTask): Promise<void> {
    if (this.status === 'running') return;

    this.status = 'running';
    this.events.emit('agent:task_started', {
      agentRole: this.role,
      taskId: task.id,
      description: task.description,
    });

    try {
      switch (task.input.type) {
        case 'generate_post':
          await this.generatePost(task);
          break;
        case 'generate_plan':
          await this.generatePlan(task);
          break;
        case 'schedule_post':
          await this.schedulePost(task);
          break;
        case 'analyze_post':
          await this.analyzePost(task);
          break;
        case 'list_scheduled':
          await this.listScheduled(task);
          break;
        default:
          await this.handleFreeform(task);
      }

      this.status = 'idle';
      this.events.emit('agent:task_complete', {
        agentRole: this.role,
        taskId: task.id,
      });
    } catch (error) {
      this.status = 'error';
      this.events.emit('agent:task_failed', {
        agentRole: this.role,
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // ─── GENERATE SINGLE POST ─────────────────────────────────────

  private async generatePost(task: AgentTask): Promise<void> {
    const { topic, platform, tone } = task.input as {
      topic: string;
      platform: Platform;
      tone?: string;
    };

    const context = await this.loadContext('business description products services audience');

    const result = await this.useTool('content_generate', {
      topic, platform, tone, context,
    }) as { content: string; platform: string; topic: string };

    this.events.emit('agent:content_generated', {
      taskId: task.id,
      ...result,
    });

    const analysis = await this.useTool('content_analyze', {
      content: result.content,
      platform,
    }) as { score: number; estimatedEngagement: string; suggestion: string };

    const approved = await this.proposeAction(
      task,
      `Post to ${platform}: "${result.content.slice(0, 80)}..."`,
      { content: result.content, platform, analysis }
    );

    if (approved) {
      this.remember(
        `Generated approved ${platform} post about: ${topic}`,
        ['content', 'approved', platform]
      );
      this.events.emit('agent:content_approved', {
        taskId: task.id,
        content: result.content,
        platform,
      });
    } else {
      this.remember(
        `User rejected ${platform} post about: ${topic}. May need different angle.`,
        ['content', 'rejected', platform]
      );
    }
  }

  // ─── GENERATE WEEKLY PLAN ─────────────────────────────────────

  private async generatePlan(task: AgentTask): Promise<void> {
    const { platforms, weeksAhead = 1, postsPerWeek = 3 } = task.input as {
      platforms: Platform[];
      weeksAhead?: number;
      postsPerWeek?: number;
    };

    const businessContext = await this.loadContext('business description products services recent news');

    const result = await this.useTool('content_generate_plan', {
      businessContext: businessContext || 'Solo business operator',
      platforms,
      weeksAhead,
      postsPerWeek,
    }) as { ideas: unknown[]; totalGenerated: number };

    this.events.emit('agent:content_plan_generated', {
      taskId: task.id,
      ideas: result.ideas,
      totalGenerated: result.totalGenerated,
    });

    const approved = await this.proposeAction(
      task,
      `Approve content plan: ${result.totalGenerated} posts across ${platforms.join(', ')}`,
      { ideas: result.ideas }
    );

    if (approved) {
      this.remember(
        `Approved content plan: ${result.totalGenerated} posts for ${platforms.join(', ')}`,
        ['content', 'plan', 'approved']
      );
    }
  }

  // ─── SCHEDULE AN APPROVED POST ────────────────────────────────

  private async schedulePost(task: AgentTask): Promise<void> {
    const { content, platform, scheduledAt, tags } = task.input as {
      content: string;
      platform: Platform;
      scheduledAt: string;
      tags?: string[];
    };

    const approved = await this.proposeAction(
      task,
      `Schedule ${platform} post for ${new Date(scheduledAt).toLocaleDateString()}`,
      { content, platform, scheduledAt }
    );

    if (!approved) return;

    const post = await this.useTool('content_schedule_post', {
      content, platform, scheduledAt, tags,
    });

    this.events.emit('agent:post_scheduled', { taskId: task.id, post });
    this.remember(
      `Scheduled ${platform} post for ${scheduledAt}: "${content.slice(0, 60)}..."`,
      ['content', 'scheduled', platform]
    );
  }

  // ─── ANALYZE POST ─────────────────────────────────────────────

  private async analyzePost(task: AgentTask): Promise<void> {
    const { content, platform } = task.input as { content: string; platform: Platform };

    const analysis = await this.useTool('content_analyze', { content, platform });

    this.events.emit('agent:content_analyzed', {
      taskId: task.id,
      content,
      platform,
      analysis,
    });
  }

  // ─── LIST SCHEDULED ───────────────────────────────────────────

  private async listScheduled(task: AgentTask): Promise<void> {
    const posts = await this.useTool('content_list_posts', {
      daysAhead: (task.input as { daysAhead?: number }).daysAhead ?? 14,
    });

    this.events.emit('agent:scheduled_posts', { taskId: task.id, posts });
  }

  // ─── FREEFORM ─────────────────────────────────────────────────

  private async handleFreeform(task: AgentTask): Promise<void> {
    const context = await this.loadContext(task.description);
    const response = await this.think(task.description, context);
    this.events.emit('agent:freeform_response', { taskId: task.id, response });
  }
}
