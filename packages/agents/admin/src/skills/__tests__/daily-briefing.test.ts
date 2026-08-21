import type { AgentTask, SkillAgentHandle } from '@wireassist/core';
import { dailyBriefingSkill } from '../daily-briefing';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-db1',
    agentRole: 'admin',
    description: 'Daily briefing',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'daily_briefing' },
    approvalRequired: false,
    ...overrides,
  };
}

function makeAgentHandle(overrides: Partial<SkillAgentHandle> = {}): SkillAgentHandle {
  return {
    think: jest.fn().mockResolvedValue('digest'),
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

describe('dailyBriefingSkill', () => {
  it('runs email triage and calendar review, then emits a combined digest event', async () => {
    const useTool = jest
      .fn()
      // email_triage: gmail_list_threads -> empty inbox (short-circuits before think())
      .mockResolvedValueOnce([])
      // calendar_review: calendar_list_events -> no events
      .mockResolvedValueOnce([]);

    const think = jest
      .fn()
      .mockResolvedValue(
        '{"conflicts":[],"overloadedDays":[],"suggestions":[],"summary":"Light week."}'
      );

    const agent = makeAgentHandle({ useTool, think });
    const task = makeTask();

    await dailyBriefingSkill.execute({ agent, task, input: {} });

    // Both sub-skills fired their own structured events.
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:triage_complete',
      expect.objectContaining({ summary: 'Inbox is empty or no unread messages.' })
    );
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:calendar_review_complete',
      expect.objectContaining({ review: expect.objectContaining({ summary: 'Light week.' }) })
    );
    // And the combined digest event.
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:daily_briefing_complete',
      expect.objectContaining({
        taskId: 'task-db1',
        triageSummary: 'Inbox is empty or no unread messages.',
        calendarSummary: 'Light week.',
      })
    );
  });

  it('passes maxEmails/daysAhead through to the respective sub-skills', async () => {
    const useTool = jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const think = jest
      .fn()
      .mockResolvedValue('{"conflicts":[],"overloadedDays":[],"suggestions":[],"summary":"ok"}');
    const agent = makeAgentHandle({ useTool, think });

    await dailyBriefingSkill.execute({
      agent,
      task: makeTask(),
      input: { maxEmails: 5, daysAhead: 3 },
    });

    expect(useTool).toHaveBeenNthCalledWith(
      1,
      'gmail_list_threads',
      expect.objectContaining({ maxResults: 5 })
    );
    expect(useTool).toHaveBeenNthCalledWith(
      2,
      'calendar_list_events',
      expect.objectContaining({
        timeMax: expect.any(String),
      })
    );
  });
});
