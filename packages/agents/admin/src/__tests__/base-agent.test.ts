import type {
  AgentTask,
  IApprovalQueue,
  MemoryStore,
  MCPClient,
  EventBus,
  AgentConfig,
  Skill,
  ProviderResponse,
} from '@wireassist/core';
import { ProviderFactory } from '@wireassist/core';
import { BaseAgent } from '../base-agent';
import { budgetTracker } from '../budget';

// ── Minimal concrete subclass ─────────────────────────────────────────────
class TestAgent extends BaseAgent {
  async run(_task: AgentTask): Promise<void> {}
  // Expose protected methods for testing
  testLoadContext(q: string) {
    return this.loadContext(q);
  }
  testRemember(c: string, t?: string[]) {
    return this.remember(c, t);
  }
  testProposeAction(task: AgentTask, action: string, payload: Record<string, unknown>) {
    return this.proposeAction(task, action, payload);
  }
  testUseTool(name: string, params: Record<string, unknown>) {
    return this.useTool(name, params);
  }
  testThink(userMessage: string, extraContext?: string) {
    return this.think(userMessage, extraContext);
  }
  testRunToolLoop(
    task: AgentTask,
    userMessage: string,
    opts?: { extraContext?: string; maxIterations?: number }
  ) {
    return this.runToolLoop(task, userMessage, opts);
  }
}

// Marks a fixed set of tool names read-only, so tests can exercise both the
// immediate-execution and approval-gated branches of executeToolCall().
class ReadOnlyAwareTestAgent extends TestAgent {
  private readOnly: Set<string>;
  constructor(...args: ConstructorParameters<typeof TestAgent>) {
    super(...args);
    this.readOnly = new Set(['read_tool']);
  }
  protected isReadOnlyTool(toolName: string): boolean {
    return this.readOnly.has(toolName);
  }
}

// Doesn't override run() — exercises BaseAgent's own default skill dispatch.
class DefaultRunTestAgent extends BaseAgent {
  testRegisterSkill(skill: Skill) {
    this.skills.registerSkill(skill);
  }
}

// ── Shared mocks ──────────────────────────────────────────────────────────
function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-1',
    agentRole: 'admin',
    description: 'test task',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'freeform', prompt: 'hello' },
    approvalRequired: true,
    ...overrides,
  };
}

const memoryEntry = {
  id: 'm1',
  content: 'important context',
  agentRole: 'admin' as const,
  tags: [],
  createdAt: new Date(),
};

function makeDeps(
  overrides: Partial<{
    approval: Partial<IApprovalQueue>;
    memory: Partial<MemoryStore>;
    mcp: Partial<MCPClient>;
    events: Partial<EventBus>;
  }> = {}
) {
  const mockEvents = {
    emit: jest.fn(),
    on: jest.fn(),
    ...overrides.events,
  } as unknown as EventBus;

  const mockMemory = {
    searchAsync: jest.fn().mockResolvedValue([memoryEntry]),
    search: jest.fn().mockReturnValue([memoryEntry]),
    store: jest.fn().mockReturnValue('m1'),
    storeAsync: jest.fn().mockResolvedValue('m1'),
    listRecent: jest.fn().mockReturnValue([]),
    upgradeEmbeddings: jest.fn().mockResolvedValue({ upgraded: 0, total: 0 }),
    ...overrides.memory,
  } as unknown as MemoryStore;

  const mockApproval = {
    request: jest.fn().mockResolvedValue(true),
    resolve: jest.fn(),
    getPending: jest.fn().mockReturnValue([]),
    ...overrides.approval,
  } as unknown as IApprovalQueue;

  const mockMcp = {
    call: jest.fn().mockResolvedValue({ result: 'ok' }),
    register: jest.fn(),
    ...overrides.mcp,
  } as unknown as MCPClient;

  return { approval: mockApproval, memory: mockMemory, mcp: mockMcp, events: mockEvents };
}

function makeAgent(toolOverrides: string[] = ['tool_a', 'tool_b'], depOverrides = {}) {
  const config: AgentConfig = {
    role: 'admin',
    name: 'Test Agent',
    systemPrompt: 'You are a test agent.',
    tools: toolOverrides,
  };
  const deps = makeDeps(depOverrides);
  return { agent: new TestAgent(config, deps), deps };
}

function makeDefaultRunAgent(depOverrides = {}) {
  const config: AgentConfig = {
    role: 'admin',
    name: 'Test Agent',
    systemPrompt: 'You are a test agent.',
    tools: [],
  };
  const deps = makeDeps(depOverrides);
  return { agent: new DefaultRunTestAgent(config, deps), deps };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('BaseAgent.loadContext()', () => {
  it('calls searchAsync with the query, agentRole filter, and trace exclusion', async () => {
    const { agent, deps } = makeAgent();
    await agent.testLoadContext('email preferences');
    expect(deps.memory.searchAsync).toHaveBeenCalledWith('email preferences', {
      agentRole: 'admin',
      excludeTags: ['trace'],
    });
  });

  it('returns memory content joined by double newlines', async () => {
    const { agent, deps } = makeAgent();
    (deps.memory.searchAsync as jest.Mock).mockResolvedValueOnce([
      { ...memoryEntry, content: 'first' },
      { ...memoryEntry, content: 'second' },
    ]);
    const ctx = await agent.testLoadContext('q');
    expect(ctx).toBe('first\n\nsecond');
  });

  it('returns empty string when no memories match', async () => {
    const { agent, deps } = makeAgent();
    (deps.memory.searchAsync as jest.Mock).mockResolvedValueOnce([]);
    const ctx = await agent.testLoadContext('q');
    expect(ctx).toBe('');
  });

  it('returns empty string when searchAsync throws', async () => {
    const { agent, deps } = makeAgent();
    (deps.memory.searchAsync as jest.Mock).mockRejectedValueOnce(new Error('DB error'));
    const ctx = await agent.testLoadContext('q');
    expect(ctx).toBe('');
  });
});

describe('BaseAgent.remember()', () => {
  it('calls memory.store with content, agentRole, tags, and createdAt', () => {
    const { agent, deps } = makeAgent();
    agent.testRemember('User approved draft reply', ['email', 'approval']);
    expect(deps.memory.store).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'User approved draft reply',
        agentRole: 'admin',
        tags: ['email', 'approval'],
        createdAt: expect.any(Date),
      })
    );
  });

  it('defaults tags to empty array', () => {
    const { agent, deps } = makeAgent();
    agent.testRemember('note without tags');
    expect((deps.memory.store as jest.Mock).mock.calls[0][0].tags).toEqual([]);
  });
});

describe('BaseAgent.proposeAction()', () => {
  it('emits agent:waiting_approval before requesting approval', async () => {
    const { agent, deps } = makeAgent();
    const task = makeTask();
    await agent.testProposeAction(task, 'Send email to alice@test.com', { to: 'alice@test.com' });
    expect(deps.events.emit).toHaveBeenCalledWith(
      'agent:waiting_approval',
      expect.objectContaining({
        agentRole: 'admin',
        taskId: 'task-1',
        action: 'Send email to alice@test.com',
      })
    );
  });

  it('returns true when approval.request resolves true', async () => {
    const { agent } = makeAgent();
    const result = await agent.testProposeAction(makeTask(), 'action', {});
    expect(result).toBe(true);
  });

  it('returns false when approval.request resolves false', async () => {
    const { agent } = makeAgent(undefined, {
      approval: { request: jest.fn().mockResolvedValue(false) },
    });
    const result = await agent.testProposeAction(makeTask(), 'action', {});
    expect(result).toBe(false);
  });

  it('emits agent:approval_resolved after resolution', async () => {
    const { agent, deps } = makeAgent();
    await agent.testProposeAction(makeTask(), 'action', {});
    expect(deps.events.emit).toHaveBeenCalledWith(
      'agent:approval_resolved',
      expect.objectContaining({ agentRole: 'admin', taskId: 'task-1', approved: true })
    );
  });

  it('records a trace memory tagged "approved" when approval.request resolves true', async () => {
    const { agent, deps } = makeAgent();
    await agent.testProposeAction(makeTask(), 'Send email', {});
    expect(deps.memory.store).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: ['trace', 'proposeAction', 'approved'],
        agentRole: 'admin',
      })
    );
  });

  it('records a trace memory tagged "rejected" when approval.request resolves false', async () => {
    const { agent, deps } = makeAgent(undefined, {
      approval: { request: jest.fn().mockResolvedValue(false) },
    });
    await agent.testProposeAction(makeTask(), 'Send email', {});
    expect(deps.memory.store).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: ['trace', 'proposeAction', 'rejected'],
        agentRole: 'admin',
      })
    );
  });
});

describe('BaseAgent.useTool()', () => {
  it('calls mcp.call with the tool name and params when authorized', async () => {
    const { agent, deps } = makeAgent(['tool_a']);
    await agent.testUseTool('tool_a', { key: 'val' });
    expect(deps.mcp.call).toHaveBeenCalledWith('tool_a', { key: 'val' });
  });

  it('throws when tool is not in config.tools', async () => {
    const { agent } = makeAgent(['tool_a']);
    await expect(agent.testUseTool('tool_not_allowed', {})).rejects.toThrow(/not authorized/);
  });

  it('returns the result from mcp.call', async () => {
    const { agent, deps } = makeAgent(['tool_a']);
    (deps.mcp.call as jest.Mock).mockResolvedValueOnce({ data: 42 });
    const result = await agent.testUseTool('tool_a', {});
    expect(result).toEqual({ data: 42 });
  });
});

describe('BaseAgent.run() — default skill dispatch', () => {
  it('resolves task.input.type against the registered SkillRegistry and executes it', async () => {
    const { agent } = makeDefaultRunAgent();
    const execute = jest.fn().mockResolvedValue(undefined);
    agent.testRegisterSkill({ name: 'do_thing', role: 'admin', description: 'x', execute });

    const task = makeTask({ input: { type: 'do_thing' } });
    await agent.run(task);

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ task, input: task.input }));
  });

  it('rejects when task.input.type has no matching skill', async () => {
    const { agent } = makeDefaultRunAgent();
    const task = makeTask({ input: { type: 'unregistered' } });
    await expect(agent.run(task)).rejects.toThrow(/no skill or chain registered/);
  });
});

describe('BaseAgent.think()', () => {
  function stubResponse(overrides: Partial<ProviderResponse> = {}): ProviderResponse {
    return { content: 'a reply', model: 'claude-sonnet-5', ...overrides };
  }

  let createSpy: jest.SpyInstance;
  let completeMock: jest.Mock;

  beforeEach(() => {
    completeMock = jest.fn().mockResolvedValue(stubResponse());
    createSpy = jest.spyOn(ProviderFactory, 'create').mockReturnValue({
      type: 'anthropic',
      currentModel: 'claude-sonnet-5',
      complete: completeMock,
      stream: jest.fn(),
      listModels: jest.fn(),
      validateConfig: jest.fn(),
    });
    jest.spyOn(budgetTracker, 'assertWithinBudget').mockImplementation(() => {});
    jest.spyOn(budgetTracker, 'record').mockReturnValue(0);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not construct a provider at agent construction time', () => {
    makeAgent();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('defaults to the anthropic provider when config.provider is unset', async () => {
    const { agent } = makeAgent();
    await agent.testThink('hello');
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'anthropic' }));
  });

  it('uses config.provider when set', async () => {
    const config: AgentConfig = {
      role: 'admin',
      name: 'Test Agent',
      systemPrompt: 'You are a test agent.',
      tools: [],
      provider: 'openrouter',
    };
    const agent = new TestAgent(config, makeDeps());
    await agent.testThink('hello');
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'openrouter' }));
  });

  it('defaults to openrouter/auto when provider is openrouter and no model is set', async () => {
    const config: AgentConfig = {
      role: 'admin',
      name: 'Test Agent',
      systemPrompt: 'You are a test agent.',
      tools: [],
      provider: 'openrouter',
    };
    const agent = new TestAgent(config, makeDeps());
    await agent.testThink('hello');

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'openrouter', model: 'openrouter/auto' })
    );
    expect(completeMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'openrouter/auto' })
    );
  });

  it('config.model still overrides the provider-specific default', async () => {
    const config: AgentConfig = {
      role: 'admin',
      name: 'Test Agent',
      systemPrompt: 'You are a test agent.',
      tools: [],
      provider: 'openrouter',
      model: 'anthropic/claude-sonnet-4.5',
    };
    const agent = new TestAgent(config, makeDeps());
    await agent.testThink('hello');

    expect(completeMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'anthropic/claude-sonnet-4.5' })
    );
  });

  it('passes prompt, systemPrompt, model, and maxTokens to provider.complete()', async () => {
    const { agent } = makeAgent();
    await agent.testThink('hello', 'extra context');
    expect(completeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'hello',
        systemPrompt: expect.stringContaining('extra context'),
        model: 'claude-sonnet-5',
        maxTokens: 2048,
      })
    );
  });

  it('returns response.content directly', async () => {
    completeMock.mockResolvedValueOnce(stubResponse({ content: 'the answer' }));
    const { agent } = makeAgent();
    expect(await agent.testThink('hello')).toBe('the answer');
  });

  it('records the promptTokens/completionTokens split when the provider returns one', async () => {
    completeMock.mockResolvedValueOnce(
      stubResponse({ promptTokens: 10, completionTokens: 5, tokensUsed: 15 })
    );
    const { agent } = makeAgent();
    await agent.testThink('hello');
    expect(budgetTracker.record).toHaveBeenCalledWith('admin', 'claude-sonnet-5', 10, 5);
  });

  it('falls back to charging the full tokensUsed as output tokens when no split is returned', async () => {
    completeMock.mockResolvedValueOnce(stubResponse({ tokensUsed: 42 }));
    const { agent } = makeAgent();
    await agent.testThink('hello');
    expect(budgetTracker.record).toHaveBeenCalledWith('admin', 'claude-sonnet-5', 0, 42);
  });

  it('does not record budget usage when the provider returns no token counts at all', async () => {
    completeMock.mockResolvedValueOnce(stubResponse());
    const { agent } = makeAgent();
    await agent.testThink('hello');
    expect(budgetTracker.record).not.toHaveBeenCalled();
  });

  it('reuses the same provider instance across multiple think() calls', async () => {
    const { agent } = makeAgent();
    await agent.testThink('one');
    await agent.testThink('two');
    expect(createSpy).toHaveBeenCalledTimes(1);
  });
});

describe('BaseAgent.runToolLoop()', () => {
  function stubResponse(overrides: Partial<ProviderResponse> = {}): ProviderResponse {
    return { content: '', model: 'claude-sonnet-5', ...overrides };
  }

  let completeMock: jest.Mock;

  beforeEach(() => {
    completeMock = jest.fn();
    jest.spyOn(ProviderFactory, 'create').mockReturnValue({
      type: 'anthropic',
      currentModel: 'claude-sonnet-5',
      complete: completeMock,
      stream: jest.fn(),
      listModels: jest.fn(),
      validateConfig: jest.fn(),
    });
    jest.spyOn(budgetTracker, 'assertWithinBudget').mockImplementation(() => {});
    jest.spyOn(budgetTracker, 'record').mockReturnValue(0);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function makeToolAgent(deps = makeDeps()) {
    const config: AgentConfig = {
      role: 'admin',
      name: 'Test Agent',
      systemPrompt: 'You are a test agent.',
      tools: ['read_tool', 'write_tool'],
      toolSchemas: {
        read_tool: { name: 'read_tool', description: 'reads', inputSchema: { type: 'object' } },
        write_tool: { name: 'write_tool', description: 'writes', inputSchema: { type: 'object' } },
      },
    };
    return { agent: new ReadOnlyAwareTestAgent(config, deps), deps };
  }

  it('falls back to think() when the provider is not anthropic', async () => {
    jest.spyOn(ProviderFactory, 'create').mockReturnValue({
      type: 'openrouter',
      currentModel: 'openrouter/auto',
      complete: completeMock,
      stream: jest.fn(),
      listModels: jest.fn(),
      validateConfig: jest.fn(),
    });
    completeMock.mockResolvedValue(stubResponse({ content: 'plain answer' }));

    const config: AgentConfig = {
      role: 'admin',
      name: 'Test Agent',
      systemPrompt: 'sys',
      tools: [],
      provider: 'openrouter',
      toolSchemas: { x: { name: 'x', description: 'd', inputSchema: {} } },
    };
    const agent = new TestAgent(config, makeDeps());
    const result = await agent.testRunToolLoop(makeTask(), 'hello');

    expect(result).toBe('plain answer');
    expect(completeMock).toHaveBeenCalledWith(
      expect.not.objectContaining({ tools: expect.anything() })
    );
  });

  it('falls back to think() when the agent has no toolSchemas configured', async () => {
    completeMock.mockResolvedValue(stubResponse({ content: 'plain answer' }));
    const { agent } = makeAgent();
    const result = await agent.testRunToolLoop(makeTask(), 'hello');
    expect(result).toBe('plain answer');
  });

  it('returns the final text once the model stops calling tools', async () => {
    completeMock.mockResolvedValueOnce(stubResponse({ content: 'the answer' }));
    const { agent } = makeToolAgent();
    const result = await agent.testRunToolLoop(makeTask(), 'hello');
    expect(result).toBe('the answer');
    expect(completeMock).toHaveBeenCalledTimes(1);
  });

  it('executes a read-only tool call immediately (no approval) and feeds the result back', async () => {
    completeMock
      .mockResolvedValueOnce(
        stubResponse({
          content: '',
          toolCalls: [{ id: 'c1', name: 'read_tool', input: { q: 'x' } }],
        })
      )
      .mockResolvedValueOnce(stubResponse({ content: 'done' }));
    const { agent, deps } = makeToolAgent();
    (deps.mcp.call as jest.Mock).mockResolvedValueOnce({ found: true });

    const result = await agent.testRunToolLoop(makeTask(), 'hello');

    expect(result).toBe('done');
    expect(deps.mcp.call).toHaveBeenCalledWith('read_tool', { q: 'x' });
    expect(deps.approval.request).not.toHaveBeenCalled();

    const secondCallMessages = completeMock.mock.calls[1][0].messages;
    expect(secondCallMessages).toContainEqual(
      expect.objectContaining({ role: 'tool_result', toolCallId: 'c1', isError: false })
    );
  });

  it('routes a mutating tool call through proposeAction and executes it when approved', async () => {
    completeMock
      .mockResolvedValueOnce(
        stubResponse({
          content: '',
          toolCalls: [{ id: 'c1', name: 'write_tool', input: { x: 1 } }],
        })
      )
      .mockResolvedValueOnce(stubResponse({ content: 'done' }));
    const { agent, deps } = makeToolAgent();

    await agent.testRunToolLoop(makeTask(), 'hello');

    expect(deps.approval.request).toHaveBeenCalled();
    expect(deps.mcp.call).toHaveBeenCalledWith('write_tool', { x: 1 });
  });

  it('does not execute a mutating tool call when approval is declined', async () => {
    completeMock
      .mockResolvedValueOnce(
        stubResponse({
          content: '',
          toolCalls: [{ id: 'c1', name: 'write_tool', input: { x: 1 } }],
        })
      )
      .mockResolvedValueOnce(stubResponse({ content: 'ok, skipped that' }));
    const { agent, deps } = makeToolAgent(
      makeDeps({ approval: { request: jest.fn().mockResolvedValue(false) } })
    );

    const result = await agent.testRunToolLoop(makeTask(), 'hello');

    expect(result).toBe('ok, skipped that');
    expect(deps.mcp.call).not.toHaveBeenCalled();
    const secondCallMessages = completeMock.mock.calls[1][0].messages;
    expect(secondCallMessages).toContainEqual(
      expect.objectContaining({ role: 'tool_result', toolCallId: 'c1', isError: true })
    );
  });

  it('stops after maxIterations and returns a graceful fallback instead of looping forever', async () => {
    completeMock.mockResolvedValue(
      stubResponse({ content: '', toolCalls: [{ id: 'c1', name: 'read_tool', input: {} }] })
    );
    const { agent, deps } = makeToolAgent();
    (deps.mcp.call as jest.Mock).mockResolvedValue({ ok: true });

    const result = await agent.testRunToolLoop(makeTask(), 'hello', { maxIterations: 2 });

    expect(completeMock).toHaveBeenCalledTimes(2);
    expect(result).toMatch(/wasn't able to finish/);
  });

  it('turns a thrown tool error into an isError tool_result instead of failing the loop', async () => {
    completeMock
      .mockResolvedValueOnce(
        stubResponse({
          content: '',
          toolCalls: [{ id: 'c1', name: 'read_tool', input: {} }],
        })
      )
      .mockResolvedValueOnce(stubResponse({ content: 'recovered' }));
    const { agent, deps } = makeToolAgent();
    (deps.mcp.call as jest.Mock).mockRejectedValueOnce(new Error('boom'));

    const result = await agent.testRunToolLoop(makeTask(), 'hello');

    expect(result).toBe('recovered');
    const secondCallMessages = completeMock.mock.calls[1][0].messages;
    expect(secondCallMessages).toContainEqual(
      expect.objectContaining({
        role: 'tool_result',
        toolCallId: 'c1',
        isError: true,
        content: 'boom',
      })
    );
  });
});
