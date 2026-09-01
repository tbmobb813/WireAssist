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
