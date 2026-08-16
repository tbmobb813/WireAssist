import type { AgentTask, IApprovalQueue, MemoryStore, MCPClient, EventBus } from '@wireassist/core';
import { ContentAgent } from '../content-agent';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-c1',
    agentRole: 'content',
    description: 'What should I post about this week?',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'freeform', prompt: 'What should I post about this week?' },
    approvalRequired: false,
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
      call: jest.fn().mockResolvedValue({ ok: true }),
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

describe('ContentAgent — chat tool-calling loop', () => {
  it('config.toolSchemas is populated for every tool in the allowlist', () => {
    const agent = new ContentAgent(makeDeps());
    const toolSchemas = (agent as any).config.toolSchemas;
    expect(Object.keys(toolSchemas).sort()).toEqual(
      [
        'content_generate',
        'content_generate_plan',
        'content_schedule_post',
        'content_list_posts',
        'content_delete_post',
        'content_list_ideas',
        'content_analyze',
      ].sort()
    );
  });

  it('executeToolCall() runs a read-only tool immediately, with no approval', async () => {
    const deps = makeDeps({ mcp: { call: jest.fn().mockResolvedValue([{ id: 'p1' }]) } });
    const agent = new ContentAgent(deps);

    const result = await (agent as any).executeToolCall(makeTask(), {
      id: 'c1',
      name: 'content_list_posts',
      input: { daysAhead: 7 },
    });

    expect(result).toEqual({ result: [{ id: 'p1' }], isError: false });
    expect(deps.approval.request).not.toHaveBeenCalled();
    expect(deps.mcp.call).toHaveBeenCalledWith('content_list_posts', { daysAhead: 7 });
  });

  it('executeToolCall() gates a mutating tool behind approval and executes it once approved', async () => {
    const deps = makeDeps({ mcp: { call: jest.fn().mockResolvedValue({ id: 'p1' }) } });
    const agent = new ContentAgent(deps);

    const result = await (agent as any).executeToolCall(makeTask(), {
      id: 'c1',
      name: 'content_schedule_post',
      input: { content: 'hello', platform: 'linkedin', scheduledAt: '2026-06-01T10:00:00Z' },
    });

    expect(deps.approval.request).toHaveBeenCalledWith(
      expect.objectContaining({ action: expect.stringContaining('Schedule linkedin post') })
    );
    expect(result).toEqual({ result: { id: 'p1' }, isError: false });
  });

  it('executeToolCall() reports a declined mutating action as an error result, without calling the tool', async () => {
    const deps = makeDeps({ approval: { request: jest.fn().mockResolvedValue(false) } });
    const agent = new ContentAgent(deps);

    const result = await (agent as any).executeToolCall(makeTask(), {
      id: 'c1',
      name: 'content_delete_post',
      input: { postId: 'p1' },
    });

    expect(result).toEqual({ result: 'User declined this action.', isError: true });
    expect(deps.mcp.call).not.toHaveBeenCalled();
  });

  it('freeform skill drives runToolLoop() and emits the result as agent:freeform_response', async () => {
    const deps = makeDeps();
    const agent = new ContentAgent(deps);
    const runToolLoopSpy = jest
      .spyOn(agent as any, 'runToolLoop')
      .mockResolvedValue('Post about the launch on Tuesday.');

    const task = makeTask({
      input: { type: 'freeform', prompt: 'what should I post this week?' },
    });
    await agent.run(task);

    expect(runToolLoopSpy).toHaveBeenCalledWith(
      task,
      'what should I post this week?',
      expect.objectContaining({ extraContext: expect.any(String) })
    );
    expect(deps.events.emit).toHaveBeenCalledWith('agent:freeform_response', {
      taskId: task.id,
      response: 'Post about the launch on Tuesday.',
    });
  });

  it('passes task.input.history through to runToolLoop as priorMessages', async () => {
    const deps = makeDeps();
    const agent = new ContentAgent(deps);
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
