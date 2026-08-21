import type { AgentTask, SkillAgentHandle } from '@wireassist/core';
import { proposeSkillSkill } from '../propose-skill';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-ps1',
    agentRole: 'content',
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

const DRAFT_RESPONSE = `SKILL_NAME: Idea Sweep
FILENAME: idea-sweep.ts
SUMMARY: Sweeps for stale content ideas.
\`\`\`ts
import type { Skill } from '@wireassist/core';

export const ideaSweepSkill: Skill<{}, void> = {
  name: 'idea_sweep',
  role: 'content',
  description: 'Sweeps for stale ideas.',
  async execute({ agent }) {
    agent.remember('swept ideas', ['content']);
  },
};
\`\`\``;

describe('proposeSkillSkill (content)', () => {
  it('is named propose_skill with role content', () => {
    expect(proposeSkillSkill.name).toBe('propose_skill');
    expect(proposeSkillSkill.role).toBe('content');
  });

  it('proposes approval with the drafted code, filename, and description in the payload', async () => {
    const think = jest.fn().mockResolvedValue(DRAFT_RESPONSE);
    const agent = makeAgentHandle({ think });

    await proposeSkillSkill.execute({
      agent,
      task: makeTask(),
      input: { request: 'a skill that sweeps stale ideas' },
    });

    expect(agent.proposeAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('Idea Sweep'),
      expect.objectContaining({
        filename: 'idea-sweep.ts',
        description: 'Sweeps for stale content ideas.',
        code: expect.stringContaining('ideaSweepSkill'),
      })
    );
  });

  it('on approval, hands off to GitHub with the content-specific proposed/ path', async () => {
    const think = jest.fn().mockResolvedValue(DRAFT_RESPONSE);
    const agent = makeAgentHandle({ think });
    const task = makeTask();

    await proposeSkillSkill.execute({
      agent,
      task,
      input: { request: 'a skill that sweeps stale ideas' },
    });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:handoff_requested',
      expect.objectContaining({
        task: expect.objectContaining({
          agentRole: 'github',
          input: expect.objectContaining({
            type: 'freeform',
            prompt: expect.stringContaining(
              'packages/agents/content/src/skills/proposed/idea-sweep.ts'
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
      input: { request: 'a skill that sweeps stale ideas' },
    });

    expect(agent.emit).not.toHaveBeenCalledWith('agent:handoff_requested', expect.anything());
  });

  it('when the draft response asks for clarification, emits the question without calling proposeAction', async () => {
    const think = jest.fn().mockResolvedValue('CLARIFICATION_NEEDED: which platform?');
    const agent = makeAgentHandle({ think });

    await proposeSkillSkill.execute({
      agent,
      task: makeTask(),
      input: { request: 'a skill that posts things' },
    });

    expect(agent.proposeAction).not.toHaveBeenCalled();
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:propose_skill_response',
      expect.objectContaining({ response: 'which platform?' })
    );
  });
});
