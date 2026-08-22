import type { AgentTask, SkillAgentHandle } from '@wireassist/core';
import { followUpNudgesSkill } from '../follow-up-nudges';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-fn1',
    agentRole: 'admin',
    description: 'Follow-up nudges',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'follow_up_nudges' },
    approvalRequired: false,
    ...overrides,
  };
}

function makeAgentHandle(overrides: Partial<SkillAgentHandle> = {}): SkillAgentHandle {
  return {
    think: jest.fn().mockResolvedValue('Just checking in on this — any update?'),
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

const TEN_DAYS_AGO = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toUTCString();
const ONE_DAY_AGO = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toUTCString();

describe('followUpNudgesSkill', () => {
  it('flags a thread as stale when the last message is from me and older than the threshold', async () => {
    const useTool = jest.fn().mockImplementation((tool: string) => {
      if (tool === 'gmail_get_profile')
        return Promise.resolve({ emailAddress: 'jason@example.com' });
      if (tool === 'gmail_search')
        return Promise.resolve([{ id: 't1', snippet: 'Following up on the proposal' }]);
      if (tool === 'gmail_thread_last_message')
        return Promise.resolve({ from: 'Jason <jason@example.com>', date: TEN_DAYS_AGO });
      if (tool === 'gmail_create_draft') return Promise.resolve({ draftId: 'd1' });
      throw new Error(`unexpected tool: ${tool}`);
    });
    const agent = makeAgentHandle({ useTool });

    await followUpNudgesSkill.execute({ agent, task: makeTask(), input: {} });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:follow_up_nudges_complete',
      expect.objectContaining({
        staleThreads: [expect.objectContaining({ threadId: 't1' })],
      })
    );
    expect(agent.proposeAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('Follow-up nudge'),
      expect.objectContaining({ threadId: 't1' })
    );
    expect(useTool).toHaveBeenCalledWith('gmail_create_draft', {
      threadId: 't1',
      body: 'Just checking in on this — any update?',
    });
  });

  it('does not flag a thread when the other side replied last', async () => {
    const useTool = jest.fn().mockImplementation((tool: string) => {
      if (tool === 'gmail_get_profile')
        return Promise.resolve({ emailAddress: 'jason@example.com' });
      if (tool === 'gmail_search') return Promise.resolve([{ id: 't1', snippet: 'Re: proposal' }]);
      if (tool === 'gmail_thread_last_message')
        return Promise.resolve({ from: 'someone-else@example.com', date: TEN_DAYS_AGO });
      throw new Error(`unexpected tool: ${tool}`);
    });
    const agent = makeAgentHandle({ useTool });

    await followUpNudgesSkill.execute({ agent, task: makeTask(), input: {} });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:follow_up_nudges_complete',
      expect.objectContaining({ staleThreads: [] })
    );
    expect(agent.proposeAction).not.toHaveBeenCalled();
  });

  it('does not flag a thread that is not yet past the staleness threshold', async () => {
    const useTool = jest.fn().mockImplementation((tool: string) => {
      if (tool === 'gmail_get_profile')
        return Promise.resolve({ emailAddress: 'jason@example.com' });
      if (tool === 'gmail_search') return Promise.resolve([{ id: 't1', snippet: 'proposal' }]);
      if (tool === 'gmail_thread_last_message')
        return Promise.resolve({ from: 'jason@example.com', date: ONE_DAY_AGO });
      throw new Error(`unexpected tool: ${tool}`);
    });
    const agent = makeAgentHandle({ useTool });

    await followUpNudgesSkill.execute({ agent, task: makeTask(), input: { daysStale: 3 } });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:follow_up_nudges_complete',
      expect.objectContaining({ staleThreads: [] })
    );
  });

  it('does not draft or record anything when the nudge is declined', async () => {
    const useTool = jest.fn().mockImplementation((tool: string) => {
      if (tool === 'gmail_get_profile')
        return Promise.resolve({ emailAddress: 'jason@example.com' });
      if (tool === 'gmail_search') return Promise.resolve([{ id: 't1', snippet: 'proposal' }]);
      if (tool === 'gmail_thread_last_message')
        return Promise.resolve({ from: 'jason@example.com', date: TEN_DAYS_AGO });
      throw new Error(`unexpected tool: ${tool}`);
    });
    const proposeAction = jest.fn().mockResolvedValue(false);
    const agent = makeAgentHandle({ useTool, proposeAction });

    await followUpNudgesSkill.execute({ agent, task: makeTask(), input: {} });

    expect(useTool).not.toHaveBeenCalledWith('gmail_create_draft', expect.anything());
    expect(agent.remember).not.toHaveBeenCalled();
  });
});
