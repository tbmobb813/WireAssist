import type { AgentTask, SkillAgentHandle } from '@wireassist/core';
import { generatePostSkill } from '../generate-post';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-gp1',
    agentRole: 'content',
    description: 'Generate a post',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'generate_post' },
    approvalRequired: true,
    ...overrides,
  };
}

function makeAgentHandle(overrides: Partial<SkillAgentHandle> = {}): SkillAgentHandle {
  return {
    think: jest.fn().mockResolvedValue(''),
    useTool: jest.fn().mockImplementation((name: string) => {
      if (name === 'content_generate') {
        return Promise.resolve({
          content: 'A great post.',
          platform: 'linkedin',
          topic: 'AI trends',
        });
      }
      if (name === 'content_analyze') {
        return Promise.resolve({ score: 8, estimatedEngagement: 'medium', suggestion: '' });
      }
      return Promise.resolve({});
    }),
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

describe('generatePostSkill — review pilot passthrough', () => {
  it('includes reviewContext in agent:content_generated when the task carries one', async () => {
    const agent = makeAgentHandle();
    const reviewContext = {
      requestedBy: 'research' as const,
      originalTaskId: 'research-task-1',
      query: 'AI trends',
      researchSummary: 'summary',
      tone: 'direct',
      attempt: 0,
    };

    await generatePostSkill.execute({
      agent,
      task: makeTask(),
      input: { topic: 'AI trends', platform: 'linkedin', tone: 'direct', reviewContext },
    });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:content_generated',
      expect.objectContaining({ reviewContext })
    );
  });

  it('emits reviewContext: undefined when the task did not come from a handoff needing review', async () => {
    const agent = makeAgentHandle();

    await generatePostSkill.execute({
      agent,
      task: makeTask(),
      input: { topic: 'AI trends', platform: 'linkedin' },
    });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:content_generated',
      expect.objectContaining({ reviewContext: undefined })
    );
  });
});

describe('generatePostSkill — no approval gate', () => {
  it('never proposes approval — generating a draft is not a final outcome', async () => {
    const agent = makeAgentHandle();

    await generatePostSkill.execute({
      agent,
      task: makeTask(),
      input: { topic: 'AI trends', platform: 'linkedin' },
    });

    expect(agent.proposeAction).not.toHaveBeenCalled();
  });

  it('unconditionally emits agent:content_approved once generation completes', async () => {
    const agent = makeAgentHandle();

    await generatePostSkill.execute({
      agent,
      task: makeTask(),
      input: { topic: 'AI trends', platform: 'linkedin' },
    });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:content_approved',
      expect.objectContaining({ content: 'A great post.', platform: 'linkedin' })
    );
  });

  it('never calls content_analyze — no consumer left for it in this skill', async () => {
    const agent = makeAgentHandle();

    await generatePostSkill.execute({
      agent,
      task: makeTask(),
      input: { topic: 'AI trends', platform: 'linkedin' },
    });

    expect(agent.useTool).not.toHaveBeenCalledWith('content_analyze', expect.anything());
  });
});

describe('generatePostSkill — per-account memory (phase 1.5)', () => {
  it('uses exact per-account memory instead of the blended search when it exists', async () => {
    const listMemories = jest.fn().mockReturnValue([
      {
        id: '1',
        content: '[mindtype_studio] content_voice: poetic',
        agentRole: 'content' as const,
        tags: [],
        createdAt: new Date(),
      },
    ]);
    const loadContext = jest.fn().mockResolvedValue('blended context spanning every venture');
    const useTool = jest.fn().mockImplementation((name: string) => {
      if (name === 'content_generate') {
        return Promise.resolve({ content: 'x', platform: 'instagram', topic: 'y' });
      }
      return Promise.resolve({});
    });
    const agent = makeAgentHandle({ listMemories, loadContext, useTool });

    await generatePostSkill.execute({
      agent,
      task: makeTask(),
      input: { topic: 'y', platform: 'instagram', account: 'mindtype_studio' },
    });

    expect(listMemories).toHaveBeenCalledWith({ tags: ['account:mindtype_studio'] });
    expect(loadContext).not.toHaveBeenCalled();
    expect(useTool).toHaveBeenCalledWith(
      'content_generate',
      expect.objectContaining({ context: expect.stringContaining('poetic') })
    );
  });

  it('falls back to the blended search when no per-account memory exists yet', async () => {
    const listMemories = jest.fn().mockReturnValue([]);
    const loadContext = jest.fn().mockResolvedValue('blended context');
    const agent = makeAgentHandle({ listMemories, loadContext });

    await generatePostSkill.execute({
      agent,
      task: makeTask(),
      input: { topic: 'y', platform: 'instagram', account: 'nixlevel' },
    });

    expect(loadContext).toHaveBeenCalled();
  });

  it('skips the per-account lookup entirely when no account is given', async () => {
    const listMemories = jest.fn().mockReturnValue([]);
    const agent = makeAgentHandle({ listMemories });

    await generatePostSkill.execute({
      agent,
      task: makeTask(),
      input: { topic: 'y', platform: 'instagram' },
    });

    expect(listMemories).not.toHaveBeenCalled();
  });
});
