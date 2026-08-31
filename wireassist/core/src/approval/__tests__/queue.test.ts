import { existsSync, unlinkSync } from 'fs';
import { ApprovalQueue } from '../queue';

const TEST_DB = './test-approval-queue.db';

function freshQueue() {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  return new ApprovalQueue(TEST_DB);
}

afterEach(() => {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
});

// request() polls every 2s and awaits resolve() — too slow for a unit test,
// so we go straight at the DB via the private `db` field to seed rows in a
// known state, then assert on the public getResolved()/getPending() API.
function seed(
  queue: ApprovalQueue,
  rows: { agentRole: string; action: string; status: 'pending' | 'approved' | 'rejected' }[]
) {
  const db = (queue as any).db;
  let i = 0;
  for (const row of rows) {
    i++;
    const createdAt = new Date(Date.now() - (rows.length - i) * 1000).toISOString();
    const resolvedAt = row.status === 'pending' ? null : createdAt;
    db.prepare(
      `INSERT INTO approval_queue (id, task_id, agent_role, action, payload, status, created_at, resolved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      `id-${i}`,
      `task-${i}`,
      row.agentRole,
      row.action,
      '{}',
      row.status,
      createdAt,
      resolvedAt
    );
  }
}

describe('ApprovalQueue.getResolved()', () => {
  it('excludes pending rows', () => {
    const queue = freshQueue();
    seed(queue, [
      { agentRole: 'admin', action: 'Archive email thread', status: 'approved' },
      { agentRole: 'admin', action: 'Archive email thread', status: 'pending' },
    ]);

    const resolved = queue.getResolved();
    expect(resolved).toHaveLength(1);
    expect(resolved[0].status).toBe('approved');
  });

  it('orders most-recently-resolved first', () => {
    const queue = freshQueue();
    seed(queue, [
      { agentRole: 'admin', action: 'A', status: 'approved' },
      { agentRole: 'admin', action: 'B', status: 'rejected' },
      { agentRole: 'admin', action: 'C', status: 'approved' },
    ]);

    const resolved = queue.getResolved();
    expect(resolved.map((r) => r.action)).toEqual(['C', 'B', 'A']);
  });

  it('filters by agentRole when provided', () => {
    const queue = freshQueue();
    seed(queue, [
      { agentRole: 'admin', action: 'A', status: 'approved' },
      { agentRole: 'content', action: 'B', status: 'approved' },
    ]);

    const resolved = queue.getResolved({ agentRole: 'content' as any });
    expect(resolved).toHaveLength(1);
    expect(resolved[0].agentRole).toBe('content');
  });

  it('respects limit', () => {
    const queue = freshQueue();
    seed(queue, [
      { agentRole: 'admin', action: 'A', status: 'approved' },
      { agentRole: 'admin', action: 'B', status: 'approved' },
      { agentRole: 'admin', action: 'C', status: 'approved' },
    ]);

    const resolved = queue.getResolved({ limit: 2 });
    expect(resolved).toHaveLength(2);
  });

  it('returns an empty array when nothing has been resolved', () => {
    const queue = freshQueue();
    seed(queue, [{ agentRole: 'admin', action: 'A', status: 'pending' }]);

    expect(queue.getResolved()).toEqual([]);
  });
});

describe('ApprovalQueue restart recovery (issue #184)', () => {
  it('markConsumed sets consumed_at, visible via getResolved', () => {
    const queue = freshQueue();
    seed(queue, [{ agentRole: 'admin', action: 'A', status: 'approved' }]);

    queue.markConsumed('id-1');

    const [row] = queue.getResolved();
    expect(row.consumedAt).toBeInstanceOf(Date);
  });

  it('getOrphanedApprovals finds approved rows never marked consumed', () => {
    const queue = freshQueue();
    seed(queue, [
      { agentRole: 'ops', action: 'Run workflow X', status: 'approved' },
      { agentRole: 'ops', action: 'Run workflow Y', status: 'approved' },
      { agentRole: 'admin', action: 'Archive thread', status: 'rejected' },
      { agentRole: 'admin', action: 'Send draft', status: 'pending' },
    ]);
    queue.markConsumed('id-1'); // Y consumed, X and the others are not

    const orphaned = queue.getOrphanedApprovals();
    expect(orphaned).toHaveLength(1);
    expect(orphaned[0].action).toBe('Run workflow Y');
  });

  it('getOrphanedApprovals returns an empty array when nothing is orphaned', () => {
    const queue = freshQueue();
    seed(queue, [{ agentRole: 'admin', action: 'A', status: 'approved' }]);
    queue.markConsumed('id-1');

    expect(queue.getOrphanedApprovals()).toEqual([]);
  });

  it('rejectStalePending rejects every pending row and records the reason', () => {
    const queue = freshQueue();
    seed(queue, [
      { agentRole: 'admin', action: 'Draft A', status: 'pending' },
      { agentRole: 'content', action: 'Draft B', status: 'pending' },
      { agentRole: 'ops', action: 'Already handled', status: 'approved' },
    ]);

    const rejected = queue.rejectStalePending('no live process left');

    expect(rejected).toHaveLength(2);
    expect(queue.getPending()).toEqual([]);
    const resolved = queue.getResolved();
    const stale = resolved.filter((r) => r.action === 'Draft A' || r.action === 'Draft B');
    expect(stale.every((r) => r.status === 'rejected')).toBe(true);
    expect(stale.every((r) => r.resolutionNote === 'no live process left')).toBe(true);
    // The already-approved row is untouched.
    expect(resolved.find((r) => r.action === 'Already handled')?.status).toBe('approved');
  });

  it('rejectStalePending is a no-op and returns [] when nothing is pending', () => {
    const queue = freshQueue();
    seed(queue, [{ agentRole: 'admin', action: 'A', status: 'approved' }]);

    expect(queue.rejectStalePending('unused')).toEqual([]);
    expect(queue.getResolved()[0].status).toBe('approved');
  });

  it('request() marks the approval consumed once it observes approval', async () => {
    const queue = freshQueue();
    const db = (queue as any).db;

    const requestPromise = queue.request({
      taskId: 'task-x',
      agentRole: 'admin' as any,
      action: 'Send email',
      payload: {},
    });

    const [{ id }] = db.prepare('SELECT id FROM approval_queue').all() as { id: string }[];
    queue.resolve(id, true);

    await expect(requestPromise).resolves.toBe(true);
    const row = db.prepare('SELECT consumed_at FROM approval_queue WHERE id = ?').get(id) as {
      consumed_at: string | null;
    };
    expect(row.consumed_at).not.toBeNull();
    expect(queue.getOrphanedApprovals()).toEqual([]);
  }, 10000);
});

describe('ApprovalQueue resumeTask (true handoff durability)', () => {
  const sampleTask = {
    id: 'task-handoff-1',
    agentRole: 'content' as any,
    description: 'Generate linkedin post about: AI trends',
    status: 'queued' as const,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    input: { type: 'generate_post', topic: 'AI trends' },
    approvalRequired: true,
  };

  it('persists resumeTask via request() and returns it, with Date fields rehydrated, once orphaned', () => {
    const queue = freshQueue();
    const db = (queue as any).db;

    // request() itself always marks consumed the moment its own in-process
    // poll notices the approval (that's the fast/live path) — so "orphaned"
    // can only be produced the way a real restart does: a fresh process
    // that never had a live request()/poll for this row at all, just an
    // approved row sitting in the DB. Insert directly, mirroring seed().
    db.prepare(
      `INSERT INTO approval_queue (id, task_id, agent_role, action, payload, status, created_at, resolved_at, resume_task)
       VALUES (?, ?, ?, ?, ?, 'approved', ?, ?, ?)`
    ).run(
      'id-1',
      'task-x',
      'research',
      'Draft linkedin content?',
      '{}',
      new Date().toISOString(),
      new Date().toISOString(),
      JSON.stringify(sampleTask)
    );

    const [orphaned] = queue.getOrphanedApprovals();
    expect(orphaned.resumeTask).toBeDefined();
    expect(orphaned.resumeTask?.id).toBe('task-handoff-1');
    expect(orphaned.resumeTask?.agentRole).toBe('content');
    expect(orphaned.resumeTask?.createdAt).toBeInstanceOf(Date);
    expect(orphaned.resumeTask?.createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('request() writes resumeTask to the DB row when supplied', async () => {
    const queue = freshQueue();
    const db = (queue as any).db;

    const requestPromise = queue.request({
      taskId: 'task-x',
      agentRole: 'research' as any,
      action: 'Draft linkedin content?',
      payload: {},
      resumeTask: sampleTask,
    });

    const [{ id, resume_task }] = db
      .prepare('SELECT id, resume_task FROM approval_queue')
      .all() as { id: string; resume_task: string }[];
    expect(JSON.parse(resume_task).id).toBe('task-handoff-1');

    // Drain the live path too, so the pending timer doesn't leak past the test.
    queue.resolve(id, true);
    await requestPromise;
  }, 10000);

  it('leaves resumeTask undefined when the caller does not pass one', () => {
    const queue = freshQueue();
    seed(queue, [{ agentRole: 'admin', action: 'Store research findings', status: 'approved' }]);

    const [orphaned] = queue.getOrphanedApprovals();
    expect(orphaned.resumeTask).toBeUndefined();
  });
});
