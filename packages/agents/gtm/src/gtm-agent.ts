import {
  type AgentConfig,
  type AgentTask,
  type IApprovalQueue,
  type MemoryStore,
  type MCPClient,
  type EventBus,
} from '@wireassist/core';
import { BaseAgent } from '@wireassist/agent-admin';
import { buildGtmPrompt, buildPsychPrompt } from './prompts';
import type { GtmProductInput, GtmStrategy, GtmPsychPrinciple } from './types';

const GTM_SYSTEM_PROMPT = `You are the GTM Agent for WireAssist.
You turn a founder's raw product description into a concrete, executable go-to-market
plan and a set of behavioral-psychology tactics tailored to that specific product.

PRINCIPLES:
- Zero generic advice. Every recommendation must reference the actual product name,
  actual competitors, actual buyer, and actual price given to you.
- Output only what was asked for — valid JSON, no markdown fences, no preamble.
- You never take real-world action (no posting, no sending) — you only generate
  strategy and copy for the founder to review and use themselves.`;

function extractJson<T>(raw: string): T {
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean) as T;
}

export class GtmAgent extends BaseAgent {
  constructor(deps: {
    approval: IApprovalQueue;
    memory: MemoryStore;
    mcp: MCPClient;
    events: EventBus;
  }) {
    const config: AgentConfig = {
      role: 'gtm',
      name: 'GTM Agent',
      systemPrompt: GTM_SYSTEM_PROMPT,
      tools: [],
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
        case 'generate_gtm':
          await this.generateStrategy(task);
          break;
        case 'generate_psych':
          await this.generatePsychTactics(task);
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

  // ─── GTM STRATEGY ──────────────────────────────────────────────

  private async generateStrategy(task: AgentTask): Promise<void> {
    const { product } = task.input as { product: GtmProductInput };

    const raw = await this.think(buildGtmPrompt(product));
    const gtm = extractJson<GtmStrategy>(raw);

    this.events.emit('agent:gtm_generated', { taskId: task.id, gtm });
    this.remember(`Generated GTM strategy for ${product.name}`, ['gtm', 'strategy']);
  }

  // ─── PSYCH TACTICS ─────────────────────────────────────────────

  private async generatePsychTactics(task: AgentTask): Promise<void> {
    const { product } = task.input as { product: GtmProductInput };

    const raw = await this.think(buildPsychPrompt(product));
    const psych = extractJson<GtmPsychPrinciple[]>(raw);

    this.events.emit('agent:gtm_psych_generated', { taskId: task.id, psych });
    this.remember(`Generated psych tactics for ${product.name}`, ['gtm', 'psych']);
  }

  // ─── FREEFORM ──────────────────────────────────────────────────

  private async handleFreeform(task: AgentTask): Promise<void> {
    const context = await this.loadContext(task.description);
    const response = await this.think(task.description, context);
    this.events.emit('agent:freeform_response', { taskId: task.id, response });
  }
}
