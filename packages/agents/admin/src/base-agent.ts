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
  type ApprovalRequest,
  type Provider,
  type ProviderType,
  type ProviderMessage,
  type ProviderToolCall,
  type ProviderResponse,
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

  // The single entry point for every agent: resolves task.input.type
  // against this agent's SkillRegistry and executes the matching skill (or
  // chain), wrapped in the standard status/lifecycle-event bookkeeping.
  // No concrete agent overrides this anymore — a concrete agent's
  // "personality" is entirely which skills its constructor registers.
  async run(task: AgentTask): Promise<void> {
    if (this.status === 'running') return;

    this.status = 'running';
    this.events.emit('agent:task_started', {
      agentRole: this.role,
      agentName: this.name,
      taskId: task.id,
      description: task.description,
    });

    try {
      const executor = new SkillExecutor(this.skills);
      await executor.run(this.asSkillHandle(), task);

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
      runToolLoop: (task, userMessage, opts) => this.runToolLoop(task, userMessage, opts),
      listDecisions: (params) => this.listDecisions(params),
    };
  }

  // Core reasoning — call Claude with this agent's system prompt.
  // Enforces the monthly budget: refuses new calls once the cap is hit and
  // records actual token usage after every call.
  protected async think(userMessage: string, extraContext?: string): Promise<string> {
    budgetTracker.assertWithinBudget();

    const model = this.resolveModel();
    const response = await this.getProvider().complete({
      prompt: userMessage,
      systemPrompt: this.buildSystemPrompt(extraContext),
      model,
      maxTokens: this.config.maxTokens ?? 2048,
    });

    this.recordUsage(model, response);
    return response.content;
  }

  private buildSystemPrompt(extraContext?: string): string {
    return extraContext
      ? `${this.config.systemPrompt}\n\n---\nCONTEXT:\n${extraContext}`
      : this.config.systemPrompt;
  }

  private recordUsage(model: string, response: ProviderResponse): void {
    if (response.promptTokens !== undefined && response.completionTokens !== undefined) {
      budgetTracker.record(this.role, model, response.promptTokens, response.completionTokens);
    } else if (response.tokensUsed !== undefined) {
      // Provider didn't split input/output (e.g. openai/gemini/ollama today) —
      // charge it all at the pricier output-token rate so the budget cap
      // errs toward stopping spend too early, never too late.
      budgetTracker.record(this.role, model, 0, response.tokensUsed);
    }
  }

  // Multi-turn tool-calling loop: lets the model decide which of its
  // authorized tools to call, executes them, and feeds results back until
  // it returns a final text answer (or the iteration cap is hit). Falls
  // back to a single plain-text think() when the active provider doesn't
  // support tool-calling (only AnthropicProvider does today) or the agent
  // has no toolSchemas configured — chat still answers, just without tools.
  protected async runToolLoop(
    task: AgentTask,
    userMessage: string,
    opts?: { extraContext?: string; maxIterations?: number; priorMessages?: ProviderMessage[] }
  ): Promise<string> {
    const tools = this.config.toolSchemas ? Object.values(this.config.toolSchemas) : [];
    if (this.getProvider().type !== 'anthropic' || tools.length === 0) {
      // think() has no messages-array support — fold prior turns into the
      // context string instead, so conversational memory still survives on
      // non-Anthropic providers rather than silently vanishing.
      return this.think(
        userMessage,
        foldPriorMessagesIntoContext(opts?.priorMessages, opts?.extraContext)
      );
    }

    const maxIterations = opts?.maxIterations ?? 6;
    const model = this.resolveModel();
    const system = this.buildSystemPrompt(opts?.extraContext);
    const messages: ProviderMessage[] = [
      ...(opts?.priorMessages ?? []),
      { role: 'user', content: userMessage },
    ];

    for (let i = 0; i < maxIterations; i++) {
      budgetTracker.assertWithinBudget();
      const response = await this.getProvider().complete({
        prompt: userMessage,
        messages,
        tools,
        systemPrompt: system,
        model,
        maxTokens: this.config.maxTokens ?? 2048,
      });
      this.recordUsage(model, response);

      if (!response.toolCalls?.length) {
        return response.content;
      }

      messages.push({
        role: 'assistant',
        content: response.content,
        toolCalls: response.toolCalls,
      });

      for (const call of response.toolCalls) {
        const { result, isError } = await this.executeToolCall(task, call);
        messages.push({
          role: 'tool_result',
          toolCallId: call.id,
          content: typeof result === 'string' ? result : JSON.stringify(result),
          isError,
        });
      }
    }

    return "I wasn't able to finish this within the allotted steps — here's what I found so far.";
  }

  // Executes one model-chosen tool call. Base behavior is conservative —
  // read-only tools (per isReadOnlyTool()) run immediately, everything else
  // goes through the human approval gate before executing. Subclasses (e.g.
  // AdminAgent) override isReadOnlyTool()/this method to route mutating
  // calls through their own approval policy (e.g. narrow auto-approval).
  protected async executeToolCall(
    task: AgentTask,
    call: ProviderToolCall
  ): Promise<{ result: unknown; isError: boolean }> {
    try {
      if (this.isReadOnlyTool(call.name)) {
        return { result: await this.useTool(call.name, call.input), isError: false };
      }

      const approved = await this.proposeAction(task, `Call tool "${call.name}"`, call.input);
      if (!approved) {
        return { result: 'User declined this action.', isError: true };
      }
      return { result: await this.useTool(call.name, call.input), isError: false };
    } catch (error) {
      return { result: error instanceof Error ? error.message : String(error), isError: true };
    }
  }

  // Conservative default: nothing is read-only unless a subclass says so.
  protected isReadOnlyTool(_toolName: string): boolean {
    return false;
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

  // Approved/rejected decision history from the shared approval queue —
  // omitting agentRole returns history across every agent, not just this
  // one, since approval_queue is one shared table.
  protected listDecisions(params?: { agentRole?: AgentRole; limit?: number }): ApprovalRequest[] {
    return this.approval.getResolved(params);
  }
}

// Renders prior conversation turns as a plain-text transcript prefixed onto
// extraContext, for providers/paths that don't support a real messages
// array (the runToolLoop -> think() fallback).
function foldPriorMessagesIntoContext(
  priorMessages: ProviderMessage[] | undefined,
  extraContext?: string
): string | undefined {
  if (!priorMessages?.length) return extraContext;
  const transcript = priorMessages
    .filter(
      (m): m is Extract<ProviderMessage, { role: 'user' | 'assistant' }> =>
        m.role === 'user' || m.role === 'assistant'
    )
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');
  const header = `Recent conversation:\n${transcript}`;
  return extraContext ? `${header}\n\n${extraContext}` : header;
}
