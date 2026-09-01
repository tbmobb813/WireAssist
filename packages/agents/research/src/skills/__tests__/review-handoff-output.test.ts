import type { AgentTask, SkillAgentHandle } from '@wireassist/core';
import { reviewHandoffOutputSkill } from '../review-handoff-output';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-review-1',
    agentRole: 'research',
    description: 'Review Content draft',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'review_handoff_output' },
    approvalRequired: false,
    ...overrides,
  };
}

function makeAgentHandle(overrides: Partial<SkillAgentHandle> = {}): SkillAgentHandle {
  return {
    think: jest.fn().mockResolvedValue('Looks fine.\n\nVERDICT: PASS'),
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

const baseInput = {
  originalQuery: 'AI trends',
  researchSummary: 'AI adoption is accelerating in mid-size companies.',
  requestedPlatform: 'linkedin',
  requestedTone: 'direct',
  producedContent: 'AI is changing everything for mid-size companies!',
  contentTaskId: 'content-task-1',
  attempt: 0,
};

describe('reviewHandoffOutputSkill', () => {
  it('reviews cold: passes the original ask and produced content to think(), not the reasoning behind it', async () => {
    const think = jest.fn().mockResolvedValue('Consistent with findings.\n\nVERDICT: PASS');
    const agent = makeAgentHandle({ think });

    await reviewHandoffOutputSkill.execute({ agent, task: makeTask(), input: baseInput });

    const prompt = think.mock.calls[0][0] as string;
    expect(prompt).toContain('AI trends');
    expect(prompt).toContain('linkedin');
    expect(prompt).toContain('direct');
    expect(prompt).toContain('AI adoption is accelerating');
    expect(prompt).toContain('AI is changing everything');
  });

  it('emits passed: true and a reason with the verdict line stripped when the review passes', async () => {
    const agent = makeAgentHandle({
      think: jest.fn().mockResolvedValue('This matches the ask well.\n\nVERDICT: PASS'),
    });

    await reviewHandoffOutputSkill.execute({ agent, task: makeTask(), input: baseInput });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:handoff_review_complete',
      expect.objectContaining({
        contentTaskId: 'content-task-1',
        passed: true,
        reason: 'This matches the ask well.',
        attempt: 0,
      })
    );
  });

  it('emits passed: false with the reason when the review fails', async () => {
    const agent = makeAgentHandle({
      think: jest
        .fn()
        .mockResolvedValue(
          'The draft claims a statistic the research never mentions.\n\nVERDICT: FAIL'
        ),
    });

    await reviewHandoffOutputSkill.execute({ agent, task: makeTask(), input: baseInput });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:handoff_review_complete',
      expect.objectContaining({
        passed: false,
        reason: 'The draft claims a statistic the research never mentions.',
      })
    );
  });

  it('carries the original ask fields and attempt number through to the emitted payload unchanged', async () => {
    const agent = makeAgentHandle();

    await reviewHandoffOutputSkill.execute({
      agent,
      task: makeTask(),
      input: { ...baseInput, attempt: 1 },
    });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:handoff_review_complete',
      expect.objectContaining({
        originalQuery: 'AI trends',
        researchSummary: baseInput.researchSummary,
        requestedPlatform: 'linkedin',
        requestedTone: 'direct',
        producedContent: baseInput.producedContent,
        attempt: 1,
      })
    );
  });

  it('treats a verdict line missing "PASS" as a failure, defaulting closed rather than open', async () => {
    const agent = makeAgentHandle({
      think: jest.fn().mockResolvedValue('Unclear whether this matches.\n\nVERDICT: UNSURE'),
    });

    await reviewHandoffOutputSkill.execute({ agent, task: makeTask(), input: baseInput });

    expect(agent.emit).toHaveBeenCalledWith(
      'agent:handoff_review_complete',
      expect.objectContaining({ passed: false })
    );
  });
});
