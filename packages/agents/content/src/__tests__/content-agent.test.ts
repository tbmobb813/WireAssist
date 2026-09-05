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
  it('config.toolSchemas is populated for every raw tool and every skill-tool', () => {
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
        'content_generate_plan_from_timeline',
        'content_create_campaign',
        'content_list_campaigns',
        'content_mark_published',
        'generate_post_skill',
        'generate_plan_skill',
        'generate_plan_from_timeline_skill',
        'schedule_post_skill',
        'analyze_post_skill',
        'list_scheduled_skill',
        'propose_skill_skill',
        'delegate_to_agent',
      ].sort()
    );
  });

  it('config.tools (the MCP authorization list) never includes a skill-tool name', () => {
    const agent = new ContentAgent(makeDeps());
    const tools = (agent as any).config.tools as string[];
    expect(tools).not.toContain('generate_post_skill');
    expect(tools).toContain('content_generate');
  });

  it('content_publish_post is authorized for useTool() but invisible to the chat loop', () => {
    const agent = new ContentAgent(makeDeps());
    const tools = (agent as any).config.tools as string[];
    const toolSchemas = (agent as any).config.toolSchemas;
    expect(tools).toContain('content_publish_post');
    expect(toolSchemas).not.toHaveProperty('content_publish_post');
  });

  it('delegate_to_agent dispatches to the shared BaseAgent handler (proposes approval, emits handoff)', async () => {
    const deps = makeDeps();
    const agent = new ContentAgent(deps);

    const result = await (agent as any).executeToolCall(makeTask(), {
      id: 'c1',
      name: 'delegate_to_agent',
      input: { targetRole: 'research', prompt: 'find competitor pricing' },
    });

    expect(deps.approval.request).toHaveBeenCalledWith(
      expect.objectContaining({ action: expect.stringContaining('Hand off to Research agent') })
    );
    expect(deps.events.emit).toHaveBeenCalledWith(
      'agent:handoff_requested',
      expect.objectContaining({ task: expect.objectContaining({ agentRole: 'research' }) })
    );
    expect(result.isError).toBe(false);
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

  it('executeToolCall() runs content_mark_published immediately, with no approval', async () => {
    const deps = makeDeps({
      mcp: { call: jest.fn().mockResolvedValue({ id: 'p1', status: 'published' }) },
    });
    const agent = new ContentAgent(deps);

    const result = await (agent as any).executeToolCall(makeTask(), {
      id: 'c1',
      name: 'content_mark_published',
      input: { postId: 'p1' },
    });

    expect(result).toEqual({ result: { id: 'p1', status: 'published' }, isError: false });
    expect(deps.approval.request).not.toHaveBeenCalled();
  });

  it('executeToolCall() gates content_generate_plan_from_timeline behind approval', async () => {
    const deps = makeDeps();
    const agent = new ContentAgent(deps);

    await (agent as any).executeToolCall(makeTask(), {
      id: 'c1',
      name: 'content_generate_plan_from_timeline',
      input: { productName: 'StatusWatch', timeline: [], platforms: ['linkedin'] },
    });

    expect(deps.approval.request).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.stringContaining('Generate content calendar from launch timeline'),
      })
    );
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

  it('passes task.input.images through to runToolLoop', async () => {
    const deps = makeDeps();
    const agent = new ContentAgent(deps);
    const runToolLoopSpy = jest.spyOn(agent as any, 'runToolLoop').mockResolvedValue('answer');
    const images = [{ mediaType: 'image/png', data: 'base64data' }];

    const task = makeTask({
      input: { type: 'freeform', prompt: "what's this?", images },
    });
    await agent.run(task);

    expect(runToolLoopSpy).toHaveBeenCalledWith(
      task,
      "what's this?",
      expect.objectContaining({ images })
    );
  });
});

describe('ContentAgent — composable skill-tools in the chat loop', () => {
  it('executeToolCall() dispatches generate_post_skill via invokeSkill(), with no approval gate — generating a draft has no real-world effect', async () => {
    const mcpCall = jest.fn().mockImplementation((tool: string) => {
      if (tool === 'content_generate') {
        return Promise.resolve({ content: 'Post text', platform: 'linkedin', topic: 'Q3 launch' });
      }
      throw new Error(`unexpected tool: ${tool}`);
    });
    const deps = makeDeps({
      mcp: { call: mcpCall },
      approval: { request: jest.fn().mockResolvedValue(true) },
    });
    const agent = new ContentAgent(deps);

    const result = await (agent as any).executeToolCall(makeTask(), {
      id: 'c1',
      name: 'generate_post_skill',
      input: { topic: 'Q3 launch', platform: 'linkedin' },
    });

    expect(result.isError).toBe(false);
    expect(deps.approval.request).not.toHaveBeenCalled();
    expect(deps.events.emit).toHaveBeenCalledWith(
      'agent:content_generated',
      expect.objectContaining({ content: 'Post text' })
    );
    expect(deps.events.emit).toHaveBeenCalledWith(
      'agent:content_approved',
      expect.objectContaining({ content: 'Post text', platform: 'linkedin' })
    );
  });

  it('executeToolCall() dispatches list_scheduled_skill via invokeSkill(), which needs no approval', async () => {
    const deps = makeDeps({ mcp: { call: jest.fn().mockResolvedValue([{ id: 'p1' }]) } });
    const agent = new ContentAgent(deps);

    const result = await (agent as any).executeToolCall(makeTask(), {
      id: 'c1',
      name: 'list_scheduled_skill',
      input: { daysAhead: 7 },
    });

    expect(result.isError).toBe(false);
    expect(deps.approval.request).not.toHaveBeenCalled();
    expect(deps.events.emit).toHaveBeenCalledWith(
      'agent:scheduled_posts',
      expect.objectContaining({ posts: [{ id: 'p1' }] })
    );
  });
});
