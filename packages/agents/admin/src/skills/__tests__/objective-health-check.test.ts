import type { AgentTask, SkillAgentHandle } from '@wireassist/core';
import { objectiveHealthCheckSkill } from '../objective-health-check';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-ohc1',
    agentRole: 'admin',
    description: 'Objective health check',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'objective_health_check_nudge', objectives: [] },
    approvalRequired: true,
    ...overrides,
  };
}

function makeAgentHandle(overrides: Partial<SkillAgentHandle> = {}): SkillAgentHandle {
  return {
    think: jest.fn(),
    useTool: jest.fn(),
    loadContext: jest.fn().mockResolvedValue(''),
    remember: jest.fn(),
    proposeAction: jest.fn().mockResolvedValue(true),
    emit: jest.fn(),
    runToolLoop: jest.fn().mockResolvedValue(''),
    listDecisions: jest.fn().mockReturnValue([]),
    listPending: jest.fn().mockReturnValue([]),
    listMemories: jest.fn().mockReturnValue([]),
    ...overrides,
  };
}

function daysAgo(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

describe('objectiveHealthCheckSkill', () => {
  it('never calls think() — the summary is a fixed template, not LLM-phrased', async () => {
    const think = jest.fn();
    const agent = makeAgentHandle({ think });

    await objectiveHealthCheckSkill.execute({
      agent,
      task: makeTask(),
      input: { objectives: [{ id: 'o1', title: 'Launch v2', latestEventAt: daysAgo(10) }] },
    });

    expect(think).not.toHaveBeenCalled();
  });

  it('emits an empty-state summary when nothing is stale', async () => {
    const agent = makeAgentHandle();

    await objectiveHealthCheckSkill.execute({
      agent,
      task: makeTask(),
      input: { objectives: [{ id: 'o1', title: 'Launch v2', latestEventAt: daysAgo(1) }] },
    });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:objective_health_check_complete',
      expect.objectContaining({
        summary: 'Every active Objective has seen recent activity.',
        stale: [],
      })
    );
  });

  it('skips objectives active within the daysStale threshold', async () => {
    const agent = makeAgentHandle();

    await objectiveHealthCheckSkill.execute({
      agent,
      task: makeTask(),
      input: { objectives: [{ id: 'o1', title: 'Launch v2', latestEventAt: daysAgo(2) }] },
    });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:objective_health_check_complete',
      expect.objectContaining({ stale: [] })
    );
  });

  it('flags an objective at or past the default 5-day threshold', async () => {
    const agent = makeAgentHandle();

    await objectiveHealthCheckSkill.execute({
      agent,
      task: makeTask(),
      input: { objectives: [{ id: 'o1', title: 'Launch v2', latestEventAt: daysAgo(6) }] },
    });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:objective_health_check_complete',
      expect.objectContaining({
        stale: [expect.objectContaining({ id: 'o1', title: 'Launch v2', daysSinceActivity: 6 })],
      })
    );
  });

  it('flags an objective with no recorded activity regardless of threshold', async () => {
    const agent = makeAgentHandle();

    await objectiveHealthCheckSkill.execute({
      agent,
      task: makeTask(),
      input: { objectives: [{ id: 'o1', title: 'New objective', latestEventAt: null }] },
    });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:objective_health_check_complete',
      expect.objectContaining({
        stale: [expect.objectContaining({ id: 'o1', daysSinceActivity: null })],
      })
    );
  });

  it('respects a custom daysStale input', async () => {
    const agent = makeAgentHandle();

    await objectiveHealthCheckSkill.execute({
      agent,
      task: makeTask(),
      input: {
        daysStale: 1,
        objectives: [{ id: 'o1', title: 'Launch v2', latestEventAt: daysAgo(2) }],
      },
    });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:objective_health_check_complete',
      expect.objectContaining({
        stale: [expect.objectContaining({ daysSinceActivity: 2 })],
      })
    );
  });

  it('flags multiple stale objectives independently', async () => {
    const agent = makeAgentHandle();

    await objectiveHealthCheckSkill.execute({
      agent,
      task: makeTask(),
      input: {
        objectives: [
          { id: 'o1', title: 'Launch v2', latestEventAt: daysAgo(10) },
          { id: 'o2', title: 'Hire contractor', latestEventAt: daysAgo(6) },
          { id: 'o3', title: 'Renew domain', latestEventAt: daysAgo(1) },
        ],
      },
    });

    const emitted = (agent.emit as jest.Mock).mock.calls.find(
      ([event]) => event === 'agent:objective_health_check_complete'
    )?.[1];
    expect(emitted.stale).toHaveLength(2);
    expect(emitted.stale.map((s: { id: string }) => s.id).sort()).toEqual(['o1', 'o2']);
  });
});
