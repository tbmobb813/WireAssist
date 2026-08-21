import type { AgentTask, SkillAgentHandle } from '@wireassist/core';
import { meetingPrepSkill } from '../meeting-prep';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-mp1',
    agentRole: 'admin',
    description: 'Meeting prep',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'meeting_prep' },
    approvalRequired: false,
    ...overrides,
  };
}

function makeAgentHandle(overrides: Partial<SkillAgentHandle> = {}): SkillAgentHandle {
  return {
    think: jest.fn().mockResolvedValue('prep notes'),
    useTool: jest.fn().mockResolvedValue([]),
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

function event(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'evt-1',
    summary: 'Sync with Acme',
    start: '2026-08-21T15:00:00Z',
    end: '2026-08-21T15:30:00Z',
    attendees: [{ email: 'jane@acme.com' }],
    ...overrides,
  };
}

describe('meetingPrepSkill', () => {
  it('emits the empty-state summary and never calls think() when no meetings are in the window', async () => {
    const think = jest.fn();
    const useTool = jest.fn().mockResolvedValue([]);
    const agent = makeAgentHandle({ think, useTool });

    await meetingPrepSkill.execute({ agent, task: makeTask(), input: {} });

    expect(think).not.toHaveBeenCalled();
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:meeting_prep_complete',
      expect.objectContaining({ summary: 'No upcoming meetings need prep.', prepared: [] })
    );
  });

  it('skips events with no attendees — nothing to prep', async () => {
    const think = jest.fn();
    const useTool = jest.fn().mockResolvedValue([event({ attendees: [] })]);
    const agent = makeAgentHandle({ think, useTool });

    await meetingPrepSkill.execute({ agent, task: makeTask(), input: {} });

    expect(think).not.toHaveBeenCalled();
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:meeting_prep_complete',
      expect.objectContaining({ prepared: [] })
    );
  });

  it('preps a meeting with attendees: searches gmail, calls think(), remembers the marker, and emits', async () => {
    const useTool = jest
      .fn()
      .mockResolvedValueOnce([event()]) // calendar_list_events
      .mockResolvedValueOnce([{ id: 't1', snippet: 'Re: proposal' }]); // gmail_search
    const think = jest.fn().mockResolvedValue('Bring up the proposal follow-up.');
    const agent = makeAgentHandle({ useTool, think });

    await meetingPrepSkill.execute({ agent, task: makeTask(), input: {} });

    expect(useTool).toHaveBeenNthCalledWith(
      2,
      'gmail_search',
      expect.objectContaining({ q: expect.stringContaining('jane@acme.com') })
    );
    expect(think.mock.calls[0][0]).toContain('Sync with Acme');
    expect(think.mock.calls[0][0]).toContain('Re: proposal');
    expect(agent.remember).toHaveBeenCalledWith('meeting-prep-done:evt-1', [
      'admin',
      'meeting-prep-done',
    ]);
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:meeting_prep_complete',
      expect.objectContaining({
        prepared: [expect.objectContaining({ eventId: 'evt-1', summary: 'Sync with Acme' })],
      })
    );
  });

  it('does not re-prep a meeting whose marker is already in memory', async () => {
    const useTool = jest.fn().mockResolvedValueOnce([event()]);
    const loadContext = jest.fn().mockResolvedValue('meeting-prep-done:evt-1');
    const think = jest.fn();
    const agent = makeAgentHandle({ useTool, loadContext, think });

    await meetingPrepSkill.execute({ agent, task: makeTask(), input: {} });

    expect(think).not.toHaveBeenCalled();
    expect(useTool).toHaveBeenCalledTimes(1); // only calendar_list_events, no gmail_search
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:meeting_prep_complete',
      expect.objectContaining({ prepared: [] })
    );
  });

  it('respects a custom hoursAhead input by passing it into the calendar time window', async () => {
    const useTool = jest.fn().mockResolvedValue([]);
    const agent = makeAgentHandle({ useTool });

    await meetingPrepSkill.execute({ agent, task: makeTask(), input: { hoursAhead: 6 } });

    const [, params] = useTool.mock.calls[0];
    const timeMin = new Date(params.timeMin).getTime();
    const timeMax = new Date(params.timeMax).getTime();
    expect(timeMax - timeMin).toBeCloseTo(6 * 60 * 60 * 1000, -3);
  });
});
