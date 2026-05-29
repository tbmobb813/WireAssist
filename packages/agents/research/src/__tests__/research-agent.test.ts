import type { AgentTask, IApprovalQueue, MemoryStore, MCPClient, EventBus } from '@synqworks/core';
import { ResearchAgent } from '../research-agent';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-r1',
    agentRole: 'research',
    description: 'Research AI trends',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'research_topic', query: 'AI trends 2026', resultCount: 3 },
    approvalRequired: true,
    ...overrides,
  };
}

const memoryEntry = { id: 'm1', content: 'prior research context', agentRole: 'research' as const, tags: [], createdAt: new Date() };

function makeDeps(overrides: { approval?: Partial<IApprovalQueue>; memory?: Partial<MemoryStore>; mcp?: Partial<MCPClient>; events?: Partial<EventBus> } = {}) {
  return {
    approval: {
      request: jest.fn().mockResolvedValue(true),
      resolve: jest.fn(),
      getPending: jest.fn().mockReturnValue([]),
      ...overrides.approval,
    } as unknown as IApprovalQueue,
    memory: {
      searchAsync: jest.fn().mockResolvedValue([memoryEntry]),
      search: jest.fn().mockReturnValue([]),
      store: jest.fn().mockReturnValue('m1'),
      storeAsync: jest.fn().mockResolvedValue('m1'),
      listRecent: jest.fn().mockReturnValue([]),
      upgradeEmbeddings: jest.fn().mockResolvedValue({ upgraded: 0, total: 0 }),
      ...overrides.memory,
    } as unknown as MemoryStore,
    mcp: {
      call: jest.fn().mockResolvedValue({ results: [
        { title: 'AI Trends 2026', url: 'https://example.com/1', description: 'Key AI trends this year.' },
        { title: 'LLM Landscape', url: 'https://example.com/2', description: 'Overview of LLM providers.' },
      ]}),
      register: jest.fn(),
      listTools: jest.fn().mockReturnValue(['brave_search']),
      ...overrides.mcp,
    } as unknown as MCPClient,
    events: {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      ...overrides.events,
    } as unknown as EventBus,
  };
}

describe('ResearchAgent constructor', () => {
  it('has role research', () => {
    const deps = makeDeps();
    const agent = new ResearchAgent(deps);
    expect(agent.role).toBe('research');
  });

  it('starts with idle status', () => {
    const agent = new ResearchAgent(makeDeps());
    expect(agent.status).toBe('idle');
  });
});

describe('ResearchAgent.run() — research_topic', () => {
  it('emits agent:task_started', async () => {
    const deps = makeDeps();
    const agent = new ResearchAgent(deps);
    // Mock think to avoid real Anthropic call
    (agent as any).think = jest.fn().mockResolvedValue('AI is growing fast.');
    await agent.run(makeTask());
    expect(deps.events.emit).toHaveBeenCalledWith('agent:task_started', expect.objectContaining({ agentRole: 'research', taskId: 'task-r1' }));
  });

  it('calls brave_search tool with query and resultCount', async () => {
    const deps = makeDeps();
    const agent = new ResearchAgent(deps);
    (agent as any).think = jest.fn().mockResolvedValue('Summary here.');
    await agent.run(makeTask());
    expect(deps.mcp.call).toHaveBeenCalledWith('brave_search', { query: 'AI trends 2026', count: 3 });
  });

  it('emits agent:research_complete after search', async () => {
    const deps = makeDeps();
    const agent = new ResearchAgent(deps);
    (agent as any).think = jest.fn().mockResolvedValue('Findings: AI is booming.');
    await agent.run(makeTask());
    expect(deps.events.emit).toHaveBeenCalledWith('agent:research_complete', expect.objectContaining({
      agentRole: 'research',
      taskId: 'task-r1',
      summary: 'Findings: AI is booming.',
    }));
  });

  it('proposes action to store findings', async () => {
    const deps = makeDeps();
    const agent = new ResearchAgent(deps);
    (agent as any).think = jest.fn().mockResolvedValue('Findings.');
    await agent.run(makeTask());
    expect(deps.approval.request).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-r1',
      agentRole: 'research',
    }));
  });

  it('stores to memory when approved', async () => {
    const deps = makeDeps();
    const agent = new ResearchAgent(deps);
    (agent as any).think = jest.fn().mockResolvedValue('Findings stored.');
    await agent.run(makeTask());
    expect(deps.memory.store).toHaveBeenCalledWith(expect.objectContaining({
      agentRole: 'research',
      tags: expect.arrayContaining(['research', 'findings']),
    }));
  });

  it('does NOT store to memory when rejected', async () => {
    const deps = makeDeps({ approval: { request: jest.fn().mockResolvedValue(false) } });
    const agent = new ResearchAgent(deps);
    (agent as any).think = jest.fn().mockResolvedValue('Findings.');
    await agent.run(makeTask());
    expect(deps.memory.store).not.toHaveBeenCalled();
  });

  it('handles empty search results gracefully', async () => {
    const deps = makeDeps({ mcp: { call: jest.fn().mockResolvedValue({ results: [] }), register: jest.fn(), listTools: jest.fn().mockReturnValue(['brave_search']) } });
    const agent = new ResearchAgent(deps);
    await agent.run(makeTask());
    expect(deps.events.emit).toHaveBeenCalledWith('agent:research_complete', expect.objectContaining({ summary: 'No results found.' }));
    expect(deps.memory.store).not.toHaveBeenCalled();
  });

  it('emits agent:task_complete on success', async () => {
    const deps = makeDeps();
    const agent = new ResearchAgent(deps);
    (agent as any).think = jest.fn().mockResolvedValue('Done.');
    await agent.run(makeTask());
    expect(deps.events.emit).toHaveBeenCalledWith('agent:task_complete', expect.objectContaining({ taskId: 'task-r1' }));
  });
});

describe('ResearchAgent.run() — synthesize_findings', () => {
  it('loads context and emits synthesis', async () => {
    const deps = makeDeps();
    const agent = new ResearchAgent(deps);
    (agent as any).think = jest.fn().mockResolvedValue('Synthesized result.');
    const task = makeTask({ input: { type: 'synthesize_findings', topic: 'AI tools' } });
    await agent.run(task);
    expect(deps.memory.searchAsync).toHaveBeenCalledWith('AI tools', { agentRole: 'research' });
    expect(deps.events.emit).toHaveBeenCalledWith('agent:research_complete', expect.objectContaining({ summary: 'Synthesized result.' }));
  });

  it('emits research_complete with no-memory message when context is empty', async () => {
    const deps = makeDeps({ memory: { searchAsync: jest.fn().mockResolvedValue([]), search: jest.fn().mockReturnValue([]), store: jest.fn().mockReturnValue('x'), storeAsync: jest.fn().mockResolvedValue('x'), listRecent: jest.fn().mockReturnValue([]), upgradeEmbeddings: jest.fn().mockResolvedValue({ upgraded: 0, total: 0 }) } });
    const agent = new ResearchAgent(deps);
    const task = makeTask({ input: { type: 'synthesize_findings', topic: 'niche topic' } });
    await agent.run(task);
    expect(deps.events.emit).toHaveBeenCalledWith('agent:research_complete', expect.objectContaining({
      summary: expect.stringContaining('No existing research found'),
    }));
  });
});
