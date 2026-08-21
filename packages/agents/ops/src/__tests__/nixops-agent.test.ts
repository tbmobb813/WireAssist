import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
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
  it('config.toolSchemas is populated for sheets_read, list_workflows, and run_workflow_skill', () => {
    const agent = new NixOpsAgent(makeDeps());
    const toolSchemas = (agent as any).config.toolSchemas;
    expect(Object.keys(toolSchemas).sort()).toEqual(
      [
        'list_workflows',
        'run_workflow_skill',
        'sheets_read',
        'propose_skill_skill',
        'delegate_to_agent',
      ].sort()
    );
  });

  it('delegate_to_agent dispatches to the shared BaseAgent handler (proposes approval, emits handoff)', async () => {
    const deps = makeDeps();
    const agent = new NixOpsAgent(deps);

    const result = await (agent as any).executeToolCall(makeTask(), {
      id: 'c1',
      name: 'delegate_to_agent',
      input: { targetRole: 'content', prompt: 'draft a launch post' },
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

  it('passes input.images through to runToolLoop', async () => {
    const deps = makeDeps();
    const agent = new NixOpsAgent(deps);
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

describe('NixOpsAgent — composable skill-tools in the chat loop', () => {
  // Uses the real trust-stage module against an isolated temp file (same
  // approach used elsewhere in this package) — run_workflow_skill reads
  // getTrustStage() directly, not through the agent handle, so this keeps
  // the test deterministic (trust stage 2, the default) regardless of any
  // real ~/.wireassist/ops-trust.json state on the host.
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'wireassist-ops-nixops-agent-'));
    process.env.WIREASSIST_OPS_TRUST_FILE = join(tempDir, 'ops-trust.json');
  });

  afterEach(() => {
    delete process.env.WIREASSIST_OPS_TRUST_FILE;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('executeToolCall() runs list_workflows immediately, with no approval', async () => {
    const deps = makeDeps({
      mcp: { call: jest.fn().mockResolvedValue({ workflows: ['nixlevel-listing'] }) },
    });
    const agent = new NixOpsAgent(deps);

    const result = await (agent as any).executeToolCall(makeTask(), {
      id: 'c1',
      name: 'list_workflows',
      input: {},
    });

    expect(result).toEqual({ result: { workflows: ['nixlevel-listing'] }, isError: false });
    expect(deps.approval.request).not.toHaveBeenCalled();
    expect(deps.mcp.call).toHaveBeenCalledWith('list_workflows', {});
  });

  it('executeToolCall() dispatches run_workflow_skill via invokeSkill(), letting the skill self-gate its own delivery approval rather than gating the outer call a second time', async () => {
    const deps = makeDeps({ approval: { request: jest.fn().mockResolvedValue(true) } });
    const agent = new NixOpsAgent(deps);
    (agent as any).think = jest.fn().mockResolvedValue('VERDICT: PROCEED\n\nLooks fine.');

    const result = await (agent as any).executeToolCall(makeTask(), {
      id: 'c2',
      name: 'run_workflow_skill',
      input: { workflow: 'nixlevel-listing', brief: 'test run' },
    });

    expect(result.isError).toBe(false);
    // Called exactly once — the skill's own internal "deliver this run?"
    // proposal (trust stage 2, the default). No separate/additional "Call
    // tool" gate at the outer executeToolCall() dispatch level.
    expect(deps.approval.request).toHaveBeenCalledTimes(1);
    expect(result.result).toEqual(
      expect.objectContaining({ workflow: 'nixlevel-listing', approved: true, autoApproved: false })
    );
  });

  it('exposes list_workflows and run_workflow_skill in config.toolSchemas, but never treats run_workflow_skill as MCP-authorized', () => {
    const agent = new NixOpsAgent(makeDeps());
    const config = (agent as any).config;

    expect(config.toolSchemas).toHaveProperty('list_workflows');
    expect(config.toolSchemas).toHaveProperty('run_workflow_skill');
    expect(config.tools).not.toContain('run_workflow_skill');
  });
});
