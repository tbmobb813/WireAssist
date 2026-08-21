import type { AgentTask, SkillAgentHandle } from '@wireassist/core';
import { stalePrsSkill } from '../stale-prs';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-sp1',
    agentRole: 'github',
    description: 'Stale PR check',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'stale_prs_nudge', pullRequests: [] },
    approvalRequired: false,
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

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe('stalePrsSkill', () => {
  it('never calls think() — the summary is a fixed template, not LLM-phrased', async () => {
    const think = jest.fn();
    const agent = makeAgentHandle({ think });

    await stalePrsSkill.execute({
      agent,
      task: makeTask(),
      input: {
        pullRequests: [{ number: 1, title: 'Fix bug', url: 'https://x/1', updatedAt: daysAgo(10) }],
      },
    });

    expect(think).not.toHaveBeenCalled();
  });

  it('emits an empty-state summary when nothing is stale', async () => {
    const agent = makeAgentHandle();

    await stalePrsSkill.execute({
      agent,
      task: makeTask(),
      input: {
        pullRequests: [{ number: 1, title: 'Fix bug', url: 'https://x/1', updatedAt: daysAgo(1) }],
      },
    });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:stale_prs_complete',
      expect.objectContaining({
        summary: 'No open pull requests have gone stale.',
        stale: [],
      })
    );
  });

  it('skips PRs updated within the daysStale threshold', async () => {
    const agent = makeAgentHandle();

    await stalePrsSkill.execute({
      agent,
      task: makeTask(),
      input: {
        pullRequests: [{ number: 1, title: 'Fix bug', url: 'https://x/1', updatedAt: daysAgo(2) }],
      },
    });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:stale_prs_complete',
      expect.objectContaining({ stale: [] })
    );
  });

  it('flags a PR at or past the default 5-day threshold', async () => {
    const agent = makeAgentHandle();

    await stalePrsSkill.execute({
      agent,
      task: makeTask(),
      input: {
        pullRequests: [
          { number: 42, title: 'Add feature', url: 'https://x/42', updatedAt: daysAgo(6) },
        ],
      },
    });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:stale_prs_complete',
      expect.objectContaining({
        stale: [expect.objectContaining({ number: 42, title: 'Add feature', daysStale: 6 })],
      })
    );
  });

  it('respects a custom daysStale input', async () => {
    const agent = makeAgentHandle();

    await stalePrsSkill.execute({
      agent,
      task: makeTask(),
      input: {
        daysStale: 1,
        pullRequests: [{ number: 1, title: 'Fix bug', url: 'https://x/1', updatedAt: daysAgo(2) }],
      },
    });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:stale_prs_complete',
      expect.objectContaining({ stale: [expect.objectContaining({ daysStale: 2 })] })
    );
  });

  it('flags multiple stale PRs independently', async () => {
    const agent = makeAgentHandle();

    await stalePrsSkill.execute({
      agent,
      task: makeTask(),
      input: {
        pullRequests: [
          { number: 1, title: 'Old PR', url: 'https://x/1', updatedAt: daysAgo(10) },
          { number: 2, title: 'Also old', url: 'https://x/2', updatedAt: daysAgo(6) },
          { number: 3, title: 'Fresh PR', url: 'https://x/3', updatedAt: daysAgo(1) },
        ],
      },
    });

    const emitted = (agent.emit as jest.Mock).mock.calls.find(
      ([event]) => event === 'agent:stale_prs_complete'
    )?.[1];
    expect(emitted.stale).toHaveLength(2);
    expect(emitted.stale.map((s: { number: number }) => s.number).sort()).toEqual([1, 2]);
  });
});
