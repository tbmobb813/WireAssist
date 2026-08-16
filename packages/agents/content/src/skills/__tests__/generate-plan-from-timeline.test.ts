import type { AgentTask, SkillAgentHandle } from '@wireassist/core';
import {
  generatePlanFromTimelineSkill,
  type GeneratePlanFromTimelineInput,
} from '../generate-plan-from-timeline';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-t1',
    agentRole: 'content',
    description: 'Generate content calendar from GTM timeline',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'generate_plan_from_timeline' },
    approvalRequired: true,
    ...overrides,
  };
}

const toolResult = {
  ideas: [
    { id: 'i1', topic: 'Pre-launch teaser', angle: 'Building anticipation', platform: 'linkedin' },
    { id: 'i2', topic: 'Launch day', angle: 'Announce it', platform: 'twitter' },
  ],
  totalGenerated: 2,
  campaign: { id: 'camp-1', name: 'StatusWatch launch' },
};

function makeAgentHandle(overrides: Partial<SkillAgentHandle> = {}): SkillAgentHandle {
  return {
    think: jest.fn().mockResolvedValue(''),
    useTool: jest.fn().mockResolvedValue(toolResult),
    loadContext: jest.fn().mockResolvedValue(''),
    remember: jest.fn(),
    proposeAction: jest.fn().mockResolvedValue(true),
    emit: jest.fn(),
    runToolLoop: jest.fn().mockResolvedValue(''),
    listDecisions: jest.fn().mockReturnValue([]),
    ...overrides,
  };
}

const input: GeneratePlanFromTimelineInput = {
  productName: 'StatusWatch',
  timeline: [
    { week: 'Week 1', focus: 'Pre-launch teaser', tasks: ['Post teaser'] },
    { week: 'Week 2', focus: 'Launch day', tasks: ['Announce'] },
  ],
  platforms: ['linkedin', 'twitter'],
};

describe('generatePlanFromTimelineSkill', () => {
  it('calls content_generate_plan_from_timeline with the timeline and platforms', async () => {
    const agent = makeAgentHandle();
    await generatePlanFromTimelineSkill.execute({ agent, task: makeTask(), input: { ...input } });

    expect(agent.useTool).toHaveBeenCalledWith('content_generate_plan_from_timeline', {
      productName: 'StatusWatch',
      timeline: input.timeline,
      platforms: input.platforms,
    });
  });

  it('emits agent:content_plan_generated with the created ideas', async () => {
    const agent = makeAgentHandle();
    const task = makeTask();
    await generatePlanFromTimelineSkill.execute({ agent, task, input: { ...input } });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:content_plan_generated',
      expect.objectContaining({ taskId: task.id, totalGenerated: 2, ideas: toolResult.ideas })
    );
  });

  it('proposes approval naming the product and campaign', async () => {
    const proposeAction = jest.fn().mockResolvedValue(true);
    const agent = makeAgentHandle({ proposeAction });
    await generatePlanFromTimelineSkill.execute({ agent, task: makeTask(), input: { ...input } });

    expect(proposeAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('StatusWatch'),
      expect.objectContaining({ campaign: toolResult.campaign })
    );
  });

  it('remembers the approved calendar when approved', async () => {
    const agent = makeAgentHandle({ proposeAction: jest.fn().mockResolvedValue(true) });
    await generatePlanFromTimelineSkill.execute({ agent, task: makeTask(), input: { ...input } });

    expect(agent.remember).toHaveBeenCalledWith(
      expect.stringContaining('StatusWatch'),
      expect.arrayContaining(['content', 'plan', 'gtm', 'approved'])
    );
  });

  it('does not remember anything when declined', async () => {
    const agent = makeAgentHandle({ proposeAction: jest.fn().mockResolvedValue(false) });
    await generatePlanFromTimelineSkill.execute({ agent, task: makeTask(), input: { ...input } });

    expect(agent.remember).not.toHaveBeenCalled();
  });

  it('creates the ideas (via the tool call) regardless of the approval decision', async () => {
    const agent = makeAgentHandle({ proposeAction: jest.fn().mockResolvedValue(false) });
    await generatePlanFromTimelineSkill.execute({ agent, task: makeTask(), input: { ...input } });

    expect(agent.useTool).toHaveBeenCalledWith(
      'content_generate_plan_from_timeline',
      expect.anything()
    );
    expect(agent.emit).toHaveBeenCalledWith('agent:content_plan_generated', expect.anything());
  });
});
