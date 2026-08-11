import type { AgentTask, IApprovalQueue, MemoryStore, MCPClient, EventBus } from '@wireassist/core';
import { AdminAgent } from '../admin-agent';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-a1',
    agentRole: 'admin',
    description: 'Triage inbox',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'email_triage' },
    approvalRequired: true,
    ...overrides,
  };
}

function makeDeps(
  overrides: {
    approval?: Partial<IApprovalQueue>;
    memory?: Partial<MemoryStore>;
    mcp?: Partial<MCPClient>;
    events?: Partial<EventBus>;
  } = {}
) {
  return {
    approval: {
      request: jest.fn().mockResolvedValue(true),
      resolve: jest.fn(),
      getPending: jest.fn().mockReturnValue([]),
      ...overrides.approval,
    } as unknown as IApprovalQueue,
    memory: {
      searchAsync: jest.fn().mockResolvedValue([]),
      search: jest.fn().mockReturnValue([]),
      store: jest.fn().mockReturnValue('m1'),
      storeAsync: jest.fn().mockResolvedValue('m1'),
      listRecent: jest.fn().mockReturnValue([]),
      upgradeEmbeddings: jest.fn().mockResolvedValue({ upgraded: 0, total: 0 }),
      ...overrides.memory,
    } as unknown as MemoryStore,
    mcp: {
      call: jest.fn().mockResolvedValue([{ id: 't1', snippet: 'hi' }]),
      register: jest.fn(),
      ...overrides.mcp,
    } as unknown as MCPClient,
    events: {
      emit: jest.fn(),
      on: jest.fn(),
      ...overrides.events,
    } as unknown as EventBus,
  };
}

function threadDetailMock() {
  return [{ id: 't1', from: 'a@example.com', subject: 'Hi', snippet: 'hi', date: '2026-01-01' }];
}

describe('AdminAgent.triageEmail() — JSON parsing', () => {
  it('parses a response wrapped in ```json markdown fences', async () => {
    const deps = makeDeps({
      mcp: {
        call: jest
          .fn()
          .mockResolvedValueOnce([{ id: 't1', snippet: 'hi' }])
          .mockResolvedValueOnce(threadDetailMock()[0]),
      },
    });
    const agent = new AdminAgent(deps);
    (agent as any).think = jest.fn().mockResolvedValue(
      '```json\n' +
        JSON.stringify({
          categories: { urgent: [], replyNeeded: [], fyi: [], ignore: [] },
          summary: 'All quiet.',
          urgentCount: 0,
          replyNeededCount: 0,
        }) +
        '\n```'
    );

    const result = await agent.triageEmail(makeTask());

    expect(result.summary).toBe('All quiet.');
  });

  it('throws a clear error when the response is genuinely invalid JSON', async () => {
    const deps = makeDeps({
      mcp: {
        call: jest
          .fn()
          .mockResolvedValueOnce([{ id: 't1', snippet: 'hi' }])
          .mockResolvedValueOnce(threadDetailMock()[0]),
      },
    });
    const agent = new AdminAgent(deps);
    (agent as any).think = jest.fn().mockResolvedValue('not json at all');

    await expect(agent.triageEmail(makeTask())).rejects.toThrow(/invalid JSON during triage/);
  });
});

describe('AdminAgent.reviewCalendar() — JSON parsing', () => {
  it('parses a response wrapped in ```json markdown fences', async () => {
    const deps = makeDeps({
      mcp: { call: jest.fn().mockResolvedValue([]) },
    });
    const agent = new AdminAgent(deps);
    (agent as any).think = jest.fn().mockResolvedValue(
      '```json\n' +
        JSON.stringify({
          conflicts: [],
          overloadedDays: [],
          suggestions: [],
          summary: 'Light week.',
        }) +
        '\n```'
    );

    await agent.reviewCalendar(makeTask({ input: { type: 'calendar_review' } }));

    expect(deps.events.emit).toHaveBeenCalledWith(
      'agent:calendar_review_complete',
      expect.objectContaining({ review: expect.objectContaining({ summary: 'Light week.' }) })
    );
  });
});
