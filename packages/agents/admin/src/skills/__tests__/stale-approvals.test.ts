import type { AgentTask, ApprovalRequest, SkillAgentHandle } from '@wireassist/core';
import { staleApprovalsSkill } from '../stale-approvals';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-sa1',
    agentRole: 'admin',
    description: 'Stale approvals',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'stale_approvals_nudge' },
    approvalRequired: true,
    ...overrides,
  };
}

function makeAgentHandle(overrides: Partial<SkillAgentHandle> = {}): SkillAgentHandle {
  return {
    think: jest.fn().mockResolvedValue('digest'),
    useTool: jest.fn(),
    loadContext: jest.fn().mockResolvedValue(''),
    remember: jest.fn(),
    proposeAction: jest.fn().mockResolvedValue(true),
    emit: jest.fn(),
    runToolLoop: jest.fn().mockResolvedValue(''),
    listDecisions: jest.fn().mockReturnValue([]),
    listPending: jest.fn().mockReturnValue([]),
    ...overrides,
  };
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function pending(
  overrides: Partial<ApprovalRequest> & { agentRole: string; action: string }
): ApprovalRequest {
  return {
    id: `id-${Math.random()}`,
    taskId: 'task-x',
    payload: {},
    status: 'pending',
    createdAt: new Date(),
    ...overrides,
  } as ApprovalRequest;
}

describe('staleApprovalsSkill', () => {
  it('emits an empty-state summary and skips think() when nothing is pending', async () => {
    const think = jest.fn();
    const agent = makeAgentHandle({ think, listPending: jest.fn().mockReturnValue([]) });

    await staleApprovalsSkill.execute({ agent, task: makeTask(), input: {} });

    expect(think).not.toHaveBeenCalled();
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:stale_approvals_complete',
      expect.objectContaining({ summary: 'No approvals have been sitting stale.', stale: [] })
    );
  });

  it('skips approvals younger than the daysStale threshold', async () => {
    const listPending = jest
      .fn()
      .mockReturnValue([
        pending({ agentRole: 'admin', action: 'Draft reply', createdAt: daysAgo(1) }),
      ]);
    const agent = makeAgentHandle({ listPending });

    await staleApprovalsSkill.execute({ agent, task: makeTask(), input: {} });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:stale_approvals_complete',
      expect.objectContaining({ stale: [] })
    );
  });

  it('flags an approval pending at or past the default 3-day threshold', async () => {
    const listPending = jest
      .fn()
      .mockReturnValue([
        pending({
          agentRole: 'strategy',
          action: 'deliver_workflow_output',
          createdAt: daysAgo(4),
        }),
      ]);
    const agent = makeAgentHandle({ listPending });

    await staleApprovalsSkill.execute({ agent, task: makeTask(), input: {} });

    expect(agent.think).toHaveBeenCalled();
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:stale_approvals_complete',
      expect.objectContaining({
        stale: [
          expect.objectContaining({
            agentRole: 'strategy',
            action: 'deliver_workflow_output',
            daysPending: 4,
          }),
        ],
      })
    );
  });

  it('respects a custom daysStale input', async () => {
    const listPending = jest
      .fn()
      .mockReturnValue([
        pending({ agentRole: 'admin', action: 'Draft reply', createdAt: daysAgo(2) }),
      ]);
    const agent = makeAgentHandle({ listPending });

    await staleApprovalsSkill.execute({ agent, task: makeTask(), input: { daysStale: 1 } });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:stale_approvals_complete',
      expect.objectContaining({ stale: [expect.objectContaining({ daysPending: 2 })] })
    );
  });

  it('flags multiple stale approvals across different agents independently', async () => {
    const listPending = jest
      .fn()
      .mockReturnValue([
        pending({ agentRole: 'admin', action: 'Draft reply', createdAt: daysAgo(5) }),
        pending({ agentRole: 'content', action: 'Schedule linkedin post', createdAt: daysAgo(3) }),
        pending({ agentRole: 'research', action: 'Store synthesis for: X', createdAt: daysAgo(1) }),
      ]);
    const agent = makeAgentHandle({ listPending });

    await staleApprovalsSkill.execute({ agent, task: makeTask(), input: {} });

    const emitted = (agent.emit as jest.Mock).mock.calls.find(
      ([event]) => event === 'agent:stale_approvals_complete'
    )?.[1];
    expect(emitted.stale).toHaveLength(2);
    expect(emitted.stale.map((s: { agentRole: string }) => s.agentRole).sort()).toEqual([
      'admin',
      'content',
    ]);
  });
});
