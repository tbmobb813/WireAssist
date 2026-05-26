import Anthropic, { type TextBlock } from '@anthropic-ai/sdk';
import {
  type AgentConfig,
  type AgentRole,
  type AgentTask,
  type AgentStatus,
  type ApprovalQueue,
  type MemoryStore,
  type MCPClient,
  type EventBus,
} from '@synqworks/core';

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected approval: ApprovalQueue;
  protected memory: MemoryStore;
  protected mcp: MCPClient;
  protected events: EventBus;
  protected client: Anthropic;
  public status: AgentStatus = 'idle';

  constructor(
    config: AgentConfig,
    deps: {
      approval: ApprovalQueue;
      memory: MemoryStore;
      mcp: MCPClient;
      events: EventBus;
    }
  ) {
    this.config = config;
    this.approval = deps.approval;
    this.memory = deps.memory;
    this.mcp = deps.mcp;
    this.events = deps.events;
    this.client = new Anthropic();
  }

  get role(): AgentRole {
    return this.config.role;
  }

  get name(): string {
    return this.config.name;
  }

  abstract run(task: AgentTask): Promise<void>;

  // Core reasoning — call Claude with this agent's system prompt
  protected async think(userMessage: string, extraContext?: string): Promise<string> {
    const system = extraContext
      ? `${this.config.systemPrompt}\n\n---\nCONTEXT:\n${extraContext}`
      : this.config.systemPrompt;

    const response = await this.client.messages.create({
      model: this.config.model ?? 'claude-sonnet-4-20250514',
      max_tokens: this.config.maxTokens ?? 2048,
      system,
      messages: [{ role: 'user', content: userMessage }],
    });

    return response.content
      .filter((b): b is TextBlock => b.type === 'text')
      .map(b => b.text)
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

    return approved;
  }

  // Call an MCP tool — Gmail, Calendar, etc.
  protected async useTool(
    toolName: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    if (!this.config.tools.includes(toolName)) {
      throw new Error(
        `Agent "${this.name}" is not authorized to use tool: ${toolName}`
      );
    }
    return this.mcp.call(toolName, params);
  }

  // Pull relevant memories for context
  protected loadContext(query: string): string {
    const memories = this.memory.search(query, { agentRole: this.role });
    if (memories.length === 0) return '';
    return memories.map(m => m.content).join('\n\n');
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
