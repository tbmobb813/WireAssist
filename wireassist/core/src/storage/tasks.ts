import Database from 'better-sqlite3';
import type { AgentTask, AgentRole } from '../agents/types';

export class TaskStore {
  private db: Database.Database;

  constructor(storagePath: string = './data/aia.db') {
    this.db = new Database(storagePath, { timeout: 5000 });
    this.initTables();
    this.db.pragma('journal_mode = WAL');
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        agent_role TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        input TEXT NOT NULL,
        output TEXT,
        approval_required INTEGER DEFAULT 0,
        approval_action TEXT,
        objective_id TEXT,
        delegation_chain TEXT,
        error TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_agent_role ON tasks(agent_role);
    `);
  }

  save(task: AgentTask, error?: string): void {
    const approvalRequired = task.approvalRequired ? 1 : 0;
    const inputStr = JSON.stringify(task.input);
    const outputStr = task.output ? JSON.stringify(task.output) : null;
    const delegationChainStr = task.delegationChain ? JSON.stringify(task.delegationChain) : null;
    const createdAtStr =
      task.createdAt instanceof Date
        ? task.createdAt.toISOString()
        : new Date(task.createdAt).toISOString();
    const updatedAtStr =
      task.updatedAt instanceof Date
        ? task.updatedAt.toISOString()
        : new Date(task.updatedAt).toISOString();

    this.db
      .prepare(
        `
      INSERT INTO tasks (
        id, agent_role, description, status, created_at, updated_at, 
        input, output, approval_required, approval_action, objective_id, delegation_chain, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        updated_at = excluded.updated_at,
        output = excluded.output,
        approval_required = excluded.approval_required,
        approval_action = excluded.approval_action,
        error = excluded.error
    `
      )
      .run(
        task.id,
        task.agentRole,
        task.description,
        task.status,
        createdAtStr,
        updatedAtStr,
        inputStr,
        outputStr,
        approvalRequired,
        task.approvalAction || null,
        task.objectiveId || null,
        delegationChainStr,
        error || null
      );
  }

  get(id: string): AgentTask | undefined {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
    if (!row) return undefined;
    return this.mapRow(row);
  }

  list(options?: {
    status?: AgentTask['status'];
    agentRole?: AgentRole;
    limit?: number;
  }): AgentTask[] {
    const limit = options?.limit ?? 50;
    let sql = 'SELECT * FROM tasks';
    const params: any[] = [];

    if (options?.status || options?.agentRole) {
      sql += ' WHERE';
      const conds: string[] = [];
      if (options.status) {
        conds.push(' status = ?');
        params.push(options.status);
      }
      if (options.agentRole) {
        conds.push(' agent_role = ?');
        params.push(options.agentRole);
      }
      sql += conds.join(' AND');
    }

    sql += ' ORDER BY updated_at DESC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => this.mapRow(r));
  }

  failInterruptedTasks(): void {
    const now = new Date().toISOString();

    // 1. Get IDs of tasks that will be failed
    const activeTasks = this.db
      .prepare(
        `
      SELECT id FROM tasks WHERE status IN ('queued', 'running', 'awaiting_approval')
    `
      )
      .all() as { id: string }[];

    if (activeTasks.length === 0) return;

    const taskIds = activeTasks.map((t) => t.id);

    // 2. Mark active tasks as failed
    this.db
      .prepare(
        `
      UPDATE tasks 
      SET status = 'failed', 
          error = 'Task was interrupted due to a server restart. Please retry.', 
          updated_at = ? 
      WHERE status IN ('queued', 'running', 'awaiting_approval')
    `
      )
      .run(now);

    // 3. Reject pending approvals for these tasks
    const placeholders = taskIds.map(() => '?').join(',');
    this.db
      .prepare(
        `
      UPDATE approval_queue 
      SET status = 'rejected', 
          resolved_at = ? 
      WHERE status = 'pending' AND task_id IN (${placeholders})
    `
      )
      .run(now, ...taskIds);
  }

  private mapRow(r: any): AgentTask {
    return {
      id: r.id,
      agentRole: r.agent_role as AgentRole,
      description: r.description,
      status: r.status as AgentTask['status'],
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
      input: JSON.parse(r.input),
      output: r.output ? JSON.parse(r.output) : undefined,
      approvalRequired: r.approval_required === 1,
      approvalAction: r.approval_action || undefined,
      objectiveId: r.objective_id || undefined,
      delegationChain: r.delegation_chain ? JSON.parse(r.delegation_chain) : undefined,
    };
  }

  close(): void {
    this.db.close();
  }
}
