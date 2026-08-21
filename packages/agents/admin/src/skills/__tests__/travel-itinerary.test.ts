import type { AgentTask, SkillAgentHandle } from '@wireassist/core';
import { travelItinerarySkill } from '../travel-itinerary';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-ti1',
    agentRole: 'admin',
    description: 'Travel itinerary digest',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'travel_itinerary_digest' },
    approvalRequired: false,
    ...overrides,
  };
}

function makeAgentHandle(overrides: Partial<SkillAgentHandle> = {}): SkillAgentHandle {
  return {
    think: jest.fn().mockResolvedValue('itinerary text'),
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

describe('travelItinerarySkill', () => {
  it('emits the empty-state summary and never calls think() when nothing is found', async () => {
    const think = jest.fn();
    const useTool = jest.fn().mockResolvedValue([]);
    const agent = makeAgentHandle({ think, useTool });

    await travelItinerarySkill.execute({ agent, task: makeTask(), input: {} });

    expect(think).not.toHaveBeenCalled();
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:travel_itinerary_digest_complete',
      expect.objectContaining({ summary: 'No upcoming travel detected.', hasTravel: false })
    );
  });

  it('searches gmail for travel keywords and calendar for upcoming events, then compiles a digest', async () => {
    const useTool = jest
      .fn()
      .mockResolvedValueOnce([{ id: 't1', snippet: 'Your flight confirmation: SFO -> JFK' }])
      .mockResolvedValueOnce([
        {
          id: 'e1',
          summary: 'Flight to JFK',
          start: '2026-09-01T08:00:00Z',
          end: '2026-09-01T14:00:00Z',
        },
      ]);
    const think = jest.fn().mockResolvedValue('Trip to NYC, Sep 1.');
    const agent = makeAgentHandle({ useTool, think });

    await travelItinerarySkill.execute({ agent, task: makeTask(), input: {} });

    expect(useTool).toHaveBeenNthCalledWith(
      1,
      'gmail_search',
      expect.objectContaining({ q: expect.stringContaining('flight') })
    );
    expect(useTool).toHaveBeenNthCalledWith(2, 'calendar_list_events', expect.any(Object));
    expect(think.mock.calls[0][0]).toContain('SFO -> JFK');
    expect(think.mock.calls[0][0]).toContain('Flight to JFK');
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:travel_itinerary_digest_complete',
      expect.objectContaining({ summary: 'Trip to NYC, Sep 1.', hasTravel: true })
    );
  });

  it('respects a custom daysAhead input by widening the calendar query window', async () => {
    const useTool = jest.fn().mockResolvedValue([]);
    const agent = makeAgentHandle({ useTool });

    await travelItinerarySkill.execute({ agent, task: makeTask(), input: { daysAhead: 30 } });

    const [, params] = useTool.mock.calls[1];
    const timeMin = new Date(params.timeMin).getTime();
    const timeMax = new Date(params.timeMax).getTime();
    expect(timeMax - timeMin).toBeCloseTo(30 * 24 * 60 * 60 * 1000, -3);
  });
});
