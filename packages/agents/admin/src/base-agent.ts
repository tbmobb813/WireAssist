import Anthropic, { type TextBlock } from '@anthropic-ai/sdk';
import { budgetTracker } from './budget';
import {
  type AgentConfig,
  type AgentRole,
  type AgentTask,
  type AgentStatus,
  type IApprovalQueue,
  type MemoryStore,
  type MCPClient,
  type EventBus,
  type SkillAgentHandle,
  SkillRegistry,
  SkillExecutor,
} from '@wireassist/core';

// Single place to move the fleet to a new model: set WIREASSIST_MODEL in the
// environment, or pass `model` in an individual agent's config to override.
export const DEFAULT_MODEL = process.env.WIREASSIST_MODEL ?? 'claude-sonnet-5';

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected approval: IApprovalQueue;
  protected memory: MemoryStore;
  protected mcp: MCPClient;
  protected events: EventBus;
  protected client: Anthropic;
  protected skills: SkillRegistry;
  public status: AgentStatus = 'idle';

  constructor(
    config: AgentConfig,
    deps: {
      approval: IApprovalQueue;
      memory: MemoryStore;
      mcp: MCPClient;
      events: EventBus;
      skills?: SkillRegistry;
    }
  ) {
    this.config = config;
    this.approval = deps.approval;
    this.memory = deps.memory;
    this.mcp = deps.mcp;
    this.events = deps.events;
    this.client = new Anthropic();
    this.skills = deps.skills ?? new SkillRegistry();
  }

  get role(): AgentRole {
    return this.config.role;
  }

  get name(): string {
    return this.config.name;
  }

  // Default dispatch — resolves task.input.type against this agent's
  // SkillRegistry. Subclasses with their own switch-based run() (the
  // pre-skills pattern) simply override this and never call it.
  async run(task: AgentTask): Promise<void> {
    const executor = new SkillExecutor(this.skills);
    await executor.run(this.asSkillHandle(), task);
  }

  // Binds this agent's protected methods into the narrower handle a Skill
  // is allowed to see — no access to config/client/status.
  protected asSkillHandle(): SkillAgentHandle {
    return {
      think: (userMessage, extraContext) => this.think(userMessage, extraContext),
      useTool: (toolName, params) => this.useTool(toolName, params),
      loadContext: (query) => this.loadContext(query),
      remember: (content, tags) => this.remember(content, tags),
      proposeAction: (task, action, payload) => this.proposeAction(task, action, payload),
      emit: (event, payload) => this.events.emit(event, payload),
    };
  }

  // Core reasoning — call Claude with this agent's system prompt.
  // Enforces the monthly budget: refuses new calls once the cap is hit and
  // records actual token usage after every call.
  protected async think(userMessage: string, extraContext?: string): Promise<string> {
    budgetTracker.assertWithinBudget();

    const system = extraContext
      ? `${this.config.systemPrompt}\n\n---\nCONTEXT:\n${extraContext}`
      : this.config.systemPrompt;

    const model = this.config.model ?? DEFAULT_MODEL;
    const response = await this.client.messages.create({
      model,
      max_tokens: this.config.maxTokens ?? 2048,
      system,
      messages: [{ role: 'user', content: userMessage }],
    });

    if (response.usage) {
      budgetTracker.record(
        this.role,
        model,
        response.usage.input_tokens,
        response.usage.output_tokens
      );
    }

    return response.content
      .filter((b): b is TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
  }

  // Propose an action — pauses and waits for human approval
  protected async proposeAction(
    task: AgentTask,
    action: string,
    payload: Record<string, unknown>
  ): Promise<boolean> {
    this.status = 'waiting_approval';

    this.events.emit('agent:waiting_approval', {
      agentRole: this.role,
      agentName: this.name,
      taskId: task.id,
      action,
      payload,
    });

    const approved = await this.approval.request({
      taskId: task.id,
      agentRole: this.role,
      action,
      payload,
    });

    this.status = approved ? 'running' : 'idle';

    this.events.emit('agent:approval_resolved', {
      agentRole: this.role,
      taskId: task.id,
      approved,
    });

    this.remember(`task=${task.id} action=${action} -> ${approved ? 'APPROVED' : 'REJECTED'}`, [
      'trace',
      'proposeAction',
      approved ? 'approved' : 'rejected',
    ]);

    return approved;
  }

  // Call an MCP tool — Gmail, Calendar, etc.
  protected async useTool(toolName: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.config.tools.includes(toolName)) {
      throw new Error(`Agent "${this.name}" is not authorized to use tool: ${toolName}`);
    }
    return this.mcp.call(toolName, params);
  }

  // Pull relevant memories for context
  protected async loadContext(query: string): Promise<string> {
    try {
      const memories = await this.memory.searchAsync(query, {
        agentRole: this.role,
        excludeTags: ['trace'],
      });
      if (memories.length === 0) return '';
      return memories.map((m) => m.content).join('\n\n');
    } catch {
      return '';
    }
  }

  // Persist something to shared memory
  protected remember(content: string, tags: string[] = []): void {
    this.memory.store({
      content,
      agentRole: this.role,
      tags,
      createdAt: new Date(),
    });
  }
}
