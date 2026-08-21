import type { AgentTask, SkillAgentHandle } from '@wireassist/core';
import { publishDuePostsSkill } from '../publish-due-posts';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-p1',
    agentRole: 'content',
    description: 'Publish scheduled posts whose time has arrived',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'publish_due_posts' },
    approvalRequired: false,
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
    listMemories: jest.fn().mockReturnValue([]),
    ...overrides,
  };
}

function post(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'post-1',
    content: 'hello',
    platform: 'twitter',
    status: 'scheduled',
    ...overrides,
  };
}

describe('publishDuePostsSkill', () => {
  it('emits the empty-state summary and never calls content_publish_post when nothing is due', async () => {
    const useTool = jest.fn().mockResolvedValue([]);
    const agent = makeAgentHandle({ useTool });

    await publishDuePostsSkill.execute({ agent, task: makeTask(), input: {} });

    expect(useTool).toHaveBeenCalledWith('content_list_posts', {
      status: 'scheduled',
      dueOnly: true,
    });
    expect(useTool).toHaveBeenCalledTimes(1);
    expect(agent.think).not.toHaveBeenCalled();
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:publish_due_posts_complete',
      expect.objectContaining({
        summary: 'No posts were due to publish.',
        published: [],
        failed: [],
      })
    );
  });

  it('publishes a single due post and reports it as published', async () => {
    const duePost = post({ id: 'post-1' });
    const publishedPost = post({ id: 'post-1', status: 'published', platformPostId: 'tw-1' });
    const useTool = jest.fn().mockResolvedValueOnce([duePost]).mockResolvedValueOnce(publishedPost);
    const agent = makeAgentHandle({ useTool });

    await publishDuePostsSkill.execute({ agent, task: makeTask(), input: {} });

    expect(useTool).toHaveBeenCalledWith('content_publish_post', { postId: 'post-1' });
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:publish_due_posts_complete',
      expect.objectContaining({
        summary: 'Published 1/1 due post(s).',
        published: [publishedPost],
        failed: [],
      })
    );
  });

  it('emits agent:post_published for a published post that has an objectiveId', async () => {
    const duePost = post({ id: 'post-1', objectiveId: 'obj-1' });
    const publishedPost = post({
      id: 'post-1',
      status: 'published',
      platform: 'twitter',
      objectiveId: 'obj-1',
    });
    const useTool = jest.fn().mockResolvedValueOnce([duePost]).mockResolvedValueOnce(publishedPost);
    const agent = makeAgentHandle({ useTool });

    await publishDuePostsSkill.execute({ agent, task: makeTask(), input: {} });

    expect(agent.emit).toHaveBeenCalledWith('agent:post_published', {
      objectiveId: 'obj-1',
      postId: 'post-1',
      platform: 'twitter',
      status: 'published',
      errorMessage: undefined,
    });
  });

  it('emits agent:post_published for a failed post that has an objectiveId', async () => {
    const duePost = post({ id: 'post-1', objectiveId: 'obj-1' });
    const failedPost = post({
      id: 'post-1',
      status: 'failed',
      platform: 'twitter',
      objectiveId: 'obj-1',
      errorMessage: 'rate limited',
    });
    const useTool = jest.fn().mockResolvedValueOnce([duePost]).mockResolvedValueOnce(failedPost);
    const agent = makeAgentHandle({ useTool });

    await publishDuePostsSkill.execute({ agent, task: makeTask(), input: {} });

    expect(agent.emit).toHaveBeenCalledWith('agent:post_published', {
      objectiveId: 'obj-1',
      postId: 'post-1',
      platform: 'twitter',
      status: 'failed',
      errorMessage: 'rate limited',
    });
  });

  it('never emits agent:post_published for a post with no objectiveId', async () => {
    const duePost = post({ id: 'post-1' });
    const publishedPost = post({ id: 'post-1', status: 'published' });
    const useTool = jest.fn().mockResolvedValueOnce([duePost]).mockResolvedValueOnce(publishedPost);
    const agent = makeAgentHandle({ useTool });

    await publishDuePostsSkill.execute({ agent, task: makeTask(), input: {} });

    expect(agent.emit).not.toHaveBeenCalledWith('agent:post_published', expect.anything());
  });

  it('reports a failed post without throwing, and still attempts the next due post in the batch', async () => {
    const postA = post({ id: 'post-a', platform: 'instagram' });
    const postB = post({ id: 'post-b', platform: 'twitter' });
    const failedA = post({
      id: 'post-a',
      platform: 'instagram',
      status: 'failed',
      errorMessage: 'missing INSTAGRAM_DEFAULT_IMAGE_URL',
    });
    const publishedB = post({ id: 'post-b', platform: 'twitter', status: 'published' });

    const useTool = jest
      .fn()
      .mockResolvedValueOnce([postA, postB])
      .mockResolvedValueOnce(failedA)
      .mockResolvedValueOnce(publishedB);
    const agent = makeAgentHandle({ useTool });

    await publishDuePostsSkill.execute({ agent, task: makeTask(), input: {} });

    // Both due posts were attempted — the first failing didn't abort the loop.
    expect(useTool).toHaveBeenCalledWith('content_publish_post', { postId: 'post-a' });
    expect(useTool).toHaveBeenCalledWith('content_publish_post', { postId: 'post-b' });
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:publish_due_posts_complete',
      expect.objectContaining({
        summary: expect.stringContaining('instagram (missing INSTAGRAM_DEFAULT_IMAGE_URL)'),
        published: [publishedB],
        failed: [failedA],
      })
    );
  });
});
