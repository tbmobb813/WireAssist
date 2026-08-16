import type { AgentTask, IApprovalQueue, MemoryStore, MCPClient, EventBus } from '@wireassist/core';
import { NixOpsAgent } from '../nixops-agent';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-o1',
    agentRole: 'strategy',
    description: 'What is our current spend?',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'freeform', prompt: 'What is our current spend?' },
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
      call: jest.fn().mockResolvedValue({ values: [] }),
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

describe('NixOpsAgent — chat tool-calling loop', () => {
  it('config.toolSchemas is populated for sheets_read', () => {
    const agent = new NixOpsAgent(makeDeps());
    const toolSchemas = (agent as any).config.toolSchemas;
    expect(Object.keys(toolSchemas)).toEqual(['sheets_read']);
  });

  it('executeToolCall() runs sheets_read immediately, with no approval', async () => {
    const deps = makeDeps({ mcp: { call: jest.fn().mockResolvedValue({ values: [['1']] }) } });
    const agent = new NixOpsAgent(deps);

    const result = await (agent as any).executeToolCall(makeTask(), {
      id: 'c1',
      name: 'sheets_read',
      input: { spreadsheetId: 'sh1', range: 'Costs!A1:D10' },
    });

    expect(result).toEqual({ result: { values: [['1']] }, isError: false });
    expect(deps.approval.request).not.toHaveBeenCalled();
    expect(deps.mcp.call).toHaveBeenCalledWith('sheets_read', {
      spreadsheetId: 'sh1',
      range: 'Costs!A1:D10',
    });
  });

  it('freeform skill drives runToolLoop() and emits the result as agent:ops_freeform_response', async () => {
    const deps = makeDeps();
    const agent = new NixOpsAgent(deps);
    const runToolLoopSpy = jest
      .spyOn(agent as any, 'runToolLoop')
      .mockResolvedValue('Spend is on track.');

    const task = makeTask({ input: { type: 'freeform', prompt: 'What is our current spend?' } });
    await agent.run(task);

    expect(runToolLoopSpy).toHaveBeenCalledWith(
      task,
      'What is our current spend?',
      expect.objectContaining({})
    );
    expect(deps.events.emit).toHaveBeenCalledWith(
      'agent:ops_freeform_response',
      expect.objectContaining({ taskId: task.id, response: 'Spend is on track.' })
    );
  });

  it('passes input.history through to runToolLoop as priorMessages', async () => {
    const deps = makeDeps();
    const agent = new NixOpsAgent(deps);
    const runToolLoopSpy = jest.spyOn(agent as any, 'runToolLoop').mockResolvedValue('answer');
    const history = [{ role: 'user' as const, content: 'earlier question' }];

    const task = makeTask({
      input: { type: 'freeform', prompt: 'follow-up', history },
    });
    await agent.run(task);

    expect(runToolLoopSpy).toHaveBeenCalledWith(
      task,
      'follow-up',
      expect.objectContaining({ priorMessages: history })
    );
  });
});
