import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import type { ApprovalRequest } from './types';
import type { AgentRole } from '../agents/types';

export class ApprovalQueue {
  private db: Database.Database;
  private notifier = new EventEmitter();

  constructor(dbPath: string) {
    this.db = new Database(dbPath, { timeout: 5000 });
    this.init();
    // Multiple stores (ApprovalQueue, MemoryStore, ConversationStore, etc.)
    // each open an independent connection to this same shared file — WAL is
    // the correct mode for that. See ConversationStore's constructor for
    // the full incident notes (a transient, non-corrupting error observed
    // while building /chat persistence, and how callers should handle it).
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS approval_queue (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        agent_role TEXT NOT NULL,
        action TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        resolved_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_approval_status ON approval_queue(status);
    `);
  }

  // Agent calls this and awaits — resolves instantly when user approves/rejects (max 10 min)
  request(params: {
    taskId: string;
    agentRole: AgentRole;
    action: string;
    payload: Record<string, unknown>;
  }): Promise<boolean> {
    const id = randomUUID();
    this.db
      .prepare(
        `
      INSERT INTO approval_queue (id, task_id, agent_role, action, payload, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `
      )
      .run(
        id,
        params.taskId,
        params.agentRole,
        params.action,
        JSON.stringify(params.payload),
        new Date().toISOString()
      );

    return new Promise((resolve) => {
      let timer: NodeJS.Timeout;

      const onResolved = (approved: boolean) => {
        clearTimeout(timer);
        this.notifier.removeListener(`resolved:${id}`, onResolved);
        resolve(approved);
      };

      this.notifier.once(`resolved:${id}`, onResolved);

      // Safety timeout after 10 minutes (600,000 ms) in case process restarts or event is lost
      timer = setTimeout(() => {
        this.notifier.removeListener(`resolved:${id}`, onResolved);
        const row = this.db.prepare('SELECT status FROM approval_queue WHERE id = ?').get(id) as
          | { status: string }
          | undefined;
        resolve(row?.status === 'approved');
      }, 600000);
    });
  }

  // Command Center UI calls this when user taps Approve or Reject
  resolve(id: string, approved: boolean): void {
    const status = approved ? 'approved' : 'rejected';
    this.db
      .prepare(
        `
      UPDATE approval_queue
      SET status = ?, resolved_at = ?
      WHERE id = ?
    `
      )
      .run(status, new Date().toISOString(), id);

    this.notifier.emit(`resolved:${id}`, approved);
  }

  getPending(): ApprovalRequest[] {
    const rows = this.db
      .prepare(
        `
      SELECT * FROM approval_queue WHERE status = 'pending' ORDER BY created_at ASC
    `
      )
      .all() as any[];

    return rows.map(mapRow);
  }

  getResolved(params?: { agentRole?: AgentRole; limit?: number }): ApprovalRequest[] {
    const limit = params?.limit ?? 200;
    const rows = params?.agentRole
      ? (this.db
          .prepare(
            `
      SELECT * FROM approval_queue
      WHERE status IN ('approved', 'rejected') AND agent_role = ?
      ORDER BY resolved_at DESC
      LIMIT ?
    `
          )
          .all(params.agentRole, limit) as any[])
      : (this.db
          .prepare(
            `
      SELECT * FROM approval_queue
      WHERE status IN ('approved', 'rejected')
      ORDER BY resolved_at DESC
      LIMIT ?
    `
          )
          .all(limit) as any[]);

    return rows.map(mapRow);
  }
}

function mapRow(r: any): ApprovalRequest {
  return {
    id: r.id,
    taskId: r.task_id,
    agentRole: r.agent_role as AgentRole,
    action: r.action,
    payload: JSON.parse(r.payload),
    status: r.status,
    createdAt: new Date(r.created_at),
    resolvedAt: r.resolved_at ? new Date(r.resolved_at) : undefined,
  };
}
