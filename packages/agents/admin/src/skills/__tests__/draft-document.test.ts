import type { AgentTask, SkillAgentHandle } from '@wireassist/core';
import { draftDocumentSkill } from '../draft-document';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-dd1',
    agentRole: 'admin',
    description: 'Draft a document',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'draft_document', brief: 'Q3 planning notes' },
    approvalRequired: true,
    ...overrides,
  };
}

function makeAgentHandle(overrides: Partial<SkillAgentHandle> = {}): SkillAgentHandle {
  return {
    think: jest.fn().mockResolvedValue('drafted content'),
    useTool: jest.fn().mockResolvedValue({ id: 'file-1', webViewLink: 'https://drive/file-1' }),
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

describe('draftDocumentSkill', () => {
  it('drafts content via think(), proposes the action, creates the Drive file on approval, and emits', async () => {
    const think = jest.fn().mockResolvedValue('drafted content');
    const proposeAction = jest.fn().mockResolvedValue(true);
    const useTool = jest
      .fn()
      .mockResolvedValue({ id: 'file-1', webViewLink: 'https://drive/file-1' });
    const agent = makeAgentHandle({ think, proposeAction, useTool });

    await draftDocumentSkill.execute({
      agent,
      task: makeTask(),
      input: { brief: 'Q3 planning notes', title: 'Q3 Plan' },
    });

    expect(think.mock.calls[0][0]).toContain('Q3 planning notes');
    expect(proposeAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('Q3 Plan'),
      expect.objectContaining({ title: 'Q3 Plan' })
    );
    expect(useTool).toHaveBeenCalledWith('drive_create_file', {
      title: 'Q3 Plan',
      content: 'drafted content',
    });
    expect(agent.remember).toHaveBeenCalledWith(
      expect.stringContaining('Q3 Plan'),
      expect.arrayContaining(['admin'])
    );
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:draft_document_complete',
      expect.objectContaining({ title: 'Q3 Plan', webViewLink: 'https://drive/file-1' })
    );
  });

  it('falls back to a truncated brief as the title when none is given', async () => {
    const proposeAction = jest.fn().mockResolvedValue(true);
    const agent = makeAgentHandle({ proposeAction });

    await draftDocumentSkill.execute({
      agent,
      task: makeTask(),
      input: { brief: 'A short brief' },
    });

    expect(proposeAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('A short brief'),
      expect.anything()
    );
  });

  it('never creates the file when the proposal is declined', async () => {
    const proposeAction = jest.fn().mockResolvedValue(false);
    const useTool = jest.fn();
    const agent = makeAgentHandle({ proposeAction, useTool });

    await draftDocumentSkill.execute({
      agent,
      task: makeTask(),
      input: { brief: 'Q3 planning notes' },
    });

    expect(useTool).not.toHaveBeenCalled();
    expect(agent.emit).not.toHaveBeenCalled();
  });
});
