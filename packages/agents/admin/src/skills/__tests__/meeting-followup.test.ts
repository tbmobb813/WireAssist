import type { AgentTask, SkillAgentHandle } from '@wireassist/core';
import { meetingFollowupSkill } from '../meeting-followup';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-mf1',
    agentRole: 'admin',
    description: 'Meeting follow-up',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'meeting_followup' },
    approvalRequired: false,
    ...overrides,
  };
}

function makeAgentHandle(overrides: Partial<SkillAgentHandle> = {}): SkillAgentHandle {
  return {
    think: jest.fn().mockResolvedValue('followup notes'),
    useTool: jest.fn().mockResolvedValue([]),
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

function endedEvent(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date();
  return {
    id: 'evt-1',
    summary: 'Sync with Acme',
    start: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    end: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    attendees: [{ email: 'jane@acme.com' }],
    ...overrides,
  };
}

describe('meetingFollowupSkill', () => {
  it('emits the empty-state summary and never calls think() when nothing ended recently', async () => {
    const think = jest.fn();
    const useTool = jest.fn().mockResolvedValue([]);
    const agent = makeAgentHandle({ think, useTool });

    await meetingFollowupSkill.execute({ agent, task: makeTask(), input: {} });

    expect(think).not.toHaveBeenCalled();
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:meeting_followup_complete',
      expect.objectContaining({
        summary: 'No recently ended meetings need a follow-up.',
        followedUp: [],
      })
    );
  });

  it('skips events with no attendees and events that have not ended yet', async () => {
    const now = new Date();
    const notYetEnded = endedEvent({
      id: 'evt-2',
      end: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    });
    const think = jest.fn();
    const useTool = jest.fn().mockResolvedValue([endedEvent({ attendees: [] }), notYetEnded]);
    const agent = makeAgentHandle({ think, useTool });

    await meetingFollowupSkill.execute({ agent, task: makeTask(), input: {} });

    expect(think).not.toHaveBeenCalled();
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:meeting_followup_complete',
      expect.objectContaining({ followedUp: [] })
    );
  });

  it('follows up on an ended meeting with attendees: calls think(), remembers the marker, and emits', async () => {
    const useTool = jest.fn().mockResolvedValue([endedEvent()]);
    const think = jest.fn().mockResolvedValue('Action item: send proposal.');
    const agent = makeAgentHandle({ useTool, think });

    await meetingFollowupSkill.execute({ agent, task: makeTask(), input: {} });

    expect(think.mock.calls[0][0]).toContain('Sync with Acme');
    expect(agent.remember).toHaveBeenCalledWith('meeting-followup-done:evt-1', [
      'admin',
      'meeting-followup-done',
    ]);
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:meeting_followup_complete',
      expect.objectContaining({
        followedUp: [expect.objectContaining({ eventId: 'evt-1', summary: 'Sync with Acme' })],
      })
    );
  });

  it('does not re-follow-up a meeting whose marker is already in memory', async () => {
    const useTool = jest.fn().mockResolvedValue([endedEvent()]);
    const loadContext = jest.fn().mockResolvedValue('meeting-followup-done:evt-1');
    const think = jest.fn();
    const agent = makeAgentHandle({ useTool, loadContext, think });

    await meetingFollowupSkill.execute({ agent, task: makeTask(), input: {} });

    expect(think).not.toHaveBeenCalled();
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:meeting_followup_complete',
      expect.objectContaining({ followedUp: [] })
    );
  });

  it('respects a custom hoursBack input by widening the calendar query window', async () => {
    const useTool = jest.fn().mockResolvedValue([]);
    const agent = makeAgentHandle({ useTool });

    await meetingFollowupSkill.execute({ agent, task: makeTask(), input: { hoursBack: 6 } });

    const [, params] = useTool.mock.calls[0];
    const timeMin = new Date(params.timeMin).getTime();
    const timeMax = new Date(params.timeMax).getTime();
    expect(timeMax - timeMin).toBeCloseTo(6 * 60 * 60 * 1000, -3);
  });
});
