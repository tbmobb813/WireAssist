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
