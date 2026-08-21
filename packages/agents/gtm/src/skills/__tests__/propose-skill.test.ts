import type { AgentTask, SkillAgentHandle } from '@wireassist/core';
import { proposeSkillSkill } from '../propose-skill';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-ps1',
    agentRole: 'gtm',
    description: 'Propose a new skill',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'propose_skill', request: 'a skill that does X' },
    approvalRequired: false,
    ...overrides,
  };
}

function makeAgentHandle(overrides: Partial<SkillAgentHandle> = {}): SkillAgentHandle {
  return {
    think: jest.fn(),
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

const DRAFT_RESPONSE = `SKILL_NAME: Pricing Comparator
FILENAME: pricing-comparator.ts
SUMMARY: Compares pricing tiers against named competitors.
\`\`\`ts
import type { Skill } from '@wireassist/core';

export const pricingComparatorSkill: Skill<{}, void> = {
  name: 'pricing_comparator',
  role: 'gtm',
  description: 'Compares pricing tiers.',
  async execute({ agent }) {
    agent.emit('agent:gtm_pricing_comparison', {});
  },
};
\`\`\``;

describe('proposeSkillSkill (gtm)', () => {
  it('is named propose_skill with role gtm', () => {
    expect(proposeSkillSkill.name).toBe('propose_skill');
    expect(proposeSkillSkill.role).toBe('gtm');
  });

  it('on approval, hands off to GitHub with the gtm-specific proposed/ path', async () => {
    const think = jest.fn().mockResolvedValue(DRAFT_RESPONSE);
    const agent = makeAgentHandle({ think });
    const task = makeTask();

    await proposeSkillSkill.execute({
      agent,
      task,
      input: { request: 'a skill that compares pricing' },
    });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:handoff_requested',
      expect.objectContaining({
        task: expect.objectContaining({
          agentRole: 'github',
          input: expect.objectContaining({
            prompt: expect.stringContaining(
              'packages/agents/gtm/src/skills/proposed/pricing-comparator.ts'
            ),
          }),
        }),
      })
    );
  });

  it('on decline, never emits a handoff', async () => {
    const think = jest.fn().mockResolvedValue(DRAFT_RESPONSE);
    const agent = makeAgentHandle({ think, proposeAction: jest.fn().mockResolvedValue(false) });

    await proposeSkillSkill.execute({
      agent,
      task: makeTask(),
      input: { request: 'a skill that compares pricing' },
    });

    expect(agent.emit).not.toHaveBeenCalledWith('agent:handoff_requested', expect.anything());
  });
});
