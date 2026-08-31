import type { AgentTask, SkillAgentHandle } from '@wireassist/core';
import { proposeSkillSkill } from '../propose-skill';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-ps1',
    agentRole: 'github',
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
    listOrphanedApprovals: jest.fn().mockReturnValue([]),
    listMemories: jest.fn().mockReturnValue([]),
    ...overrides,
  };
}

const DRAFT_RESPONSE = `SKILL_NAME: Stale Issues Nudge
FILENAME: stale-issues-nudge.ts
SUMMARY: Flags open issues that have gone too long without an update.
\`\`\`ts
import type { Skill } from '@wireassist/core';

export const staleIssuesNudgeSkill: Skill<{}, void> = {
  name: 'stale_issues_nudge',
  role: 'github',
  description: 'Flags stale issues.',
  async execute({ agent }) {
    agent.emit('agent:stale_issues_complete', {});
  },
};
\`\`\``;

describe('proposeSkillSkill (github)', () => {
  it('is named propose_skill with role github', () => {
    expect(proposeSkillSkill.name).toBe('propose_skill');
    expect(proposeSkillSkill.role).toBe('github');
  });

  it('on approval, hands off to itself (role: github) with the github-specific proposed/ path', async () => {
    const think = jest.fn().mockResolvedValue(DRAFT_RESPONSE);
    const agent = makeAgentHandle({ think });
    const task = makeTask();

    await proposeSkillSkill.execute({
      agent,
      task,
      input: { request: 'a skill that flags stale issues' },
    });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:handoff_requested',
      expect.objectContaining({
        task: expect.objectContaining({
          agentRole: 'github',
          input: expect.objectContaining({
            prompt: expect.stringContaining(
              'packages/agents/github/src/skills/proposed/stale-issues-nudge.ts'
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
      input: { request: 'a skill that flags stale issues' },
    });

    expect(agent.emit).not.toHaveBeenCalledWith('agent:handoff_requested', expect.anything());
  });
});
