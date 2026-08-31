import { existsSync, unlinkSync } from 'fs';
import { TaskStore } from '../tasks';
import { ApprovalQueue } from '../../approval/queue';
import type { AgentTask } from '../../agents/types';

const TEST_DB = './test-task-store.db';

// In production, TaskStore and ApprovalQueue are two independent connections
// to the *same* SQLite file (see server.ts's openStores()) — failInterruptedTasks()
// reaches into approval_queue directly, so it only exists once both classes
// have opened the file at least once. Mirror that here rather than special-
// casing the schema just for this test.
function freshStore() {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  void new ApprovalQueue(TEST_DB);
  return new TaskStore(TEST_DB);
}

afterEach(() => {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
});

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-1',
    agentRole: 'admin' as any,
    description: 'Triage inbox',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: {},
    approvalRequired: false,
    ...overrides,
  };
}

describe('TaskStore.failInterruptedTasks() (issue #184)', () => {
  it('returns [] and touches nothing when no task is active', () => {
    const store = freshStore();
    store.save(makeTask({ id: 'done-1', status: 'complete' }));

    expect(store.failInterruptedTasks()).toEqual([]);
    expect(store.get('done-1')!.status).toBe('complete');
  });

  it('fails queued/running/awaiting_approval tasks and returns their info', () => {
    const store = freshStore();
    store.save(makeTask({ id: 'a', status: 'queued', description: 'Send digest' }));
    store.save(makeTask({ id: 'b', status: 'running', description: 'Publish post' }));
    store.save(makeTask({ id: 'c', status: 'awaiting_approval', description: 'Buy domain' }));
    store.save(makeTask({ id: 'd', status: 'complete', description: 'Already done' }));

    const interrupted = store.failInterruptedTasks();

    expect(interrupted.map((t) => t.id).sort()).toEqual(['a', 'b', 'c']);
    expect(store.get('a')!.status).toBe('failed');
    expect(store.get('b')!.status).toBe('failed');
    expect(store.get('c')!.status).toBe('failed');
    expect(store.get('d')!.status).toBe('complete');
  });

  it('is idempotent — a second call finds nothing left to fail', () => {
    const store = freshStore();
    store.save(makeTask({ id: 'a', status: 'queued' }));

    expect(store.failInterruptedTasks()).toHaveLength(1);
    expect(store.failInterruptedTasks()).toEqual([]);
  });
});
