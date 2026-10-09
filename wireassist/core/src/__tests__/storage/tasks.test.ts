import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { TaskStore } from '../../storage/tasks';
import type { AgentTask } from '../../agents/types';

const makeTask = (overrides: Partial<AgentTask> = {}): AgentTask => ({
  id: 'task-1',
  agentRole: 'admin',
  description: 'Triage my inbox',
  status: 'queued',
  createdAt: new Date('2026-10-09T10:00:00Z'),
  updatedAt: new Date('2026-10-09T10:00:00Z'),
  input: { type: 'email_triage' },
  approvalRequired: false,
  ...overrides,
});

describe('TaskStore — saved results survive for History', () => {
  let dir: string;
  let store: TaskStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'wa-tasks-'));
    store = new TaskStore(join(dir, 'tasks.db'));
  });
  afterEach(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns the saved output when a finished task is listed', () => {
    const task = makeTask();
    store.save(task);
    store.save({ ...task, status: 'complete', output: { summary: 'Nothing urgent.' } });

    const [listed] = store.list();
    expect(listed.status).toBe('complete');
    expect(listed.output).toEqual({ summary: 'Nothing urgent.' });
  });

  it('returns the failure reason on a failed task', () => {
    store.save(makeTask({ status: 'failed' }), 'Admin Agent returned invalid JSON');
    expect(store.get('task-1')?.error).toBe('Admin Agent returned invalid JSON');
  });

  it('keeps the failure reason when the task is saved again without one', () => {
    store.save(makeTask({ status: 'failed' }), 'boom');
    const reloaded = store.get('task-1')!;
    store.save({ ...reloaded, output: { summary: 'late write' } });
    expect(store.get('task-1')?.error).toBe('boom');
  });

  it('leaves error undefined on a task that never failed', () => {
    store.save(makeTask({ status: 'complete' }));
    expect(store.get('task-1')?.error).toBeUndefined();
  });
});
