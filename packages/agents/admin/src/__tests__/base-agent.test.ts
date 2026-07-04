import type {
  AgentTask,
  IApprovalQueue,
  MemoryStore,
  MCPClient,
  EventBus,
  AgentConfig,
} from '@wireassist/core';
import { BaseAgent } from '../base-agent';

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

// ── Tests ─────────────────────────────────────────────────────────────────

describe('BaseAgent.loadContext()', () => {
  it('calls searchAsync with the query and agentRole filter', async () => {
    const { agent, deps } = makeAgent();
    await agent.testLoadContext('email preferences');
    expect(deps.memory.searchAsync).toHaveBeenCalledWith('email preferences', {
      agentRole: 'admin',
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
