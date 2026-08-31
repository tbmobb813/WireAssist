import type { AgentTask, MemoryEntry, SkillAgentHandle } from '@wireassist/core';
import { detectSkillOpportunitiesSkill } from '../detect-skill-opportunities';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-dso1',
    agentRole: 'admin',
    description: 'Detect skill opportunities',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'detect_skill_opportunities' },
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

function memory(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id: `m-${Math.random()}`,
    content: 'how did my recent posts do?',
    agentRole: 'content',
    tags: ['content', 'freeform_request'],
    createdAt: new Date(),
    ...overrides,
  };
}

const PATTERN_RESPONSE = `PATTERN: Jason repeatedly asks how his recent content performed.
ROLE: content
EXAMPLES: how did my posts do this week? | how's my content performing lately?`;

describe('detectSkillOpportunitiesSkill', () => {
  it('never calls think() when there are no tagged freeform requests', async () => {
    const think = jest.fn();
    const listMemories = jest.fn().mockReturnValue([]);
    const agent = makeAgentHandle({ think, listMemories });

    await detectSkillOpportunitiesSkill.execute({ agent, task: makeTask(), input: {} });

    expect(think).not.toHaveBeenCalled();
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:detect_skill_opportunities_complete',
      expect.objectContaining({ patternFound: false })
    );
  });

  it('queries listMemories with the freeform_request tag and default limit', async () => {
    const listMemories = jest.fn().mockReturnValue([memory()]);
    const think = jest.fn().mockResolvedValue('NO_PATTERN_FOUND');
    const agent = makeAgentHandle({ listMemories, think });

    await detectSkillOpportunitiesSkill.execute({ agent, task: makeTask(), input: {} });

    expect(listMemories).toHaveBeenCalledWith({ tags: ['freeform_request'], limit: 200 });
  });

  it('emits the empty-state event when think() finds no pattern', async () => {
    const listMemories = jest.fn().mockReturnValue([memory()]);
    const think = jest.fn().mockResolvedValue('NO_PATTERN_FOUND');
    const agent = makeAgentHandle({ listMemories, think });

    await detectSkillOpportunitiesSkill.execute({ agent, task: makeTask(), input: {} });

    expect(agent.proposeAction).not.toHaveBeenCalled();
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:detect_skill_opportunities_complete',
      expect.objectContaining({ patternFound: false })
    );
  });

  it('on a pattern hit, proposes the pattern for approval before drafting anything', async () => {
    const listMemories = jest.fn().mockReturnValue([memory(), memory()]);
    const think = jest.fn().mockResolvedValue(PATTERN_RESPONSE);
    const proposeAction = jest.fn().mockResolvedValue(true);
    const agent = makeAgentHandle({ listMemories, think, proposeAction });

    await detectSkillOpportunitiesSkill.execute({ agent, task: makeTask(), input: {} });

    expect(proposeAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('Jason repeatedly asks how his recent content performed'),
      expect.objectContaining({
        patternDescription: expect.stringContaining('recent content performed'),
        suggestedRole: 'content',
        exampleRequests: expect.arrayContaining([expect.stringContaining('how did my posts do')]),
      })
    );
  });

  it('on approval, hands off a propose_skill task to the suggested agent role', async () => {
    const listMemories = jest.fn().mockReturnValue([memory(), memory()]);
    const think = jest.fn().mockResolvedValue(PATTERN_RESPONSE);
    const agent = makeAgentHandle({
      listMemories,
      think,
      proposeAction: jest.fn().mockResolvedValue(true),
    });

    await detectSkillOpportunitiesSkill.execute({ agent, task: makeTask(), input: {} });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:handoff_requested',
      expect.objectContaining({
        task: expect.objectContaining({
          agentRole: 'content',
          input: expect.objectContaining({
            type: 'propose_skill',
            request: expect.stringContaining('recent content performed'),
          }),
        }),
      })
    );
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:detect_skill_opportunities_complete',
      expect.objectContaining({ patternFound: true, drafted: true })
    );
  });

  it('on decline, never hands off a task', async () => {
    const listMemories = jest.fn().mockReturnValue([memory(), memory()]);
    const think = jest.fn().mockResolvedValue(PATTERN_RESPONSE);
    const agent = makeAgentHandle({
      listMemories,
      think,
      proposeAction: jest.fn().mockResolvedValue(false),
    });

    await detectSkillOpportunitiesSkill.execute({ agent, task: makeTask(), input: {} });

    expect(agent.emit).not.toHaveBeenCalledWith('agent:handoff_requested', expect.anything());
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:detect_skill_opportunities_complete',
      expect.objectContaining({ patternFound: true, drafted: false })
    );
  });

  it('falls back to role admin when the response omits a valid ROLE', async () => {
    const listMemories = jest.fn().mockReturnValue([memory(), memory()]);
    const think = jest.fn().mockResolvedValue('PATTERN: something repeated.\nEXAMPLES: a | b');
    const agent = makeAgentHandle({
      listMemories,
      think,
      proposeAction: jest.fn().mockResolvedValue(true),
    });

    await detectSkillOpportunitiesSkill.execute({ agent, task: makeTask(), input: {} });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:handoff_requested',
      expect.objectContaining({ task: expect.objectContaining({ agentRole: 'admin' }) })
    );
  });

  it('respects a custom limit input', async () => {
    const listMemories = jest.fn().mockReturnValue([memory()]);
    const think = jest.fn().mockResolvedValue('NO_PATTERN_FOUND');
    const agent = makeAgentHandle({ listMemories, think });

    await detectSkillOpportunitiesSkill.execute({ agent, task: makeTask(), input: { limit: 50 } });

    expect(listMemories).toHaveBeenCalledWith({ tags: ['freeform_request'], limit: 50 });
  });
});
