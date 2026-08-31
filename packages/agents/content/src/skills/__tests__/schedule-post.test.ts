import type { AgentTask, SkillAgentHandle } from '@wireassist/core';
import { schedulePostSkill } from '../schedule-post';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-s1',
    agentRole: 'content',
    description: 'Schedule a post',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'schedule_post' },
    approvalRequired: true,
    ...overrides,
  };
}

function makeAgentHandle(overrides: Partial<SkillAgentHandle> = {}): SkillAgentHandle {
  return {
    think: jest.fn().mockResolvedValue(''),
    useTool: jest.fn().mockResolvedValue({}),
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

const input = {
  content: 'Hello world',
  platform: 'twitter' as const,
  scheduledAt: '2026-09-01T10:00:00Z',
};

describe('schedulePostSkill', () => {
  it('passes objectiveId: task.objectiveId through to content_schedule_post when the task has one', async () => {
    const useTool = jest.fn().mockResolvedValue({ id: 'post-1' });
    const agent = makeAgentHandle({ useTool });
    const task = makeTask({ objectiveId: 'obj-1' });

    await schedulePostSkill.execute({ agent, task, input });

    expect(useTool).toHaveBeenCalledWith('content_schedule_post', {
      content: input.content,
      platform: input.platform,
      scheduledAt: input.scheduledAt,
      tags: undefined,
      objectiveId: 'obj-1',
    });
  });

  it('passes objectiveId: undefined through when the task has none', async () => {
    const useTool = jest.fn().mockResolvedValue({ id: 'post-1' });
    const agent = makeAgentHandle({ useTool });

    await schedulePostSkill.execute({ agent, task: makeTask(), input });

    expect(useTool).toHaveBeenCalledWith(
      'content_schedule_post',
      expect.objectContaining({ objectiveId: undefined })
    );
  });

  it('never calls content_schedule_post when approval is declined', async () => {
    const useTool = jest.fn();
    const agent = makeAgentHandle({ useTool, proposeAction: jest.fn().mockResolvedValue(false) });

    await schedulePostSkill.execute({ agent, task: makeTask(), input });

    expect(useTool).not.toHaveBeenCalled();
  });
});
