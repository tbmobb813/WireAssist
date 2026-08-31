import type { AgentTask, SkillAgentHandle } from '@wireassist/core';
import { budgetWarningSkill } from '../budget-warning';
import { budgetTracker } from '../../budget';
import type { BudgetStatus } from '../../budget';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-bw1',
    agentRole: 'admin',
    description: 'Budget warning check',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'budget_warning_nudge' },
    approvalRequired: true,
    ...overrides,
  };
}

function makeAgentHandle(overrides: Partial<SkillAgentHandle> = {}): SkillAgentHandle {
  return {
    think: jest.fn().mockResolvedValue(''),
    useTool: jest.fn(),
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

function stubStatus(overrides: Partial<BudgetStatus> = {}): BudgetStatus {
  return {
    budget: 30,
    spent: 10,
    remaining: 20,
    percent: (10 / 30) * 100,
    byModel: {},
    resetsAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('budgetWarningSkill', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('never calls agent.think() — this is plain arithmetic, not an LLM call', async () => {
    jest.spyOn(budgetTracker, 'status').mockReturnValue(stubStatus());
    const think = jest.fn();
    const agent = makeAgentHandle({ think });

    await budgetWarningSkill.execute({ agent, task: makeTask(), input: {} });

    expect(think).not.toHaveBeenCalled();
  });

  it('reports warranted: false when under the default 80% threshold', async () => {
    jest.spyOn(budgetTracker, 'status').mockReturnValue(stubStatus({ percent: 50 }));
    const agent = makeAgentHandle();

    await budgetWarningSkill.execute({ agent, task: makeTask(), input: {} });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:budget_warning_complete',
      expect.objectContaining({ warranted: false, percent: 50 })
    );
  });

  it('reports warranted: true when at or past the default 80% threshold', async () => {
    jest.spyOn(budgetTracker, 'status').mockReturnValue(stubStatus({ spent: 25.5, percent: 85 }));
    const agent = makeAgentHandle();

    await budgetWarningSkill.execute({ agent, task: makeTask(), input: {} });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:budget_warning_complete',
      expect.objectContaining({
        warranted: true,
        percent: 85,
        spent: 25.5,
        summary: expect.stringContaining('80% warning threshold'),
      })
    );
  });

  it('respects a custom thresholdPercent input', async () => {
    jest.spyOn(budgetTracker, 'status').mockReturnValue(stubStatus({ percent: 55 }));
    const agent = makeAgentHandle();

    await budgetWarningSkill.execute({
      agent,
      task: makeTask(),
      input: { thresholdPercent: 50 },
    });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:budget_warning_complete',
      expect.objectContaining({ warranted: true })
    );
  });

  it('treats exactly-at-threshold as warranted', async () => {
    jest.spyOn(budgetTracker, 'status').mockReturnValue(stubStatus({ percent: 80 }));
    const agent = makeAgentHandle();

    await budgetWarningSkill.execute({ agent, task: makeTask(), input: {} });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:budget_warning_complete',
      expect.objectContaining({ warranted: true })
    );
  });
});
