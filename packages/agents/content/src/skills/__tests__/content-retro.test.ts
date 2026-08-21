import type { AgentTask, SkillAgentHandle } from '@wireassist/core';
import { contentRetroSkill } from '../content-retro';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-cr1',
    agentRole: 'content',
    description: 'Content performance retro',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'content_retro' },
    approvalRequired: false,
    ...overrides,
  };
}

function makeAgentHandle(overrides: Partial<SkillAgentHandle> = {}): SkillAgentHandle {
  return {
    think: jest.fn().mockResolvedValue('retro text'),
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

function post(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'post-1',
    content: 'hello world',
    platform: 'twitter',
    status: 'published',
    ...overrides,
  };
}

describe('contentRetroSkill', () => {
  it('lists published posts with the default 30-day window and calls content_analyze per post', async () => {
    const useTool = jest
      .fn()
      .mockResolvedValueOnce([post({ id: 'p1' }), post({ id: 'p2' })])
      .mockResolvedValue({ score: 7, estimatedEngagement: 'medium' });
    const agent = makeAgentHandle({ useTool });

    await contentRetroSkill.execute({ agent, task: makeTask(), input: {} });

    expect(useTool).toHaveBeenNthCalledWith(1, 'content_list_posts', {
      status: 'published',
      daysAgo: 30,
    });
    expect(useTool).toHaveBeenCalledTimes(3); // 1 list + 2 analyze
  });

  it('respects a custom daysAgo input', async () => {
    const useTool = jest.fn().mockResolvedValueOnce([]).mockResolvedValue({});
    const agent = makeAgentHandle({ useTool });

    await contentRetroSkill.execute({ agent, task: makeTask(), input: { daysAgo: 7 } });

    expect(useTool).toHaveBeenNthCalledWith(1, 'content_list_posts', {
      status: 'published',
      daysAgo: 7,
    });
  });

  it('still calls think() and emits when no posts were published', async () => {
    const think = jest.fn().mockResolvedValue('quiet period note');
    const useTool = jest.fn().mockResolvedValue([]);
    const agent = makeAgentHandle({ think, useTool });

    await contentRetroSkill.execute({ agent, task: makeTask(), input: {} });

    expect(think).toHaveBeenCalledTimes(1);
    expect(think.mock.calls[0][0]).toMatch(/No posts were published/);
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:content_retro_complete',
      expect.objectContaining({ summary: 'quiet period note', postsAnalyzed: 0 })
    );
  });

  it('emits a summary with postsAnalyzed and remembers the retro when posts exist', async () => {
    const useTool = jest
      .fn()
      .mockResolvedValueOnce([post({ id: 'p1' })])
      .mockResolvedValue({ score: 8, estimatedEngagement: 'high', suggestion: 'tighten the hook' });
    const agent = makeAgentHandle({ useTool });

    await contentRetroSkill.execute({ agent, task: makeTask(), input: {} });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:content_retro_complete',
      expect.objectContaining({ summary: 'retro text', postsAnalyzed: 1 })
    );
    expect(agent.remember).toHaveBeenCalledWith(expect.stringContaining('retro text'), [
      'content',
      'retro',
    ]);
  });

  it('includes each analyzed post in the think() prompt', async () => {
    const think = jest.fn().mockResolvedValue('retro text');
    const useTool = jest
      .fn()
      .mockResolvedValueOnce([post({ id: 'p1', content: 'launch day post', platform: 'linkedin' })])
      .mockResolvedValue({
        score: 9,
        estimatedEngagement: 'high',
        suggestion: 'nothing to change',
      });
    const agent = makeAgentHandle({ think, useTool });

    await contentRetroSkill.execute({ agent, task: makeTask(), input: {} });

    const prompt = think.mock.calls[0][0] as string;
    expect(prompt).toContain('linkedin');
    expect(prompt).toContain('launch day post');
    expect(prompt).toContain('9/10');
    expect(prompt).toContain('nothing to change');
  });
});
