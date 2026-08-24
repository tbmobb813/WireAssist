import { budgetTracker, BudgetTracker } from './budget';
import {
  type AgentConfig,
  type AgentRole,
  type AgentTask,
  type AgentStatus,
  type IApprovalQueue,
  type MemoryStore,
  type MemoryEntry,
  type MCPClient,
  type EventBus,
  type SkillAgentHandle,
  type ApprovalRequest,
  type Provider,
  type ProviderType,
  type ProviderMessage,
  type ProviderContentBlock,
  type ImageAttachment,
  type DocumentAttachment,
  type ProviderToolCall,
  type ProviderResponse,
  type ProviderCompletionOptions,
  SkillRegistry,
  SkillExecutor,
  ProviderFactory,
  ProviderHttpError,
} from '@wireassist/core';
import {
  isValidDelegationTarget,
  delegationGuardError,
  roleLabel,
  buildDelegatedFreeformTask,
} from './delegate';

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

  // Lazily constructs an OpenRouter provider to fail over to when the
  // primary is Anthropic — undefined (no fallback attempted) when
  // OPENROUTER_API_KEY isn't set, or the primary isn't Anthropic (no
  // fallback chain for other primaries; this is specifically "don't let an
  // Anthropic outage take the platform down", not a general N-provider
  // failover framework).
  private _fallbackProvider?: Provider;
  private getFallbackProvider(): Provider | undefined {
    if (this.getProvider().type !== 'anthropic' || !process.env.OPENROUTER_API_KEY) {
      return undefined;
    }
    if (!this._fallbackProvider) {
      this._fallbackProvider = ProviderFactory.create({ type: 'openrouter' });
    }
    return this._fallbackProvider;
  }

  // Wraps a single provider.complete() call with automatic, per-call
  // failover: on a retryable failure from the primary (outage/rate-limit/
  // network — see isRetryableProviderError()), transparently retries once
  // via OpenRouter routed to the same underlying Claude model, so an
  // Anthropic outage doesn't take every agent down. Not sticky — the next
  // call still tries the primary first, so a recovered primary is used
  // again immediately.
  protected async completeWithFallback(
    options: ProviderCompletionOptions
  ): Promise<ProviderResponse> {
    try {
      return await this.getProvider().complete(options);
    } catch (error) {
      if (!isRetryableProviderError(error)) throw error;
      // OpenRouter's PDF support varies too much per underlying model to
      // trust uniformly (unlike vision, which nearly every OpenRouter model
      // handles the same way) — silently retrying without the document
      // could produce a confidently wrong answer that ignores what the user
      // attached. Surface the original error instead of degrading silently.
      if (hasDocumentAttachment(options.messages)) throw error;
      const fallback = this.getFallbackProvider();
      if (!fallback) throw error;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[${this.role}] Anthropic call failed (${message}) — retrying via OpenRouter`);
      return await fallback.complete({
        ...options,
        model: toOpenRouterModel(options.model ?? this.resolveModel()),
      });
    }
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
      objectiveId: task.objectiveId,
    });

    try {
      const executor = new SkillExecutor(this.skills);
      await executor.run(this.asSkillHandle(), task);

      this.status = 'idle';
      this.events.emit('agent:task_complete', {
        agentRole: this.role,
        taskId: task.id,
        objectiveId: task.objectiveId,
      });
    } catch (error) {
      this.status = 'error';
      this.events.emit('agent:task_failed', {
        agentRole: this.role,
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error),
        objectiveId: task.objectiveId,
      });
      throw error;
    }
  }

  // Binds this agent's protected methods into the narrower handle a Skill
  // is allowed to see — no access to config/client/status.
  protected asSkillHandle(): SkillAgentHandle {
    return {
      think: (userMessage, extraContext, maxTokensOverride) =>
        this.think(userMessage, extraContext, maxTokensOverride),
      useTool: (toolName, params) => this.useTool(toolName, params),
      loadContext: (query) => this.loadContext(query),
      remember: (content, tags) => this.remember(content, tags),
      proposeAction: (task, action, payload) => this.proposeAction(task, action, payload),
      emit: (event, payload) => this.events.emit(event, payload),
      runToolLoop: (task, userMessage, opts) => this.runToolLoop(task, userMessage, opts),
      listDecisions: (params) => this.listDecisions(params),
      listPending: () => this.listPending(),
      listMemories: (params) => this.listMemories(params),
    };
  }

  // Core reasoning — call Claude with this agent's system prompt.
  // Enforces the monthly budget: refuses new calls once the cap is hit and
  // records actual token usage after every call.
  protected async think(
    userMessage: string,
    extraContext?: string,
    maxTokensOverride?: number
  ): Promise<string> {
    const model = this.resolveModel();
    // Per-call override for stages whose output genuinely needs more room
    // than the agent's default (e.g. NixOps re-emitting a full article
    // as one JSON blob) — the default stays put for every other call.
    const maxTokens = maxTokensOverride ?? this.config.maxTokens ?? 2048;
    // Rough input-token estimate (chars/4 is a standard approximation, not
    // a real tokenizer) plus this call's own output ceiling — checking
    // against the worst case this call could cost, not just current spend,
    // closes the overshoot gap between "checked before" and "recorded
    // after" (see assertWithinBudget's own comment).
    const estimatedNextCallCost = BudgetTracker.estimateCost(
      model,
      Math.ceil((userMessage.length + (extraContext?.length ?? 0)) / 4),
      maxTokens
    );
    budgetTracker.assertWithinBudget(estimatedNextCallCost);

    const response = await this.completeWithFallback({
      prompt: userMessage,
      systemPrompt: this.buildSystemPrompt(extraContext),
      model,
      maxTokens,
    });

    // response.model, not the pre-resolved `model` — completeWithFallback()
    // may have served this via OpenRouter under a different model string.
    this.recordUsage(response.model || model, response);
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
  // support tool-calling (Provider.supportsTools) or the agent has no
  // toolSchemas configured — chat still answers, just without tools.
  protected async runToolLoop(
    task: AgentTask,
    userMessage: string,
    opts?: {
      extraContext?: string;
      maxIterations?: number;
      priorMessages?: ProviderMessage[];
      images?: ImageAttachment[];
      documents?: DocumentAttachment[];
    }
  ): Promise<string> {
    const tools = this.config.toolSchemas ? Object.values(this.config.toolSchemas) : [];
    if (!this.getProvider().supportsTools || tools.length === 0) {
      // think() has no messages-array support — fold prior turns into the
      // context string instead, so conversational memory still survives on
      // non-Anthropic providers rather than silently vanishing. Attachments
      // can't survive that fold either, and this path is only ever reached
      // by providers that also lack vision/document support today, so note
      // the drop rather than silently discarding what the user attached.
      return this.think(
        buildUserMessageWithAttachmentNote(
          userMessage,
          opts?.images,
          opts?.documents,
          this.getProvider().type
        ),
        foldPriorMessagesIntoContext(opts?.priorMessages, opts?.extraContext)
      );
    }

    const maxIterations = opts?.maxIterations ?? 6;
    const model = this.resolveModel();
    const system = this.buildSystemPrompt(opts?.extraContext);
    const messages: ProviderMessage[] = [
      ...(opts?.priorMessages ?? []),
      {
        role: 'user',
        content: buildUserTurnContent(
          userMessage,
          opts?.images,
          opts?.documents,
          this.getProvider()
        ),
      },
    ];

    const maxTokens = this.config.maxTokens ?? 2048;
    for (let i = 0; i < maxIterations; i++) {
      // Same worst-case-estimate reasoning as think() — approximate this
      // iteration's prompt size (system + accumulated messages, which grow
      // each iteration as tool results are appended) rather than just
      // checking spend-so-far against the cap.
      const messagesLength = messages.reduce(
        (sum, m) => sum + (typeof m.content === 'string' ? m.content.length : 0),
        0
      );
      const estimatedNextCallCost = BudgetTracker.estimateCost(
        model,
        Math.ceil((system.length + messagesLength) / 4),
        maxTokens
      );
      budgetTracker.assertWithinBudget(estimatedNextCallCost);
      const response = await this.completeWithFallback({
        prompt: userMessage,
        messages,
        tools,
        systemPrompt: system,
        model,
        maxTokens,
      });
      // response.model, not the pre-resolved `model` — completeWithFallback()
      // may have served this via OpenRouter under a different model string.
      this.recordUsage(response.model || model, response);

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

  // Shared delegate_to_agent handler — every agent dispatches to this from
  // its own executeToolCall() override before its tool-specific branches
  // (see delegate.ts's DELEGATE_TOOL_NAME). Validates the target, applies
  // the loop guard, proposes approval, then builds the delegated task and
  // emits agent:handoff_requested — route-handoff.ts/server.ts's consumer
  // (already generic across all six agent roles) takes it from there.
  protected async executeDelegateToAgent(
    task: AgentTask,
    call: ProviderToolCall
  ): Promise<{ result: unknown; isError: boolean }> {
    const { targetRole, prompt } = call.input as { targetRole?: unknown; prompt?: unknown };
    if (
      !isValidDelegationTarget(targetRole, this.role) ||
      typeof prompt !== 'string' ||
      !prompt.trim()
    ) {
      return { result: 'delegate_to_agent requires a valid targetRole and prompt.', isError: true };
    }

    const guardError = delegationGuardError(task.delegationChain, targetRole);
    if (guardError) {
      return { result: guardError, isError: true };
    }

    const approved = await this.proposeAction(
      task,
      `Hand off to ${roleLabel(targetRole)} agent: ${prompt.trim().slice(0, 100)}`,
      { targetRole, prompt: prompt.trim() }
    );
    if (!approved) {
      return { result: 'User declined the handoff.', isError: true };
    }

    const history = (task.input as { history?: ProviderMessage[] } | undefined)?.history;
    const delegatedTask = buildDelegatedFreeformTask(task, targetRole, prompt.trim(), history);
    this.events.emit('agent:handoff_requested', { task: delegatedTask });
    return {
      result: `Handed off to the ${roleLabel(targetRole)} agent (task ${delegatedTask.id}). They'll work on it separately — check their tab or Approvals for the result.`,
      isError: false,
    };
  }

  // Invokes one of this agent's own registered Skills — or SkillChains — as
  // a step inside a tool-calling loop (see AdminAgent/ResearchAgent's
  // executeToolCall() overrides) — the mechanism that lets a multi-step
  // plan compose an agent's higher-level capabilities (e.g. email_triage,
  // research_topic, or a whole chain like research_and_synthesize)
  // alongside raw MCP tool calls, not just one or the other.
  //
  // Delegates to SkillExecutor rather than resolving a single Skill
  // directly, so a registered SkillChain is composable here too — for a
  // chain, SkillExecutor.run() loops its steps (threading previousOutput
  // via mapInput, respecting continueIf) against the same handle below.
  //
  // Every candidate skill communicates its real result via agent.emit()
  // rather than a return value, so this wraps emit() to capture the last
  // payload while still forwarding to the real event bus — dashboard/SSE/
  // Telegram listeners see the same events they always did. For a chain,
  // each step emits in turn, so the capture naturally ends up holding the
  // *last* step's payload — the chain's meaningful final result.
  //
  // Deliberately NOT exposed on SkillAgentHandle: a skill must never be
  // able to invoke another skill or chain (recursion risk). Only
  // BaseAgent's own executeToolCall() overrides may call this.
  protected async invokeSkill(
    parentTask: AgentTask,
    skillName: string,
    input: Record<string, unknown>
  ): Promise<unknown> {
    if (!this.skills.resolve(this.role, skillName)) {
      throw new Error(`Unknown skill: ${skillName}`);
    }

    const subTask: AgentTask = { ...parentTask, input: { type: skillName, ...input } };
    let captured: unknown;
    const handle: SkillAgentHandle = {
      ...this.asSkillHandle(),
      emit: (event, payload) => {
        captured = payload;
        this.events.emit(event, payload);
      },
    };

    await new SkillExecutor(this.skills).run(handle, subTask);
    return captured;
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
      objectiveId: task.objectiveId,
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
      objectiveId: task.objectiveId,
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

  // Still-unresolved approval requests, across every agent — same
  // shared-table reasoning as listDecisions() above.
  protected listPending(): ApprovalRequest[] {
    return this.approval.getPending();
  }

  // Recent memories carrying at least one of the given tags, across every
  // agent — see MemoryStore.listByTags() for why this needs its own query
  // rather than filtering loadContext()'s relevance search.
  protected listMemories(params?: { tags?: string[]; limit?: number }): MemoryEntry[] {
    const limit = params?.limit ?? 50;
    return params?.tags?.length
      ? this.memory.listByTags(params.tags, limit)
      : this.memory.listRecent(limit);
  }
}

// A user turn's content is a plain string, except when it carries an image
// (see ProviderContentBlock) — extracts just the text for paths that only
// deal in plain strings.
function textOnly(content: string | ProviderContentBlock[]): string {
  if (typeof content === 'string') return content;
  return content
    .filter((b): b is Extract<ProviderContentBlock, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join(' ');
}

// Renders prior conversation turns as a plain-text transcript prefixed onto
// extraContext, for providers/paths that don't support a real messages
// array (the runToolLoop -> think() fallback). Images in a prior user turn
// are dropped here — this path is only reached by providers that don't
// support vision either, so there's nothing useful to preserve.
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
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${textOnly(m.content)}`)
    .join('\n');
  const header = `Recent conversation:\n${transcript}`;
  return extraContext ? `${header}\n\n${extraContext}` : header;
}

// Builds the current turn's user message content for the real tool-calling
// loop: an attachment-bearing ProviderContentBlock[] (images/documents first,
// then text — see anthropic.ts's toAnthropicUserContent for why) for
// whichever attachment kinds the active provider supports; any kind it
// doesn't support gets a visible drop-note instead of silently vanishing.
// Images and documents are independent — a provider can support one without
// the other (OpenRouter: vision yes, documents no).
function buildUserTurnContent(
  userMessage: string,
  images: ImageAttachment[] | undefined,
  documents: DocumentAttachment[] | undefined,
  provider: Provider
): string | ProviderContentBlock[] {
  const usableImages = provider.supportsVision ? (images ?? []) : [];
  const usableDocuments = provider.supportsDocuments ? (documents ?? []) : [];
  const droppedImages = provider.supportsVision ? 0 : (images?.length ?? 0);
  const droppedDocuments = provider.supportsDocuments ? 0 : (documents?.length ?? 0);

  if (usableImages.length === 0 && usableDocuments.length === 0) {
    return droppedImages || droppedDocuments
      ? attachmentDropNote(userMessage, droppedImages, droppedDocuments, provider.type)
      : userMessage;
  }

  const text =
    droppedImages || droppedDocuments
      ? attachmentDropNote(userMessage, droppedImages, droppedDocuments, provider.type)
      : userMessage;

  return [
    ...usableImages.map((img): ProviderContentBlock => ({ type: 'image', ...img })),
    ...usableDocuments.map((doc): ProviderContentBlock => ({ type: 'document', ...doc })),
    { type: 'text', text },
  ];
}

// Same visible-degrade note, for the runToolLoop -> think() fallback path
// (think() only ever takes a plain string, never content blocks) — every
// attachment is dropped here since this path is only reached by providers
// that also lack tool-calling, and none of those support vision/documents.
function buildUserMessageWithAttachmentNote(
  userMessage: string,
  images: ImageAttachment[] | undefined,
  documents: DocumentAttachment[] | undefined,
  providerType: ProviderType
): string {
  return images?.length || documents?.length
    ? attachmentDropNote(userMessage, images?.length ?? 0, documents?.length ?? 0, providerType)
    : userMessage;
}

function hasDocumentAttachment(messages: ProviderMessage[] | undefined): boolean {
  if (!messages) return false;
  return messages.some(
    (m) =>
      m.role === 'user' &&
      Array.isArray(m.content) &&
      m.content.some((block) => block.type === 'document')
  );
}

function attachmentDropNote(
  userMessage: string,
  imageCount: number,
  documentCount: number,
  providerType: ProviderType
): string {
  const parts: string[] = [];
  if (imageCount > 0) {
    parts.push(`${imageCount} ${imageCount === 1 ? 'image' : 'images'}`);
  }
  if (documentCount > 0) {
    parts.push(`${documentCount} ${documentCount === 1 ? 'document' : 'documents'}`);
  }
  if (parts.length === 0) return userMessage;
  const totalCount = imageCount + documentCount;
  return `${userMessage}\n\n[${parts.join(' and ')} attached — the active provider (${providerType}) doesn't support ${imageCount > 0 && documentCount > 0 ? 'vision/documents' : imageCount > 0 ? 'vision' : 'documents'}, so ${totalCount === 1 ? 'it was' : 'they were'} not sent.]`;
}

// Retryable (worth failing over to OpenRouter): no HTTP status available at
// all (network/timeout failure — fetch rejecting, AbortSignal.timeout
// firing), or status 429 (rate-limited) or >= 500 (outage/overloaded).
// Not retryable: any other 4xx (400 bad request, 401/403 auth, 404 model-
// not-found) — those indicate a problem with the request itself or our own
// Anthropic credential, which a different provider won't fix, and silently
// routing a bad request to a second paid API would mask a real bug instead
// of surfacing it.
function isRetryableProviderError(error: unknown): boolean {
  if (error instanceof ProviderHttpError) {
    return error.status === 429 || error.status >= 500;
  }
  // Any other thrown value (network error, DOMException from
  // AbortSignal.timeout, etc.) has no HTTP status to check — couldn't even
  // reach the API, which is exactly the outage case worth failing over for.
  return true;
}

// Maps a direct-Anthropic model string to OpenRouter's vendor-prefixed form,
// so the fallback call hits the same underlying Claude model via a
// different HTTP path rather than switching models — keeps behavior as
// close to identical as possible. No-op if the model already looks
// vendor-prefixed (e.g. a caller already passed an OpenRouter-style slug).
function toOpenRouterModel(model: string): string {
  return model.includes('/') ? model : `anthropic/${model}`;
}
