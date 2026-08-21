import type { AgentTask, SkillAgentHandle } from '@wireassist/core';
import { proposeSkillSkill } from '../propose-skill';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-ps1',
    agentRole: 'strategy',
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

const DRAFT_RESPONSE = `SKILL_NAME: Cost Sheet Check
FILENAME: cost-sheet-check.ts
SUMMARY: Flags workflows missing a cost sheet before they run.
\`\`\`ts
import type { Skill } from '@wireassist/core';

export const costSheetCheckSkill: Skill<{}, void> = {
  name: 'cost_sheet_check',
  role: 'strategy',
  description: 'Flags missing cost sheets.',
  async execute({ agent }) {
    agent.emit('agent:cost_sheet_check_complete', {});
  },
};
\`\`\``;

describe('proposeSkillSkill (ops)', () => {
  it('is named propose_skill with role strategy', () => {
    expect(proposeSkillSkill.name).toBe('propose_skill');
    expect(proposeSkillSkill.role).toBe('strategy');
  });

  it('on approval, hands off to GitHub with the ops-specific proposed/ path', async () => {
    const think = jest.fn().mockResolvedValue(DRAFT_RESPONSE);
    const agent = makeAgentHandle({ think });
    const task = makeTask();

    await proposeSkillSkill.execute({
      agent,
      task,
      input: { request: 'a skill that checks cost sheets' },
    });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:handoff_requested',
      expect.objectContaining({
        task: expect.objectContaining({
          agentRole: 'github',
          input: expect.objectContaining({
            prompt: expect.stringContaining(
              'packages/agents/ops/src/skills/proposed/cost-sheet-check.ts'
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
      input: { request: 'a skill that checks cost sheets' },
    });

    expect(agent.emit).not.toHaveBeenCalledWith('agent:handoff_requested', expect.anything());
  });
});
