import type { AgentTask } from '../../agents/types';
import type { SkillAgentHandle } from '../../skills/types';
import { createProposeSkillSkill, draftAndProposeSkill } from '../../skills/propose-skill-factory';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-ps1',
    agentRole: 'content',
    description: 'Propose a skill',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'propose_skill', request: 'do the thing' },
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

const baseConfig = {
  role: 'content' as const,
  roleLabel: 'Content',
  pathPrefix: 'packages/agents/content/src/skills/proposed/',
  fewShotExample: 'const x = 1;',
  buildHandoffTask: (task: AgentTask, prompt: string): AgentTask => ({
    ...task,
    id: 'handoff-task',
    agentRole: 'github',
    description: prompt,
  }),
};

const draftedResponse = `SKILL_NAME: Idea sweep
FILENAME: idea-sweep.ts
SUMMARY: Sweeps for stale ideas.
\`\`\`ts
export const x = 1;
\`\`\``;

describe('createProposeSkillSkill()', () => {
  it('produces a skill named "propose_skill" with the configured role, and a role-labeled description', () => {
    const skill = createProposeSkillSkill(baseConfig);
    expect(skill.name).toBe('propose_skill');
    expect(skill.role).toBe('content');
    expect(skill.description).toContain('Content skill');
  });

  it('emits a clarification response and never proposes when think() asks for clarification', async () => {
    const think = jest.fn().mockResolvedValue('CLARIFICATION_NEEDED: which platform?');
    const proposeAction = jest.fn();
    const agent = makeAgentHandle({ think, proposeAction });
    const task = makeTask();

    await createProposeSkillSkill(baseConfig).execute({ agent, task, input: { request: 'x' } });

    expect(proposeAction).not.toHaveBeenCalled();
    expect(agent.emit).toHaveBeenCalledWith('agent:propose_skill_response', {
      taskId: task.id,
      response: 'which platform?',
    });
  });

  it('emits a decline response and never hands off when proposeAction is rejected', async () => {
    const think = jest.fn().mockResolvedValue(draftedResponse);
    const proposeAction = jest.fn().mockResolvedValue(false);
    const agent = makeAgentHandle({ think, proposeAction });
    const task = makeTask();

    await createProposeSkillSkill(baseConfig).execute({ agent, task, input: { request: 'x' } });

    expect(agent.emit).not.toHaveBeenCalledWith('agent:handoff_requested', expect.anything());
    expect(agent.emit).toHaveBeenCalledWith('agent:propose_skill_response', {
      taskId: task.id,
      response: 'Declined — not proposing this skill.',
    });
  });

  it('on approval, hands off to GitHub via buildHandoffTask with the configured pathPrefix and roleLabel', async () => {
    const think = jest.fn().mockResolvedValue(draftedResponse);
    const buildHandoffTask = jest.fn(baseConfig.buildHandoffTask);
    const agent = makeAgentHandle({ think });
    const task = makeTask();

    await createProposeSkillSkill({ ...baseConfig, buildHandoffTask }).execute({
      agent,
      task,
      input: { request: 'x' },
    });

    expect(buildHandoffTask).toHaveBeenCalledWith(task, expect.stringContaining('Content skill'));
    const [, prompt] = buildHandoffTask.mock.calls[0];
    expect(prompt).toContain('packages/agents/content/src/skills/proposed/idea-sweep.ts');
    expect(prompt).toContain('skill-proposal/idea-sweep');
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:handoff_requested',
      expect.objectContaining({ task: expect.objectContaining({ id: 'handoff-task' }) })
    );
  });

  it('embeds the configured role into the drafting prompt sent to think()', async () => {
    const think = jest.fn().mockResolvedValue('CLARIFICATION_NEEDED: x');
    const agent = makeAgentHandle({ think });

    await createProposeSkillSkill({ ...baseConfig, role: 'strategy', roleLabel: 'NixOps' }).execute(
      { agent, task: makeTask(), input: { request: 'x' } }
    );

    const prompt = think.mock.calls[0][0] as string;
    expect(prompt).toContain("role: 'strategy'");
    expect(prompt).toMatch(/new NixOps\s+skill/);
  });

  it('falls back to a parse-failure clarification when think() returns unparseable output', async () => {
    const think = jest.fn().mockResolvedValue('not in the expected format at all');
    const agent = makeAgentHandle({ think });
    const task = makeTask();

    await createProposeSkillSkill(baseConfig).execute({ agent, task, input: { request: 'x' } });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:propose_skill_response',
      expect.objectContaining({ response: expect.stringContaining("couldn't parse") })
    );
  });
});

describe('draftAndProposeSkill()', () => {
  it('is directly callable outside a full Skill dispatch, for a second caller drafting from an inferred pattern', async () => {
    const think = jest.fn().mockResolvedValue(draftedResponse);
    const agent = makeAgentHandle({ think });
    const task = makeTask();

    await draftAndProposeSkill({ ...baseConfig, agent, task, request: 'pattern-derived request' });

    expect(think.mock.calls[0][0]).toContain('pattern-derived request');
    expect(agent.emit).toHaveBeenCalledWith('agent:handoff_requested', expect.anything());
  });
});
