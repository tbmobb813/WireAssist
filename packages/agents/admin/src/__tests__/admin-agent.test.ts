import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { AgentTask, IApprovalQueue, MemoryStore, MCPClient, EventBus } from '@wireassist/core';
import { AdminAgent } from '../admin-agent';
import * as autoApprovePolicy from '../auto-approve-policy';

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

describe('AdminAgent.triageEmail() — ignore-labeling and auto-approval', () => {
  // Uses the real auto-approve-policy module against an isolated temp file
  // (same approach as auto-approve-policy.test.ts) rather than mocking it,
  // so these tests exercise the actual eligibility/threshold logic too.
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'wireassist-admin-agent-'));
    process.env.WIREASSIST_ADMIN_AUTO_APPROVE_FILE = join(tempDir, 'admin-auto-approve.json');
  });

  afterEach(() => {
    delete process.env.WIREASSIST_ADMIN_AUTO_APPROVE_FILE;
    rmSync(tempDir, { recursive: true, force: true });
  });

  function triageResponse(ignore: { threadId: string; from: string; reason: string }[]) {
    return JSON.stringify({
      categories: { urgent: [], replyNeeded: [], fyi: [], ignore },
      summary: 'Quiet inbox.',
      urgentCount: 0,
      replyNeededCount: 0,
    });
  }

  it('proposes an ignore-label action and routes it through normal approval when not yet eligible', async () => {
    const deps = makeDeps({
      mcp: {
        call: jest
          .fn()
          .mockResolvedValueOnce([{ id: 't1', snippet: 'newsletter' }])
          .mockResolvedValueOnce(threadDetailMock()[0])
          .mockResolvedValue({ status: 'labeled' }),
      },
    });
    const agent = new AdminAgent(deps);
    (agent as any).think = jest
      .fn()
      .mockResolvedValue(
        triageResponse([{ threadId: 't1', from: 'a@example.com', reason: 'newsletter' }])
      );

    await agent.triageEmail(makeTask());

    expect(deps.approval.request).toHaveBeenCalledWith(
      expect.objectContaining({ action: expect.stringContaining('Ignore:') })
    );
    expect(deps.mcp.call).toHaveBeenCalledWith('gmail_label_thread', {
      threadId: 't1',
      labelName: 'IGNORED',
      from: 'a@example.com',
    });
    // The approval just recorded counts toward the threshold.
    expect(autoApprovePolicy.listAutoApproveRecords()['a@example.com'].consecutiveApprovals).toBe(
      1
    );
  });

  it('auto-approves an ignore-label action for a sender the policy already trusts, skipping the approval queue', async () => {
    for (let i = 0; i < autoApprovePolicy.AUTO_APPROVE_THRESHOLD; i++) {
      autoApprovePolicy.recordDecision('a@example.com', true);
    }

    const deps = makeDeps({
      mcp: {
        call: jest
          .fn()
          .mockResolvedValueOnce([{ id: 't1', snippet: 'newsletter' }])
          .mockResolvedValueOnce(threadDetailMock()[0])
          .mockResolvedValue({ status: 'labeled' }),
      },
    });
    const agent = new AdminAgent(deps);
    (agent as any).think = jest
      .fn()
      .mockResolvedValue(
        triageResponse([{ threadId: 't1', from: 'a@example.com', reason: 'repeat newsletter' }])
      );

    await agent.triageEmail(makeTask());

    expect(deps.approval.request).not.toHaveBeenCalled();
    expect(deps.events.emit).toHaveBeenCalledWith(
      'agent:auto_approved',
      expect.objectContaining({ taskId: 'task-a1' })
    );
    expect(deps.mcp.call).toHaveBeenCalledWith('gmail_label_thread', {
      threadId: 't1',
      labelName: 'IGNORED',
      from: 'a@example.com',
    });
  });

  it('never auto-approves a non-ignore label (e.g. URGENT), regardless of sender history', async () => {
    for (let i = 0; i < autoApprovePolicy.AUTO_APPROVE_THRESHOLD; i++) {
      autoApprovePolicy.recordDecision('a@example.com', true);
    }

    const deps = makeDeps({
      mcp: {
        call: jest
          .fn()
          .mockResolvedValueOnce([{ id: 't1', snippet: 'urgent thing' }])
          .mockResolvedValueOnce(threadDetailMock()[0])
          .mockResolvedValue({ status: 'labeled' }),
      },
    });
    const agent = new AdminAgent(deps);
    (agent as any).think = jest.fn().mockResolvedValue(
      JSON.stringify({
        categories: {
          urgent: [
            { threadId: 't1', from: 'a@example.com', subject: 'Hi', reason: 'deadline today' },
          ],
          replyNeeded: [],
          fyi: [],
          ignore: [],
        },
        summary: 'One urgent item.',
        urgentCount: 1,
        replyNeededCount: 0,
      })
    );

    await agent.triageEmail(makeTask());

    expect(deps.approval.request).toHaveBeenCalledWith(
      expect.objectContaining({ action: expect.stringContaining('URGENT') })
    );
    expect(deps.events.emit).not.toHaveBeenCalledWith('agent:auto_approved', expect.anything());
  });
});

describe('AdminAgent — chat tool-calling loop', () => {
  it('handleFreeform() drives runToolLoop() and emits the result as agent:freeform_response', async () => {
    const deps = makeDeps();
    const agent = new AdminAgent(deps);
    const runToolLoopSpy = jest
      .spyOn(agent as any, 'runToolLoop')
      .mockResolvedValue('Here is your answer.');

    const task = makeTask({ input: { type: 'freeform', prompt: 'what is on my calendar today?' } });
    await agent.handleFreeform(task);

    expect(runToolLoopSpy).toHaveBeenCalledWith(
      task,
      'what is on my calendar today?',
      expect.objectContaining({ extraContext: expect.any(String) })
    );
    expect(deps.events.emit).toHaveBeenCalledWith('agent:freeform_response', {
      taskId: task.id,
      response: 'Here is your answer.',
    });
  });

  it('passes task.input.history through to runToolLoop as priorMessages', async () => {
    const deps = makeDeps();
    const agent = new AdminAgent(deps);
    const runToolLoopSpy = jest.spyOn(agent as any, 'runToolLoop').mockResolvedValue('answer');
    const history = [{ role: 'user' as const, content: 'earlier question' }];

    const task = makeTask({
      input: { type: 'freeform', prompt: 'follow-up', history },
    });
    await agent.handleFreeform(task);

    expect(runToolLoopSpy).toHaveBeenCalledWith(
      task,
      'follow-up',
      expect.objectContaining({ priorMessages: history })
    );
  });

  it('passes task.input.images through to runToolLoop', async () => {
    const deps = makeDeps();
    const agent = new AdminAgent(deps);
    const runToolLoopSpy = jest.spyOn(agent as any, 'runToolLoop').mockResolvedValue('answer');
    const images = [{ mediaType: 'image/png', data: 'base64data' }];

    const task = makeTask({
      input: { type: 'freeform', prompt: "what's this?", images },
    });
    await agent.handleFreeform(task);

    expect(runToolLoopSpy).toHaveBeenCalledWith(
      task,
      "what's this?",
      expect.objectContaining({ images })
    );
  });

  it('executeToolCall() runs a read-only tool immediately, with no approval', async () => {
    const deps = makeDeps({ mcp: { call: jest.fn().mockResolvedValue([{ id: 't1' }]) } });
    const agent = new AdminAgent(deps);

    const result = await (agent as any).executeToolCall(makeTask(), {
      id: 'c1',
      name: 'gmail_list_threads',
      input: { q: 'is:unread' },
    });

    expect(result).toEqual({ result: [{ id: 't1' }], isError: false });
    expect(deps.approval.request).not.toHaveBeenCalled();
    expect(deps.mcp.call).toHaveBeenCalledWith('gmail_list_threads', { q: 'is:unread' });
  });

  it('executeToolCall() gates a mutating tool behind approval and executes it once approved', async () => {
    const deps = makeDeps({ mcp: { call: jest.fn().mockResolvedValue({ messageId: 'm1' }) } });
    const agent = new AdminAgent(deps);

    const result = await (agent as any).executeToolCall(makeTask(), {
      id: 'c1',
      name: 'gmail_send',
      input: { to: 'a@example.com', subject: 'Hi', body: 'Hello' },
    });

    expect(deps.approval.request).toHaveBeenCalled();
    expect(result).toEqual({ result: { messageId: 'm1' }, isError: false });
  });

  it('executeToolCall() reports a declined mutating action as an error result, without calling the tool', async () => {
    const deps = makeDeps({ approval: { request: jest.fn().mockResolvedValue(false) } });
    const agent = new AdminAgent(deps);

    const result = await (agent as any).executeToolCall(makeTask(), {
      id: 'c1',
      name: 'gmail_send',
      input: { to: 'a@example.com', subject: 'Hi', body: 'Hello' },
    });

    expect(result).toEqual({ result: 'User declined this action.', isError: true });
    expect(deps.mcp.call).not.toHaveBeenCalled();
  });
});

describe('AdminAgent — delegate_to_agent', () => {
  it('proposes approval with a human-readable description before doing anything', async () => {
    const deps = makeDeps();
    const agent = new AdminAgent(deps);

    await (agent as any).executeToolCall(makeTask(), {
      id: 'c1',
      name: 'delegate_to_agent',
      input: { targetRole: 'content', prompt: 'write a launch post about our new feature' },
    });

    expect(deps.approval.request).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.stringContaining('Hand off to Content agent'),
      })
    );
  });

  it('on approval, emits agent:handoff_requested with a correctly-shaped task and returns a non-error result', async () => {
    const deps = makeDeps();
    const agent = new AdminAgent(deps);
    const history = [{ role: 'user' as const, content: 'earlier turn' }];

    const result = await (agent as any).executeToolCall(
      makeTask({ input: { type: 'freeform', history }, objectiveId: 'obj-1' }),
      {
        id: 'c1',
        name: 'delegate_to_agent',
        input: { targetRole: 'content', prompt: 'write a launch post' },
      }
    );

    expect(deps.events.emit).toHaveBeenCalledWith(
      'agent:handoff_requested',
      expect.objectContaining({
        task: expect.objectContaining({
          agentRole: 'content',
          input: { type: 'freeform', prompt: 'write a launch post', history },
          objectiveId: 'obj-1',
        }),
      })
    );
    expect(result.isError).toBe(false);
    expect(String(result.result)).toMatch(/Content agent/);
  });

  it('on decline, never emits a handoff and returns an error result', async () => {
    const deps = makeDeps({ approval: { request: jest.fn().mockResolvedValue(false) } });
    const agent = new AdminAgent(deps);

    const result = await (agent as any).executeToolCall(makeTask(), {
      id: 'c1',
      name: 'delegate_to_agent',
      input: { targetRole: 'research', prompt: 'find competitor pricing' },
    });

    expect(deps.events.emit).not.toHaveBeenCalledWith('agent:handoff_requested', expect.anything());
    expect(result).toEqual({ result: 'User declined the handoff.', isError: true });
  });

  it('rejects an invalid targetRole without ever proposing approval', async () => {
    const deps = makeDeps();
    const agent = new AdminAgent(deps);

    const result = await (agent as any).executeToolCall(makeTask(), {
      id: 'c1',
      name: 'delegate_to_agent',
      input: { targetRole: 'admin', prompt: 'do something' },
    });

    expect(result.isError).toBe(true);
    expect(deps.approval.request).not.toHaveBeenCalled();
  });

  it('rejects a missing/empty prompt without ever proposing approval', async () => {
    const deps = makeDeps();
    const agent = new AdminAgent(deps);

    const result = await (agent as any).executeToolCall(makeTask(), {
      id: 'c1',
      name: 'delegate_to_agent',
      input: { targetRole: 'content', prompt: '   ' },
    });

    expect(result.isError).toBe(true);
    expect(deps.approval.request).not.toHaveBeenCalled();
  });
});

describe('AdminAgent — composable skill-tools in the chat loop', () => {
  it('executeToolCall() dispatches email_triage_skill via invokeSkill(), never gating the outer call behind approval', async () => {
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
      JSON.stringify({
        categories: { urgent: [], replyNeeded: [], fyi: [], ignore: [] },
        summary: 'All quiet.',
        urgentCount: 0,
        replyNeededCount: 0,
      })
    );

    const result = await (agent as any).executeToolCall(makeTask(), {
      id: 'c1',
      name: 'email_triage_skill',
      input: { maxEmails: 5 },
    });

    expect(result.isError).toBe(false);
    expect(result.result).toEqual(
      expect.objectContaining({ summary: 'All quiet.', totalEmails: 1 })
    );
    // No proposedActions from an empty triage, so approval.request is never
    // reached at all — including no extra "Call tool" gate at the outer
    // dispatch level.
    expect(deps.approval.request).not.toHaveBeenCalled();
    expect(deps.mcp.call).toHaveBeenCalledWith('gmail_list_threads', expect.objectContaining({}));
  });

  it('executeToolCall() dispatches calendar_review_skill via invokeSkill() and surfaces its emitted review as the result', async () => {
    const deps = makeDeps({ mcp: { call: jest.fn().mockResolvedValue([]) } });
    const agent = new AdminAgent(deps);
    (agent as any).think = jest.fn().mockResolvedValue(
      JSON.stringify({
        conflicts: [],
        overloadedDays: [],
        suggestions: [],
        summary: 'Light week.',
      })
    );

    const result = await (agent as any).executeToolCall(makeTask(), {
      id: 'c2',
      name: 'calendar_review_skill',
      input: { daysAhead: 3 },
    });

    expect(result.isError).toBe(false);
    expect(result.result).toEqual(
      expect.objectContaining({ review: expect.objectContaining({ summary: 'Light week.' }) })
    );
    expect(deps.approval.request).not.toHaveBeenCalled();
  });

  it('exposes both skill-tools in config.toolSchemas but never treats them as MCP-authorized tools', () => {
    const deps = makeDeps();
    const agent = new AdminAgent(deps);
    const config = (agent as any).config;

    expect(config.toolSchemas).toHaveProperty('email_triage_skill');
    expect(config.toolSchemas).toHaveProperty('calendar_review_skill');
    expect(config.tools).not.toContain('email_triage_skill');
    expect(config.tools).not.toContain('calendar_review_skill');
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
