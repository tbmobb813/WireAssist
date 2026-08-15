import type { AgentTask, ApprovalRequest, SkillAgentHandle } from '@wireassist/core';
import { proactiveInsightsSkill } from '../proactive-insights';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-pi1',
    agentRole: 'admin',
    description: 'Proactive insights',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'proactive_insights' },
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
    ...overrides,
  };
}

// getResolved() (and thus listDecisions()) returns most-recently-resolved
// first — newest-first order, matching the real ApprovalQueue.
function decision(
  overrides: Partial<ApprovalRequest> & {
    agentRole: string;
    action: string;
    status: 'approved' | 'rejected';
  }
): ApprovalRequest {
  return {
    id: `id-${Math.random()}`,
    taskId: 'task-x',
    payload: {},
    createdAt: new Date(),
    resolvedAt: new Date(),
    ...overrides,
  } as ApprovalRequest;
}

describe('proactiveInsightsSkill', () => {
  it('emits empty findings and skips think() when there is no streak', async () => {
    const think = jest.fn();
    const listDecisions = jest
      .fn()
      .mockReturnValue([
        decision({ agentRole: 'admin', action: 'Archive email thread', status: 'approved' }),
        decision({ agentRole: 'admin', action: 'Archive email thread', status: 'rejected' }),
      ]);
    const agent = makeAgentHandle({ think, listDecisions });

    await proactiveInsightsSkill.execute({ agent, task: makeTask(), input: {} });

    expect(think).not.toHaveBeenCalled();
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:proactive_insights_complete',
      expect.objectContaining({ findings: [] })
    );
  });

  it('flags a rejection streak of 3 in a row for the same (agentRole, action)', async () => {
    const listDecisions = jest
      .fn()
      .mockReturnValue([
        decision({ agentRole: 'admin', action: 'Archive email thread', status: 'rejected' }),
        decision({ agentRole: 'admin', action: 'Archive email thread', status: 'rejected' }),
        decision({ agentRole: 'admin', action: 'Archive email thread', status: 'rejected' }),
      ]);
    const agent = makeAgentHandle({ listDecisions });

    await proactiveInsightsSkill.execute({ agent, task: makeTask(), input: {} });

    expect(agent.think).toHaveBeenCalled();
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:proactive_insights_complete',
      expect.objectContaining({
        findings: [
          {
            agentRole: 'admin',
            action: 'Archive email thread',
            streak: 'rejected',
            count: 3,
          },
        ],
      })
    );
  });

  it('flags an approval streak of 3 in a row', async () => {
    const listDecisions = jest
      .fn()
      .mockReturnValue([
        decision({ agentRole: 'content', action: 'Schedule linkedin post', status: 'approved' }),
        decision({ agentRole: 'content', action: 'Schedule linkedin post', status: 'approved' }),
        decision({ agentRole: 'content', action: 'Schedule linkedin post', status: 'approved' }),
      ]);
    const agent = makeAgentHandle({ listDecisions });

    await proactiveInsightsSkill.execute({ agent, task: makeTask(), input: {} });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:proactive_insights_complete',
      expect.objectContaining({
        findings: [
          { agentRole: 'content', action: 'Schedule linkedin post', streak: 'approved', count: 3 },
        ],
      })
    );
  });

  it('does not flag a group whose most recent 3 are mixed', async () => {
    const listDecisions = jest
      .fn()
      .mockReturnValue([
        decision({ agentRole: 'admin', action: 'X', status: 'approved' }),
        decision({ agentRole: 'admin', action: 'X', status: 'rejected' }),
        decision({ agentRole: 'admin', action: 'X', status: 'approved' }),
      ]);
    const agent = makeAgentHandle({ listDecisions });

    await proactiveInsightsSkill.execute({ agent, task: makeTask(), input: {} });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:proactive_insights_complete',
      expect.objectContaining({ findings: [] })
    );
  });

  it('requests decision history with a limit and no agentRole filter (cross-agent)', async () => {
    const listDecisions = jest.fn().mockReturnValue([]);
    const agent = makeAgentHandle({ listDecisions });

    await proactiveInsightsSkill.execute({ agent, task: makeTask(), input: {} });

    expect(listDecisions).toHaveBeenCalledWith(
      expect.objectContaining({ limit: expect.any(Number) })
    );
    const callArg = listDecisions.mock.calls[0][0];
    expect(callArg.agentRole).toBeUndefined();
  });
});
