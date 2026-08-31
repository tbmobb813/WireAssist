import type { AgentTask, SkillAgentHandle } from '@wireassist/core';
import { generateStrategySkill } from '../generate-strategy';
import type { GtmProductInput } from '../../types';

const product: GtmProductInput = {
  name: 'StatusWatch',
  cat: 'SaaS',
  problem: 'DevOps teams waste hours figuring out if an outage is their code or a vendor',
  benefit: 'Instant clarity during outages',
  diff: 'Calm by default — smart alert filtering reduces noise',
  buyer: 'DevOps engineers at Series A-B startups',
  segment: '10-100 person startups',
  comp: 'StatusGator ($89/mo)',
  channels: 'r/devops, Hacker News',
  pain: 'Too many false alerts',
  price: '$49/month',
  model: 'SaaS subscription',
  free: '14-day free trial',
  goal: '10 paying customers in 30 days',
  current: 'Nothing yet',
  budget: '$0 for now',
};

const GTM_JSON = JSON.stringify({
  positioning: {
    headline: 'Calm status monitoring for growing DevOps teams',
    subheadline: 'Know instantly whether it is your code or theirs.',
    icp: 'DevOps engineers at Series A-B startups',
    message_hierarchy: ['Clarity during outages'],
  },
  organic_channels: [],
  paid_channels: [],
  launch_timeline: [
    { week: 'Week 1', focus: 'Pre-launch teaser', tasks: ['Post teaser'] },
    { week: 'Week 2', focus: 'Launch day', tasks: ['Announce'] },
  ],
  kpis: [],
  north_star: '10 paying customers in 30 days',
  founder_advantage: 'Deep DevOps background',
  biggest_risk: 'Crowded market',
});

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-g1',
    agentRole: 'gtm',
    description: 'Generate GTM strategy for StatusWatch',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'generate_gtm', product },
    approvalRequired: false,
    ...overrides,
  };
}

function makeAgentHandle(overrides: Partial<SkillAgentHandle> = {}): SkillAgentHandle {
  return {
    think: jest.fn().mockResolvedValue(GTM_JSON),
    useTool: jest.fn(),
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

describe('generateStrategySkill — GTM -> Content handoff', () => {
  it('does not propose a content-draft handoff when offerContentDraft is not set', async () => {
    const agent = makeAgentHandle();

    await generateStrategySkill.execute({ agent, task: makeTask(), input: { product } });

    expect(agent.proposeAction).not.toHaveBeenCalled();
    expect(agent.emit).not.toHaveBeenCalledWith('agent:handoff_requested', expect.anything());
  });

  it('always emits agent:gtm_generated and remembers the strategy regardless of the handoff decision', async () => {
    const proposeAction = jest.fn().mockResolvedValue(false);
    const agent = makeAgentHandle({ proposeAction });

    await generateStrategySkill.execute({
      agent,
      task: makeTask(),
      input: { product, offerContentDraft: { platform: 'linkedin' } },
    });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:gtm_generated',
      expect.objectContaining({ taskId: 'task-g1' })
    );
    expect(agent.remember).toHaveBeenCalled();
  });

  it('proposes an independent approval for the content draft when offerContentDraft is set', async () => {
    const proposeAction = jest.fn().mockResolvedValue(true);
    const agent = makeAgentHandle({ proposeAction });

    await generateStrategySkill.execute({
      agent,
      task: makeTask(),
      input: { product, offerContentDraft: { platform: 'linkedin', tone: 'direct' } },
    });

    expect(proposeAction).toHaveBeenCalledTimes(1);
    expect(proposeAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("Draft linkedin content announcing StatusWatch's launch"),
      expect.objectContaining({ platform: 'linkedin' }),
      expect.objectContaining({ agentRole: 'content' }) // resumeTask, for durability across a restart
    );
  });

  it('emits agent:handoff_requested with a well-formed Content task once the draft approval is granted', async () => {
    const agent = makeAgentHandle();

    await generateStrategySkill.execute({
      agent,
      task: makeTask(),
      input: { product, offerContentDraft: { platform: 'linkedin', tone: 'direct' } },
    });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:handoff_requested',
      expect.objectContaining({
        task: expect.objectContaining({
          agentRole: 'content',
          input: expect.objectContaining({
            type: 'generate_post',
            platform: 'linkedin',
            tone: 'direct',
            topic: expect.stringContaining('StatusWatch'),
            extraContext: expect.stringContaining('Calm status monitoring'),
          }),
        }),
      })
    );
  });

  it('does not emit a handoff when the content-draft approval is declined', async () => {
    const proposeAction = jest.fn().mockResolvedValue(false);
    const agent = makeAgentHandle({ proposeAction });

    await generateStrategySkill.execute({
      agent,
      task: makeTask(),
      input: { product, offerContentDraft: { platform: 'linkedin' } },
    });

    expect(agent.emit).not.toHaveBeenCalledWith('agent:handoff_requested', expect.anything());
  });
});

describe('generateStrategySkill — GTM -> Content calendar handoff', () => {
  it('does not propose a calendar handoff when offerContentCalendar is not set', async () => {
    const agent = makeAgentHandle();

    await generateStrategySkill.execute({ agent, task: makeTask(), input: { product } });

    expect(agent.proposeAction).not.toHaveBeenCalled();
  });

  it('proposes an independent approval for the content calendar when offerContentCalendar is set', async () => {
    const proposeAction = jest.fn().mockResolvedValue(true);
    const agent = makeAgentHandle({ proposeAction });

    await generateStrategySkill.execute({
      agent,
      task: makeTask(),
      input: { product, offerContentCalendar: { platforms: ['linkedin', 'twitter'] } },
    });

    expect(proposeAction).toHaveBeenCalledTimes(1);
    expect(proposeAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('full content calendar for StatusWatch'),
      expect.objectContaining({ platforms: ['linkedin', 'twitter'] }),
      expect.objectContaining({ agentRole: 'content' }) // resumeTask, for durability across a restart
    );
  });

  it('emits agent:handoff_requested with a well-formed generate_plan_from_timeline Content task once approved', async () => {
    const agent = makeAgentHandle();

    await generateStrategySkill.execute({
      agent,
      task: makeTask(),
      input: { product, offerContentCalendar: { platforms: ['linkedin', 'twitter'] } },
    });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:handoff_requested',
      expect.objectContaining({
        task: expect.objectContaining({
          agentRole: 'content',
          input: expect.objectContaining({
            type: 'generate_plan_from_timeline',
            productName: 'StatusWatch',
            platforms: ['linkedin', 'twitter'],
            timeline: expect.arrayContaining([
              expect.objectContaining({ week: 'Week 1', focus: 'Pre-launch teaser' }),
            ]),
          }),
        }),
      })
    );
  });

  it('does not emit a handoff when the calendar approval is declined', async () => {
    const proposeAction = jest.fn().mockResolvedValue(false);
    const agent = makeAgentHandle({ proposeAction });

    await generateStrategySkill.execute({
      agent,
      task: makeTask(),
      input: { product, offerContentCalendar: { platforms: ['linkedin'] } },
    });

    expect(agent.emit).not.toHaveBeenCalledWith('agent:handoff_requested', expect.anything());
  });

  it('both handoffs can be requested together, independently', async () => {
    const proposeAction = jest.fn().mockResolvedValue(true);
    const agent = makeAgentHandle({ proposeAction });

    await generateStrategySkill.execute({
      agent,
      task: makeTask(),
      input: {
        product,
        offerContentDraft: { platform: 'linkedin' },
        offerContentCalendar: { platforms: ['twitter'] },
      },
    });

    expect(proposeAction).toHaveBeenCalledTimes(2);
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:handoff_requested',
      expect.objectContaining({
        task: expect.objectContaining({
          input: expect.objectContaining({ type: 'generate_post' }),
        }),
      })
    );
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:handoff_requested',
      expect.objectContaining({
        task: expect.objectContaining({
          input: expect.objectContaining({ type: 'generate_plan_from_timeline' }),
        }),
      })
    );
  });
});
