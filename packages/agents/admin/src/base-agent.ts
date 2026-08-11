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
  type Provider,
  type ProviderType,
  SkillRegistry,
  SkillExecutor,
  ProviderFactory,
} from '@wireassist/core';

// Single place to move the fleet to a new provider (e.g. OpenRouter): set
// WIREASSIST_PROVIDER in the environment, or pass `provider` in an
// individual agent's config to override. Defaults to talking to Anthropic
// directly, same as before this existed.
export const DEFAULT_PROVIDER = (process.env.WIREASSIST_PROVIDER as ProviderType) ?? 'anthropic';

// Per-provider fallback model, used only when neither WIREASSIST_MODEL nor
// an agent's own config.model is set. A bare "claude-sonnet-5" isn't a
// valid OpenRouter slug; "openrouter/auto" lets OpenRouter pick the best
// underlying model for each request instead of pinning one by default.
const PROVIDER_DEFAULT_MODEL: Partial<Record<ProviderType, string>> = {
  anthropic: 'claude-sonnet-5',
  openrouter: 'openrouter/auto',
};

// Single place to move the fleet to a new model: set WIREASSIST_MODEL in the
// environment, or pass `model` in an individual agent's config to override.
// Falls back to a provider-appropriate default rather than one fixed model
// string, since that string isn't valid across every provider.
export const DEFAULT_MODEL =
  process.env.WIREASSIST_MODEL ?? PROVIDER_DEFAULT_MODEL[DEFAULT_PROVIDER] ?? 'claude-sonnet-5';

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected approval: IApprovalQueue;
  protected memory: MemoryStore;
  protected mcp: MCPClient;
  protected events: EventBus;
  // Constructed lazily on first think() call, not in the constructor — an
  // agent should be constructible without provider credentials on hand
  // (tests routinely do), same as the old raw `new Anthropic()` client this
  // replaced never validated a key until an actual API call was made.
  private _provider?: Provider;
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
    this.skills = deps.skills ?? new SkillRegistry();
  }

  protected getProvider(): Provider {
    if (!this._provider) {
      this._provider = ProviderFactory.create({
        type: this.config.provider ?? DEFAULT_PROVIDER,
        model: this.resolveModel(),
      });
    }
    return this._provider;
  }

  // Resolves the model to use for this agent, provider-aware — an agent
  // that overrides only `config.provider` (not `config.model`) should still
  // get that provider's own default, not the fleet-wide one for whatever
  // provider happens to be globally configured.
  private resolveModel(): string {
    if (this.config.model) return this.config.model;
    if (process.env.WIREASSIST_MODEL) return process.env.WIREASSIST_MODEL;
    const provider = this.config.provider ?? DEFAULT_PROVIDER;
    return PROVIDER_DEFAULT_MODEL[provider] ?? DEFAULT_MODEL;
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

    const model = this.resolveModel();
    const response = await this.getProvider().complete({
      prompt: userMessage,
      systemPrompt: system,
      model,
      maxTokens: this.config.maxTokens ?? 2048,
    });

    if (response.promptTokens !== undefined && response.completionTokens !== undefined) {
      budgetTracker.record(this.role, model, response.promptTokens, response.completionTokens);
    } else if (response.tokensUsed !== undefined) {
      // Provider didn't split input/output (e.g. openai/gemini/ollama today) —
      // charge it all at the pricier output-token rate so the budget cap
      // errs toward stopping spend too early, never too late.
      budgetTracker.record(this.role, model, 0, response.tokensUsed);
    }

    return response.content;
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
