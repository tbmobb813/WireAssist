import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { ApprovalRequest } from './types';
import type { AgentRole } from '../agents/types';

export class ApprovalQueue {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.init();
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

  // Agent calls this and awaits — resolves when user approves/rejects (max 10 min)
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
      const maxAttempts = 300;
      let attempts = 0;

      const poll = setInterval(() => {
        attempts++;
        const row = this.db.prepare('SELECT status FROM approval_queue WHERE id = ?').get(id) as
          | { status: string }
          | undefined;

        if (row?.status === 'approved') {
          clearInterval(poll);
          resolve(true);
        } else if (row?.status === 'rejected' || attempts >= maxAttempts) {
          clearInterval(poll);
          resolve(false);
        }
      }, 2000);
    });
  }

  // Command Center UI calls this when user taps Approve or Reject
  resolve(id: string, approved: boolean): void {
    this.db
      .prepare(
        `
      UPDATE approval_queue
      SET status = ?, resolved_at = ?
      WHERE id = ?
    `
      )
      .run(approved ? 'approved' : 'rejected', new Date().toISOString(), id);
  }

  getPending(): ApprovalRequest[] {
    const rows = this.db
      .prepare(
        `
      SELECT * FROM approval_queue WHERE status = 'pending' ORDER BY created_at ASC
    `
      )
      .all() as any[];

    return rows.map((r) => ({
      id: r.id,
      taskId: r.task_id,
      agentRole: r.agent_role as AgentRole,
      action: r.action,
      payload: JSON.parse(r.payload),
      status: r.status,
      createdAt: new Date(r.created_at),
      resolvedAt: r.resolved_at ? new Date(r.resolved_at) : undefined,
    }));
  }
}
