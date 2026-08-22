import type { AgentTask, IApprovalQueue, MemoryStore, MCPClient, EventBus } from '@wireassist/core';
import { GtmAgent } from '../gtm-agent';
import type { GtmProductInput } from '../types';

const product: GtmProductInput = {
  name: 'StatusWatch',
  cat: 'SaaS',
  problem: 'DevOps teams waste hours figuring out if an outage is their code or a vendor',
  benefit: 'Instant clarity during outages',
  diff: 'Calm by default — smart alert filtering reduces noise',
  buyer: 'DevOps engineers at Series A-B startups',
  segment: '10-100 person startups',
  comp: 'StatusGator ($89/mo)',
  channels: 'r/devops, Hacker News',
  pain: 'Too many false alerts',
  price: '$49/month',
  model: 'SaaS subscription',
  free: '14-day free trial',
  goal: '10 paying customers in 30 days',
  current: 'Nothing yet',
  budget: '$0 for now',
};

const GTM_JSON = JSON.stringify({
  positioning: {
    headline: 'Calm status monitoring',
    subheadline: 'Know instantly whether it is your code or theirs.',
    icp: 'DevOps engineers',
    message_hierarchy: ['Clarity during outages'],
  },
  organic_channels: [],
  paid_channels: [],
  launch_timeline: [],
  kpis: [],
  north_star: '10 paying customers in 30 days',
  founder_advantage: 'Deep DevOps background',
  biggest_risk: 'Crowded market',
});

const PSYCH_JSON = JSON.stringify([
  {
    principle: 'Social proof',
    tagline: 'Show, don’t tell',
    generic_bad: 'Trusted by many',
    generic_good: 'Trusted by 200+ DevOps teams',
    headline: 'Join 200+ teams',
    tactics: ['Show live customer count'],
    tags: ['social-proof'],
  },
]);

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-g1',
    agentRole: 'gtm',
    description: 'What channel should I launch on?',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'freeform', prompt: 'What channel should I launch on?' },
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
      call: jest.fn(),
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

describe('GtmAgent — chat tool-calling loop', () => {
  it('config.toolSchemas is populated for generate_gtm_skill and generate_psych_skill', () => {
    const agent = new GtmAgent(makeDeps());
    const toolSchemas = (agent as any).config.toolSchemas;
    expect(Object.keys(toolSchemas).sort()).toEqual(
      ['generate_gtm_skill', 'generate_psych_skill', 'delegate_to_agent'].sort()
    );
  });

  it('config.tools stays empty — GTM has no raw MCP tools, only skill-tools', () => {
    const agent = new GtmAgent(makeDeps());
    expect((agent as any).config.tools).toEqual([]);
  });

  it('delegate_to_agent dispatches to the shared BaseAgent handler (proposes approval, emits handoff)', async () => {
    const deps = makeDeps();
    const agent = new GtmAgent(deps);

    const result = await (agent as any).executeToolCall(makeTask(), {
      id: 'c1',
      name: 'delegate_to_agent',
      input: { targetRole: 'content', prompt: 'draft the launch post' },
    });

    expect(deps.approval.request).toHaveBeenCalledWith(
      expect.objectContaining({ action: expect.stringContaining('Hand off to Content agent') })
    );
    expect(deps.events.emit).toHaveBeenCalledWith(
      'agent:handoff_requested',
      expect.objectContaining({ task: expect.objectContaining({ agentRole: 'content' }) })
    );
    expect(result.isError).toBe(false);
  });

  it('freeform skill drives runToolLoop() and emits the result as agent:freeform_response', async () => {
    const deps = makeDeps();
    const agent = new GtmAgent(deps);
    const runToolLoopSpy = jest
      .spyOn(agent as any, 'runToolLoop')
      .mockResolvedValue('Reddit r/devops is your best bet.');

    const task = makeTask({
      input: { type: 'freeform', prompt: 'What channel should I launch on?' },
    });
    await agent.run(task);

    expect(runToolLoopSpy).toHaveBeenCalledWith(
      task,
      'What channel should I launch on?',
      expect.objectContaining({})
    );
    expect(deps.events.emit).toHaveBeenCalledWith('agent:freeform_response', {
      taskId: task.id,
      response: 'Reddit r/devops is your best bet.',
    });
  });

  it('passes input.history through to runToolLoop as priorMessages', async () => {
    const deps = makeDeps();
    const agent = new GtmAgent(deps);
    const runToolLoopSpy = jest.spyOn(agent as any, 'runToolLoop').mockResolvedValue('answer');
    const history = [{ role: 'user' as const, content: 'earlier question' }];

    const task = makeTask({ input: { type: 'freeform', prompt: 'follow-up', history } });
    await agent.run(task);

    expect(runToolLoopSpy).toHaveBeenCalledWith(
      task,
      'follow-up',
      expect.objectContaining({ priorMessages: history })
    );
  });

  it('passes input.images through to runToolLoop', async () => {
    const deps = makeDeps();
    const agent = new GtmAgent(deps);
    const runToolLoopSpy = jest.spyOn(agent as any, 'runToolLoop').mockResolvedValue('answer');
    const images = [{ mediaType: 'image/png', data: 'base64data' }];

    const task = makeTask({ input: { type: 'freeform', prompt: "what's this?", images } });
    await agent.run(task);

    expect(runToolLoopSpy).toHaveBeenCalledWith(
      task,
      "what's this?",
      expect.objectContaining({ images })
    );
  });
});

describe('GtmAgent — composable skill-tools in the chat loop', () => {
  it('executeToolCall() dispatches generate_gtm_skill via invokeSkill(), with no outer approval gate', async () => {
    const deps = makeDeps();
    const agent = new GtmAgent(deps);
    (agent as any).think = jest.fn().mockResolvedValue(GTM_JSON);

    const result = await (agent as any).executeToolCall(makeTask(), {
      id: 'c1',
      name: 'generate_gtm_skill',
      input: { product },
    });

    expect(result.isError).toBe(false);
    // Neither offerContentDraft nor offerContentCalendar was passed, so the
    // skill's own optional handoff proposals never fire — nothing to
    // approve at all, and no separate/additional "Call tool" gate at the
    // outer executeToolCall() dispatch level either.
    expect(deps.approval.request).not.toHaveBeenCalled();
    expect(deps.events.emit).toHaveBeenCalledWith(
      'agent:gtm_generated',
      expect.objectContaining({ taskId: 'task-g1' })
    );
  });

  it('executeToolCall() dispatches generate_psych_skill via invokeSkill(), with no outer approval gate', async () => {
    const deps = makeDeps();
    const agent = new GtmAgent(deps);
    (agent as any).think = jest.fn().mockResolvedValue(PSYCH_JSON);

    const result = await (agent as any).executeToolCall(makeTask(), {
      id: 'c2',
      name: 'generate_psych_skill',
      input: { product },
    });

    expect(result.isError).toBe(false);
    expect(deps.approval.request).not.toHaveBeenCalled();
    expect(deps.events.emit).toHaveBeenCalledWith(
      'agent:gtm_psych_generated',
      expect.objectContaining({ taskId: 'task-g1' })
    );
  });

  it('exposes both skill-tools in config.toolSchemas, but never treats them as MCP-authorized', () => {
    const agent = new GtmAgent(makeDeps());
    const config = (agent as any).config;

    expect(config.toolSchemas).toHaveProperty('generate_gtm_skill');
    expect(config.toolSchemas).toHaveProperty('generate_psych_skill');
    expect(config.tools).not.toContain('generate_gtm_skill');
    expect(config.tools).not.toContain('generate_psych_skill');
  });

  it('an unrecognized tool name falls through to the approval-gate branch', async () => {
    const deps = makeDeps({ approval: { request: jest.fn().mockResolvedValue(false) } });
    const agent = new GtmAgent(deps);

    const result = await (agent as any).executeToolCall(makeTask(), {
      id: 'c3',
      name: 'some_future_tool',
      input: {},
    });

    expect(deps.approval.request).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'Call tool "some_future_tool"' })
    );
    expect(result).toEqual({ result: 'User declined this action.', isError: true });
  });
});
