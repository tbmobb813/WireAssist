import type { AgentTask, SkillAgentHandle } from '@wireassist/core';
import { proposeSkillSkill } from '../propose-skill';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-ps1',
    agentRole: 'admin',
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

const DRAFT_RESPONSE = `SKILL_NAME: Weather Check
FILENAME: weather-check.ts
SUMMARY: Checks the weather and remembers rainy days.
\`\`\`ts
import type { Skill } from '@wireassist/core';

export const weatherCheckSkill: Skill<{}, void> = {
  name: 'weather_check',
  role: 'admin',
  description: 'Checks the weather.',
  async execute({ agent, task }) {
    agent.remember('checked weather', ['weather']);
  },
};
\`\`\``;

describe('proposeSkillSkill', () => {
  it('proposes approval with the drafted code, filename, and description in the payload', async () => {
    const think = jest.fn().mockResolvedValue(DRAFT_RESPONSE);
    const agent = makeAgentHandle({ think });

    await proposeSkillSkill.execute({
      agent,
      task: makeTask(),
      input: { request: 'a skill that checks the weather' },
    });

    expect(agent.proposeAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('Weather Check'),
      expect.objectContaining({
        filename: 'weather-check.ts',
        description: 'Checks the weather and remembers rainy days.',
        code: expect.stringContaining('weatherCheckSkill'),
      })
    );
  });

  it('on approval, emits agent:handoff_requested with a github-role task referencing the branch/path/PR instructions', async () => {
    const think = jest.fn().mockResolvedValue(DRAFT_RESPONSE);
    const agent = makeAgentHandle({ think, proposeAction: jest.fn().mockResolvedValue(true) });

    await proposeSkillSkill.execute({
      agent,
      task: makeTask(),
      input: { request: 'a skill that checks the weather' },
    });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:handoff_requested',
      expect.objectContaining({
        task: expect.objectContaining({
          agentRole: 'github',
          input: expect.objectContaining({
            type: 'freeform',
            prompt: expect.stringContaining('skill-proposal/weather-check'),
          }),
        }),
      })
    );
    const handoffCall = (agent.emit as jest.Mock).mock.calls.find(
      (c) => c[0] === 'agent:handoff_requested'
    );
    const prompt = handoffCall[1].task.input.prompt as string;
    expect(prompt).toContain('packages/agents/admin/src/skills/proposed/weather-check.ts');
    expect(prompt).toContain('DRAFT pull request');
    // Confirmed live: without the target repo stated explicitly, the GitHub
    // Dev Agent correctly asked for owner/repo instead of guessing.
    expect(prompt).toContain('tbmobb813/WireAssist');

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:propose_skill_response',
      expect.objectContaining({ response: expect.stringContaining('Weather Check') })
    );
  });

  it('on decline, never emits a handoff', async () => {
    const think = jest.fn().mockResolvedValue(DRAFT_RESPONSE);
    const agent = makeAgentHandle({ think, proposeAction: jest.fn().mockResolvedValue(false) });

    await proposeSkillSkill.execute({
      agent,
      task: makeTask(),
      input: { request: 'a skill that checks the weather' },
    });

    expect(agent.emit).not.toHaveBeenCalledWith('agent:handoff_requested', expect.anything());
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:propose_skill_response',
      expect.objectContaining({ response: expect.stringContaining('Declined') })
    );
  });

  it('when the draft response asks for clarification, emits the question directly without ever calling proposeAction', async () => {
    const think = jest
      .fn()
      .mockResolvedValue('CLARIFICATION_NEEDED: Which platform should this post to?');
    const agent = makeAgentHandle({ think });

    await proposeSkillSkill.execute({
      agent,
      task: makeTask(),
      input: { request: 'a skill that posts things' },
    });

    expect(agent.proposeAction).not.toHaveBeenCalled();
    expect(agent.emit).not.toHaveBeenCalledWith('agent:handoff_requested', expect.anything());
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:propose_skill_response',
      expect.objectContaining({ response: expect.stringContaining('Which platform') })
    );
  });

  it('when the draft response cannot be parsed at all, asks for a rephrase instead of proceeding', async () => {
    const think = jest.fn().mockResolvedValue('I am not sure how to help with that.');
    const agent = makeAgentHandle({ think });

    await proposeSkillSkill.execute({
      agent,
      task: makeTask(),
      input: { request: 'something incoherent' },
    });

    expect(agent.proposeAction).not.toHaveBeenCalled();
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:propose_skill_response',
      expect.objectContaining({ response: expect.stringContaining('rephrase') })
    );
  });
});
