import type { AgentTask, SkillAgentHandle } from '@wireassist/core';
import { generateAndScheduleCampaignSkill } from '../generate-and-schedule-campaign';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-campaign1',
    agentRole: 'content',
    description: 'Generate and schedule a campaign',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'generate_and_schedule_campaign' },
    approvalRequired: true,
    ...overrides,
  };
}

const IDEAS = [
  { topic: 'Topic A', angle: 'Angle A', platform: 'instagram', scheduledFor: '2026-09-07' },
  { topic: 'Topic B', angle: 'Angle B', platform: 'instagram', scheduledFor: '2026-09-08' },
];

function makeAgentHandle(
  useToolImpl: (name: string, params: Record<string, unknown>) => Promise<unknown>,
  overrides: Partial<SkillAgentHandle> = {}
): SkillAgentHandle {
  return {
    think: jest.fn().mockResolvedValue(''),
    useTool: jest.fn(useToolImpl),
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

describe('generateAndScheduleCampaignSkill — everything passes first try', () => {
  it('schedules every post in one batch approval, no retries', async () => {
    const useTool = jest.fn(async (name: string, params: Record<string, unknown>) => {
      if (name === 'content_generate_plan') return { ideas: IDEAS, totalGenerated: 2 };
      if (name === 'content_generate') return { content: `draft for ${params.topic}` };
      if (name === 'content_analyze')
        return {
          score: 8,
          strengths: [],
          improvements: [],
          estimatedEngagement: 'high',
          suggestion: '',
        };
      if (name === 'content_schedule_post') return { id: 'post-1', ...params };
      throw new Error(`unexpected tool: ${name}`);
    });
    const agent = makeAgentHandle(useTool);

    await generateAndScheduleCampaignSkill.execute({
      agent,
      task: makeTask(),
      input: { platforms: ['instagram'] },
    });

    // 2 content_generate calls (one per idea, no retries) + 2 content_analyze + 2 content_schedule_post
    expect(useTool).toHaveBeenCalledTimes(1 + 2 + 2 + 2);
    expect(agent.proposeAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('Schedule 2 posts'),
      expect.objectContaining({ posts: expect.any(Array) })
    );
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:campaign_scheduled',
      expect.objectContaining({ scheduled: expect.arrayContaining([expect.anything()]) })
    );
  });
});

describe('generateAndScheduleCampaignSkill — weak draft retried then passes', () => {
  it('regenerates once with the score feedback, then schedules the improved draft', async () => {
    let generateCalls = 0;
    const useTool = jest.fn(async (name: string, params: Record<string, unknown>) => {
      if (name === 'content_generate_plan') return { ideas: [IDEAS[0]], totalGenerated: 1 };
      if (name === 'content_generate') {
        generateCalls++;
        return { content: generateCalls === 1 ? 'weak draft' : 'improved draft' };
      }
      if (name === 'content_analyze') {
        const content = (params as { content: string }).content;
        return content === 'weak draft'
          ? {
              score: 4,
              strengths: [],
              improvements: ['too generic'],
              estimatedEngagement: 'low',
              suggestion: 'be specific',
            }
          : {
              score: 8,
              strengths: [],
              improvements: [],
              estimatedEngagement: 'high',
              suggestion: '',
            };
      }
      if (name === 'content_schedule_post') return { id: 'post-1', ...params };
      throw new Error(`unexpected tool: ${name}`);
    });
    const agent = makeAgentHandle(useTool);

    await generateAndScheduleCampaignSkill.execute({
      agent,
      task: makeTask(),
      input: { platforms: ['instagram'] },
    });

    expect(generateCalls).toBe(2);
    // Second content_generate call carries the specific score feedback
    const secondCall = (useTool.mock.calls as [string, Record<string, unknown>][]).filter(
      ([name]) => name === 'content_generate'
    )[1];
    expect(secondCall[1].context).toContain('too generic');
    expect(secondCall[1].context).toContain('be specific');
    expect(agent.proposeAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('Schedule this instagram post'),
      expect.objectContaining({ posts: [expect.objectContaining({ content: 'improved draft' })] })
    );
  });
});

describe('generateAndScheduleCampaignSkill — still fails after retry', () => {
  it('leaves the post unscheduled and flags it instead of shipping a weak draft', async () => {
    const useTool = jest.fn(async (name: string) => {
      if (name === 'content_generate_plan') return { ideas: [IDEAS[0]], totalGenerated: 1 };
      if (name === 'content_generate') return { content: 'still weak' };
      if (name === 'content_analyze')
        return {
          score: 3,
          strengths: [],
          improvements: ['generic'],
          estimatedEngagement: 'low',
          suggestion: 'fix it',
        };
      throw new Error('content_schedule_post should never be called here');
    });
    const agent = makeAgentHandle(useTool);

    await generateAndScheduleCampaignSkill.execute({
      agent,
      task: makeTask(),
      input: { platforms: ['instagram'] },
    });

    expect(agent.proposeAction).not.toHaveBeenCalled();
    expect(useTool).not.toHaveBeenCalledWith('content_schedule_post', expect.anything());
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:campaign_drafted',
      expect.objectContaining({ readyCount: 0, flaggedCount: 1 })
    );
    expect(agent.remember).toHaveBeenCalledWith(
      expect.stringContaining('all 1 draft(s) failed quality review'),
      expect.anything()
    );
  });
});

describe('generateAndScheduleCampaignSkill — scheduling approval declined', () => {
  it('does not call content_schedule_post when the batch approval is declined', async () => {
    const useTool = jest.fn(async (name: string) => {
      if (name === 'content_generate_plan') return { ideas: [IDEAS[0]], totalGenerated: 1 };
      if (name === 'content_generate') return { content: 'good draft' };
      if (name === 'content_analyze')
        return {
          score: 9,
          strengths: [],
          improvements: [],
          estimatedEngagement: 'high',
          suggestion: '',
        };
      throw new Error('content_schedule_post should never be called here');
    });
    const proposeAction = jest.fn().mockResolvedValue(false);
    const agent = makeAgentHandle(useTool, { proposeAction });

    await generateAndScheduleCampaignSkill.execute({
      agent,
      task: makeTask(),
      input: { platforms: ['instagram'] },
    });

    expect(useTool).not.toHaveBeenCalledWith('content_schedule_post', expect.anything());
    expect(agent.emit).not.toHaveBeenCalledWith('agent:campaign_scheduled', expect.anything());
    expect(agent.remember).toHaveBeenCalledWith(
      expect.stringContaining('scheduling declined'),
      expect.anything()
    );
  });
});
