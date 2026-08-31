import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { ApprovalRequest } from './types';
import type { AgentRole, AgentTask } from '../agents/types';

export class ApprovalQueue {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath, { timeout: 5000 });
    this.init();
    // Multiple stores (ApprovalQueue, MemoryStore, ConversationStore, etc.)
    // each open an independent connection to this same shared file — WAL is
    // the correct mode for that. See ConversationStore's constructor for
    // the full incident notes (a transient, non-corrupting error observed
    // while building /chat persistence, and how callers should handle it).
    this.db.pragma('journal_mode = WAL');
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

    // consumed_at / resolution_note: added after the original table, so
    // guard against re-running on a DB that already has them (SQLite has no
    // ADD COLUMN IF NOT EXISTS).
    const columns = this.db.prepare(`PRAGMA table_info(approval_queue)`).all() as {
      name: string;
    }[];
    const columnNames = new Set(columns.map((c) => c.name));
    if (!columnNames.has('consumed_at')) {
      this.db.exec(`ALTER TABLE approval_queue ADD COLUMN consumed_at TEXT`);
    }
    if (!columnNames.has('resolution_note')) {
      this.db.exec(`ALTER TABLE approval_queue ADD COLUMN resolution_note TEXT`);
    }
    if (!columnNames.has('resume_task')) {
      this.db.exec(`ALTER TABLE approval_queue ADD COLUMN resume_task TEXT`);
    }
  }

  // Agent calls this and awaits — resolves when user approves/rejects (max 10 min)
  request(params: {
    taskId: string;
    agentRole: AgentRole;
    action: string;
    payload: Record<string, unknown>;
    // Captured now, at proposal time, specifically so it survives a restart
    // that happens between approval and the continuation that would
    // otherwise be the only thing that ever emits it — see the field's own
    // doc comment on ApprovalRequest.
    resumeTask?: AgentTask;
  }): Promise<boolean> {
    const id = randomUUID();
    this.db
      .prepare(
        `
      INSERT INTO approval_queue (id, task_id, agent_role, action, payload, status, created_at, resume_task)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
    `
      )
      .run(
        id,
        params.taskId,
        params.agentRole,
        params.action,
        JSON.stringify(params.payload),
        new Date().toISOString(),
        params.resumeTask ? JSON.stringify(params.resumeTask) : null
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
          // A human can approve via the Command Center UI at any time — that
          // write lands in the DB immediately, but nothing happens until
          // *this* in-process poll notices it and resumes the waiting
          // skill's await. If the process restarts between "human clicked
          // approve" and this line running (the realistic gap: minutes, not
          // microtasks — see issue #184), the original request() call and
          // its poll are gone for good; nothing will ever resume that
          // skill's continuation. markConsumed() records that a live
          // process did see the approval, so getOrphanedApprovals() can
          // find exactly the ones that never got the chance to.
          this.markConsumed(id);
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

  markConsumed(id: string): void {
    this.db
      .prepare(`UPDATE approval_queue SET consumed_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), id);
  }

  /**
   * Approvals that were granted (status='approved') but never observed by a
   * live process (consumed_at IS NULL) — the exact failure mode in issue
   * #184: a human approved a handoff, then a restart landed before the
   * originating skill's request() poll ever noticed, so nothing downstream
   * ever ran and nothing said so. Call on boot, right after
   * TaskStore.failInterruptedTasks().
   */
  getOrphanedApprovals(): ApprovalRequest[] {
    const rows = this.db
      .prepare(
        `
      SELECT * FROM approval_queue
      WHERE status = 'approved' AND consumed_at IS NULL
      ORDER BY resolved_at ASC
    `
      )
      .all() as any[];

    return rows.map(mapRow);
  }

  /**
   * Approvals still 'pending' from a previous process instance can never be
   * consumed — the request() call and its poll loop that would have picked
   * up an Approve tap both died with the old process. Left as 'pending',
   * the Approvals UI would keep offering an Approve button that silently
   * does nothing forever. Call on boot: rejects them with a distinguishing
   * note so the UI reflects reality instead of a false affordance.
   */
  rejectStalePending(note: string): ApprovalRequest[] {
    const stale = this.db
      .prepare(`SELECT * FROM approval_queue WHERE status = 'pending'`)
      .all() as any[];

    if (stale.length === 0) return [];

    const now = new Date().toISOString();
    this.db
      .prepare(
        `
      UPDATE approval_queue
      SET status = 'rejected', resolved_at = ?, resolution_note = ?
      WHERE status = 'pending'
    `
      )
      .run(now, note);

    return stale.map(mapRow);
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
    consumedAt: r.consumed_at ? new Date(r.consumed_at) : undefined,
    resolutionNote: r.resolution_note ?? undefined,
    resumeTask: r.resume_task ? deserializeTask(JSON.parse(r.resume_task)) : undefined,
  };
}

// JSON.stringify turns an AgentTask's Date fields into ISO strings; this
// reverses that so a rehydrated resumeTask matches what AgentTask actually
// declares, the same way every other Date-bearing row in this file does.
function deserializeTask(raw: any): AgentTask {
  return { ...raw, createdAt: new Date(raw.createdAt), updatedAt: new Date(raw.updatedAt) };
}
