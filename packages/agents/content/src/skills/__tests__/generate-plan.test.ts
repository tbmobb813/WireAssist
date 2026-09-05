import type { AgentTask, SkillAgentHandle } from '@wireassist/core';
import { generatePlanSkill } from '../generate-plan';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-plan1',
    agentRole: 'content',
    description: 'Generate a content plan',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'generate_plan' },
    approvalRequired: true,
    ...overrides,
  };
}

function makeAgentHandle(overrides: Partial<SkillAgentHandle> = {}): SkillAgentHandle {
  return {
    think: jest.fn().mockResolvedValue(''),
    useTool: jest
      .fn()
      .mockResolvedValue({ ideas: [{ topic: 'a' }, { topic: 'b' }], totalGenerated: 2 }),
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

describe('generatePlanSkill — no approval gate', () => {
  it('never proposes approval — generating ideas is not a final outcome', async () => {
    const agent = makeAgentHandle();

    await generatePlanSkill.execute({
      agent,
      task: makeTask(),
      input: { platforms: ['linkedin', 'twitter'] },
    });

    expect(agent.proposeAction).not.toHaveBeenCalled();
  });

  it('emits agent:content_plan_generated with the generated ideas', async () => {
    const agent = makeAgentHandle();

    await generatePlanSkill.execute({
      agent,
      task: makeTask(),
      input: { platforms: ['linkedin'] },
    });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:content_plan_generated',
      expect.objectContaining({ totalGenerated: 2 })
    );
  });

  it('remembers the generated plan unconditionally', async () => {
    const agent = makeAgentHandle();

    await generatePlanSkill.execute({
      agent,
      task: makeTask(),
      input: { platforms: ['linkedin'] },
    });

    expect(agent.remember).toHaveBeenCalledWith(
      expect.stringContaining('Generated content plan'),
      expect.arrayContaining(['content', 'plan', 'generated'])
    );
  });
});
