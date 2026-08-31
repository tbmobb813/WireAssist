import type { AgentTask, ApprovalRequest } from '@wireassist/core';
import { replayOrphanedHandoffs } from '../lib/replay-handoffs';

function makeTask(id: string): AgentTask {
  return {
    id,
    agentRole: 'content',
    description: 'test',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: {},
    approvalRequired: true,
  };
}

function makeApproval(overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return {
    id: 'approval-1',
    taskId: 'task-1',
    agentRole: 'research',
    action: 'Draft linkedin content?',
    payload: {},
    status: 'approved',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('replayOrphanedHandoffs()', () => {
  it('emits and marks consumed only the approvals carrying a resumeTask', () => {
    const withHandoff = makeApproval({ id: 'a1', resumeTask: makeTask('t1') });
    const withoutHandoff = makeApproval({ id: 'a2', action: 'Store research findings' });
    const emitHandoff = jest.fn();
    const markConsumed = jest.fn();

    const replayed = replayOrphanedHandoffs(
      [withHandoff, withoutHandoff],
      emitHandoff,
      markConsumed
    );

    expect(replayed).toEqual([withHandoff]);
    expect(emitHandoff).toHaveBeenCalledTimes(1);
    expect(emitHandoff).toHaveBeenCalledWith(withHandoff.resumeTask);
    expect(markConsumed).toHaveBeenCalledTimes(1);
    expect(markConsumed).toHaveBeenCalledWith('a1');
  });

  it('replays every resumeTask-bearing approval, in order', () => {
    const a1 = makeApproval({ id: 'a1', resumeTask: makeTask('t1') });
    const a2 = makeApproval({ id: 'a2', resumeTask: makeTask('t2') });
    const emitHandoff = jest.fn();
    const markConsumed = jest.fn();

    replayOrphanedHandoffs([a1, a2], emitHandoff, markConsumed);

    expect(emitHandoff.mock.calls.map((c) => c[0].id)).toEqual(['t1', 't2']);
    expect(markConsumed.mock.calls.map((c) => c[0])).toEqual(['a1', 'a2']);
  });

  it('is a no-op and returns [] when nothing is orphaned', () => {
    const emitHandoff = jest.fn();
    const markConsumed = jest.fn();

    const replayed = replayOrphanedHandoffs([], emitHandoff, markConsumed);

    expect(replayed).toEqual([]);
    expect(emitHandoff).not.toHaveBeenCalled();
    expect(markConsumed).not.toHaveBeenCalled();
  });

  it('does not touch orphaned approvals with no resumeTask', () => {
    const withoutHandoff = makeApproval({ id: 'a2', action: 'Store research findings' });
    const emitHandoff = jest.fn();
    const markConsumed = jest.fn();

    const replayed = replayOrphanedHandoffs([withoutHandoff], emitHandoff, markConsumed);

    expect(replayed).toEqual([]);
    expect(emitHandoff).not.toHaveBeenCalled();
    expect(markConsumed).not.toHaveBeenCalled();
  });
});
