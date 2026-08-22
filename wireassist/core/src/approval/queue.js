'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.ApprovalQueue = void 0;
const better_sqlite3_1 = __importDefault(require('better-sqlite3'));
const crypto_1 = require('crypto');
class ApprovalQueue {
  constructor(dbPath) {
    Object.defineProperty(this, 'db', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    this.db = new better_sqlite3_1.default(dbPath);
    this.init();
  }
  init() {
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
  request(params) {
    const id = (0, crypto_1.randomUUID)();
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
        const row = this.db.prepare('SELECT status FROM approval_queue WHERE id = ?').get(id);
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
  resolve(id, approved) {
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
  getPending() {
    const rows = this.db
      .prepare(
        `
      SELECT * FROM approval_queue WHERE status = 'pending' ORDER BY created_at ASC
    `
      )
      .all();
    return rows.map((r) => ({
      id: r.id,
      taskId: r.task_id,
      agentRole: r.agent_role,
      action: r.action,
      payload: JSON.parse(r.payload),
      status: r.status,
      createdAt: new Date(r.created_at),
      resolvedAt: r.resolved_at ? new Date(r.resolved_at) : undefined,
    }));
  }
}
exports.ApprovalQueue = ApprovalQueue;
