import type { AgentTask, SkillAgentHandle } from '@wireassist/core';
import { researchTopicSkill } from '../research-topic';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-r1',
    agentRole: 'research',
    description: 'Research AI trends',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'research_topic', query: 'AI trends' },
    approvalRequired: true,
    ...overrides,
  };
}

function makeAgentHandle(overrides: Partial<SkillAgentHandle> = {}): SkillAgentHandle {
  return {
    think: jest.fn().mockResolvedValue('Findings summary.'),
    useTool: jest.fn().mockResolvedValue({
      results: [{ title: 'A', url: 'https://a.example', description: 'desc' }],
    }),
    loadContext: jest.fn().mockResolvedValue(''),
    remember: jest.fn(),
    proposeAction: jest.fn().mockResolvedValue(true),
    emit: jest.fn(),
    runToolLoop: jest.fn().mockResolvedValue(''),
    ...overrides,
  };
}

describe('researchTopicSkill — Research -> Content handoff', () => {
  it('does not propose a content-draft handoff when offerContentDraft is not set', async () => {
    const agent = makeAgentHandle();

    await researchTopicSkill.execute({ agent, task: makeTask(), input: { query: 'AI trends' } });

    expect(agent.proposeAction).toHaveBeenCalledTimes(1); // only "store findings"
    expect(agent.emit).not.toHaveBeenCalledWith('agent:handoff_requested', expect.anything());
  });

  it('proposes a second, independent approval for the content draft when offerContentDraft is set', async () => {
    const proposeAction = jest.fn().mockResolvedValue(true);
    const agent = makeAgentHandle({ proposeAction });

    await researchTopicSkill.execute({
      agent,
      task: makeTask(),
      input: {
        query: 'AI trends',
        offerContentDraft: { platform: 'linkedin', tone: 'direct' },
      },
    });

    expect(proposeAction).toHaveBeenCalledTimes(2);
    expect(proposeAction).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.stringContaining('Draft linkedin content'),
      expect.objectContaining({ platform: 'linkedin' })
    );
  });

  it('emits agent:handoff_requested with a well-formed Content task once the draft approval is granted', async () => {
    const agent = makeAgentHandle();

    await researchTopicSkill.execute({
      agent,
      task: makeTask(),
      input: {
        query: 'AI trends',
        offerContentDraft: { platform: 'linkedin', tone: 'direct' },
      },
    });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:handoff_requested',
      expect.objectContaining({
        task: expect.objectContaining({
          agentRole: 'content',
          input: expect.objectContaining({
            type: 'generate_post',
            topic: 'AI trends',
            platform: 'linkedin',
            tone: 'direct',
            extraContext: 'Findings summary.',
          }),
        }),
      })
    );
  });

  it('does not emit a handoff when the content-draft approval is declined', async () => {
    const proposeAction = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const agent = makeAgentHandle({ proposeAction });

    await researchTopicSkill.execute({
      agent,
      task: makeTask(),
      input: {
        query: 'AI trends',
        offerContentDraft: { platform: 'linkedin' },
      },
    });

    expect(agent.emit).not.toHaveBeenCalledWith('agent:handoff_requested', expect.anything());
  });

  it('still stores findings independently of the handoff decision', async () => {
    const proposeAction = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const agent = makeAgentHandle({ proposeAction });

    await researchTopicSkill.execute({
      agent,
      task: makeTask(),
      input: { query: 'AI trends', offerContentDraft: { platform: 'linkedin' } },
    });

    expect(agent.remember).toHaveBeenCalledWith(
      expect.stringContaining('Research on "AI trends"'),
      expect.arrayContaining(['research', 'findings'])
    );
  });
});
