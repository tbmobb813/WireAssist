import type { AgentTask, SkillAgentHandle } from '@wireassist/core';
import { expenseDigestSkill } from '../expense-digest';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-ed1',
    agentRole: 'admin',
    description: 'Expense digest',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'expense_digest' },
    approvalRequired: false,
    ...overrides,
  };
}

function makeAgentHandle(overrides: Partial<SkillAgentHandle> = {}): SkillAgentHandle {
  return {
    think: jest.fn().mockResolvedValue('spend summary'),
    useTool: jest.fn().mockResolvedValue([]),
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

describe('expenseDigestSkill', () => {
  it('emits the empty-state summary and never calls think() when nothing is found', async () => {
    const think = jest.fn();
    const useTool = jest.fn().mockResolvedValue([]);
    const agent = makeAgentHandle({ think, useTool });

    await expenseDigestSkill.execute({ agent, task: makeTask(), input: {} });

    expect(think).not.toHaveBeenCalled();
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:expense_digest_complete',
      expect.objectContaining({ hasExpenses: false })
    );
  });

  it('searches gmail with the default 30-day window and summarizes spend', async () => {
    const useTool = jest
      .fn()
      .mockResolvedValue([{ id: 'r1', snippet: 'Receipt from Acme SaaS: $49.00' }]);
    const think = jest.fn().mockResolvedValue('Software: $49.00');
    const agent = makeAgentHandle({ useTool, think });

    await expenseDigestSkill.execute({ agent, task: makeTask(), input: {} });

    expect(useTool).toHaveBeenCalledWith(
      'gmail_search',
      expect.objectContaining({ q: expect.stringContaining('newer_than:30d') })
    );
    expect(think.mock.calls[0][0]).toContain('Acme SaaS: $49.00');
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:expense_digest_complete',
      expect.objectContaining({ summary: 'Software: $49.00', hasExpenses: true })
    );
  });

  it('respects a custom daysAgo input', async () => {
    const useTool = jest.fn().mockResolvedValue([]);
    const agent = makeAgentHandle({ useTool });

    await expenseDigestSkill.execute({ agent, task: makeTask(), input: { daysAgo: 7 } });

    expect(useTool).toHaveBeenCalledWith(
      'gmail_search',
      expect.objectContaining({ q: expect.stringContaining('newer_than:7d') })
    );
  });
});
