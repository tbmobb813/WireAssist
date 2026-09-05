import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { AgentTask, SkillAgentHandle } from '@wireassist/core';
import { proposeBatchOrAutoApprove } from '../skills/propose-or-auto-approve';
import * as autoApprovePolicy from '../auto-approve-policy';
import type { ProposedAction } from '../types';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-1',
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

function makeAgentHandle(overrides: Partial<SkillAgentHandle> = {}): SkillAgentHandle {
  return {
    think: jest.fn().mockResolvedValue(''),
    useTool: jest.fn().mockResolvedValue({}),
    loadContext: jest.fn().mockResolvedValue(''),
    remember: jest.fn(),
    proposeAction: jest.fn().mockResolvedValue(true),
    emit: jest.fn(),
    runToolLoop: jest.fn().mockResolvedValue(''),
    listDecisions: jest.fn().mockReturnValue([]),
    listPending: jest.fn().mockReturnValue([]),
    listOrphanedApprovals: jest.fn().mockReturnValue([]),
    listMemories: jest.fn().mockReturnValue([]),
    ...overrides,
  };
}

function ignoreAction(from: string, id = from): ProposedAction {
  return {
    id,
    type: 'gmail_label_thread',
    label: `Ignore: "newsletter from ${from}"`,
    payload: { threadId: `t-${id}`, labelName: 'IGNORED', from },
  };
}

function urgentAction(id: string): ProposedAction {
  return {
    id,
    type: 'gmail_label_thread',
    label: `Mark as URGENT: "${id}"`,
    payload: { threadId: `t-${id}`, labelName: 'URGENT' },
  };
}

describe('proposeBatchOrAutoApprove', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'wireassist-batch-approve-'));
    process.env.WIREASSIST_ADMIN_AUTO_APPROVE_FILE = join(tempDir, 'admin-auto-approve.json');
  });

  afterEach(() => {
    delete process.env.WIREASSIST_ADMIN_AUTO_APPROVE_FILE;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('never proposes anything when there are no actions', async () => {
    const agent = makeAgentHandle();
    await proposeBatchOrAutoApprove(agent, makeTask(), []);
    expect(agent.proposeAction).not.toHaveBeenCalled();
    expect(agent.useTool).not.toHaveBeenCalled();
  });

  it("uses the single action's own label rather than a generic batch label when only one needs approval", async () => {
    const agent = makeAgentHandle();
    const action = urgentAction('a1');

    await proposeBatchOrAutoApprove(agent, makeTask(), [action]);

    expect(agent.proposeAction).toHaveBeenCalledWith(
      expect.anything(),
      'Mark as URGENT: "a1"',
      expect.anything()
    );
  });

  it('bundles multiple actions needing approval into exactly one proposeAction call', async () => {
    const agent = makeAgentHandle();
    const actions = [urgentAction('a1'), urgentAction('a2'), urgentAction('a3')];

    await proposeBatchOrAutoApprove(agent, makeTask(), actions);

    expect(agent.proposeAction).toHaveBeenCalledTimes(1);
    expect(agent.proposeAction).toHaveBeenCalledWith(
      expect.anything(),
      'Approve 3 triage actions?',
      { actions }
    );
  });

  it('on batch approval, executes every action in the batch', async () => {
    const agent = makeAgentHandle({ proposeAction: jest.fn().mockResolvedValue(true) });
    const actions = [urgentAction('a1'), urgentAction('a2')];

    await proposeBatchOrAutoApprove(agent, makeTask(), actions);

    expect(agent.useTool).toHaveBeenCalledWith('gmail_label_thread', actions[0].payload);
    expect(agent.useTool).toHaveBeenCalledWith('gmail_label_thread', actions[1].payload);
  });

  it('on batch rejection, executes none of the actions', async () => {
    const agent = makeAgentHandle({ proposeAction: jest.fn().mockResolvedValue(false) });
    const actions = [urgentAction('a1'), urgentAction('a2')];

    await proposeBatchOrAutoApprove(agent, makeTask(), actions);

    expect(agent.useTool).not.toHaveBeenCalled();
  });

  it('auto-approve-eligible actions execute immediately with no approval prompt at all', async () => {
    for (let i = 0; i < autoApprovePolicy.AUTO_APPROVE_THRESHOLD; i++) {
      autoApprovePolicy.recordDecision('trusted@example.com', true);
    }
    const agent = makeAgentHandle();
    const action = ignoreAction('trusted@example.com');

    await proposeBatchOrAutoApprove(agent, makeTask(), [action]);

    expect(agent.proposeAction).not.toHaveBeenCalled();
    expect(agent.useTool).toHaveBeenCalledWith('gmail_label_thread', action.payload);
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:auto_approved',
      expect.objectContaining({ action })
    );
  });

  it('splits a mixed batch: auto-approved senders execute immediately, everyone else goes into one bundled prompt', async () => {
    for (let i = 0; i < autoApprovePolicy.AUTO_APPROVE_THRESHOLD; i++) {
      autoApprovePolicy.recordDecision('trusted@example.com', true);
    }
    const agent = makeAgentHandle({ proposeAction: jest.fn().mockResolvedValue(true) });
    const trusted = ignoreAction('trusted@example.com', 'trusted');
    const untrusted = ignoreAction('unknown@example.com', 'unknown');

    await proposeBatchOrAutoApprove(agent, makeTask(), [trusted, untrusted]);

    // Auto-approved one: no prompt, executed directly.
    expect(agent.useTool).toHaveBeenCalledWith('gmail_label_thread', trusted.payload);
    // The untrusted one is the only thing that reaches proposeAction, and it's
    // the sole item so it keeps its own label rather than a generic batch one.
    expect(agent.proposeAction).toHaveBeenCalledTimes(1);
    expect(agent.proposeAction).toHaveBeenCalledWith(expect.anything(), untrusted.label, {
      actions: [untrusted],
    });
  });

  it('records a sender decision for every ignore-type action in the batch, not just the first', async () => {
    const agent = makeAgentHandle({ proposeAction: jest.fn().mockResolvedValue(true) });
    const a = ignoreAction('a@example.com', 'a');
    const b = ignoreAction('b@example.com', 'b');

    await proposeBatchOrAutoApprove(agent, makeTask(), [a, b]);

    expect(autoApprovePolicy.listAutoApproveRecords()['a@example.com'].consecutiveApprovals).toBe(
      1
    );
    expect(autoApprovePolicy.listAutoApproveRecords()['b@example.com'].consecutiveApprovals).toBe(
      1
    );
  });
});
