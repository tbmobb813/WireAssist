// Cross-agent Objective data layer: a lightweight, optional entity that
// tasks from any agent can tag into, so the dashboard can show which agents
// have activity toward a shared outcome. Conventions match portfolio/store.ts:
// better-sqlite3, hex ids, epoch-ms timestamps, class-per-store.
import Database from 'better-sqlite3';
import { randomBytes } from 'crypto';

function generateId(): string {
  return randomBytes(16).toString('hex');
}

export type ObjectiveStatus = 'active' | 'paused' | 'completed';

export interface Objective {
  id: string;
  title: string;
  description: string | null;
  status: ObjectiveStatus;
  createdAt: number;
  updatedAt: number;
}

export interface ObjectiveEvent {
  id: string;
  objectiveId: string;
  type: string; // e.g. 'objective.created', 'objective.transitioned', 'agent.task_started'
  payload: Record<string, unknown> | null;
  createdAt: number;
}

interface ObjectiveRow {
  id: string;
  title: string;
  description: string | null;
  status: ObjectiveStatus;
  created_at: number;
  updated_at: number;
}

interface EventRow {
  id: string;
  objective_id: string;
  type: string;
  payload: string | null;
  created_at: number;
}

export class ObjectiveStore {
  private db: Database.Database;

  constructor(storagePath: string = './data/aia.db') {
    this.db = new Database(storagePath, { timeout: 5000 });
    this.initTables();
    // See ApprovalQueue's constructor — every store sharing this file must
    // agree on journal mode (WAL), set only after initTables() finishes
    // creating any FTS5 virtual tables/triggers.
    this.db.pragma('journal_mode = WAL');
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS objectives (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_objectives_status ON objectives(status);

      CREATE TABLE IF NOT EXISTS objective_events (
        id TEXT PRIMARY KEY,
        objective_id TEXT NOT NULL,
        type TEXT NOT NULL,
        payload TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_objective_events_created
        ON objective_events(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_objective_events_objective
        ON objective_events(objective_id, created_at DESC);
    `);
  }

  // ---- events (append-only; no update/delete methods by design) ----

  private appendEvent(
    type: string,
    objectiveId: string,
    payload: Record<string, unknown> | null
  ): void {
    this.db
      .prepare(
        `INSERT INTO objective_events (id, objective_id, type, payload, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(generateId(), objectiveId, type, payload ? JSON.stringify(payload) : null, Date.now());
  }

  /**
   * The one sanctioned external entry point for appending an event — used
   * by the command-center's broadcast() to record agent lifecycle events
   * (task_started, waiting_approval, etc.) against whichever objective a
   * task is tagged to. Named distinctly from the private appendEvent() so
   * it's grep-obvious as the intentional exception to "events are only
   * ever written by this store's own mutating methods."
   */
  async recordAgentEvent(
    type: string,
    objectiveId: string,
    payload: Record<string, unknown> | null
  ): Promise<void> {
    this.appendEvent(type, objectiveId, payload);
  }

  async listEvents(options?: { objectiveId?: string; limit?: number }): Promise<ObjectiveEvent[]> {
    const limit = options?.limit ?? 100;
    const rows = options?.objectiveId
      ? (this.db
          .prepare(
            `SELECT * FROM objective_events WHERE objective_id = ?
             ORDER BY created_at DESC LIMIT ?`
          )
          .all(options.objectiveId, limit) as EventRow[])
      : (this.db
          .prepare(`SELECT * FROM objective_events ORDER BY created_at DESC LIMIT ?`)
          .all(limit) as EventRow[]);
    return rows.map((r) => ({
      id: r.id,
      objectiveId: r.objective_id,
      type: r.type,
      payload: r.payload ? (JSON.parse(r.payload) as Record<string, unknown>) : null,
      createdAt: r.created_at,
    }));
  }

  // ---- objectives ----

  async createObjective(data: {
    title: string;
    description?: string;
    status?: ObjectiveStatus;
  }): Promise<string> {
    const status = data.status ?? 'active';
    const id = generateId();
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO objectives (id, title, description, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, data.title, data.description ?? null, status, now, now);
    this.appendEvent('objective.created', id, { title: data.title, status });
    return id;
  }

  async getObjective(id: string): Promise<Objective | null> {
    const r = this.db.prepare(`SELECT * FROM objectives WHERE id = ?`).get(id) as
      | ObjectiveRow
      | undefined;
    return r ? this.rowToObjective(r) : null;
  }

  async listObjectives(options?: { status?: ObjectiveStatus }): Promise<Objective[]> {
    const rows = options?.status
      ? (this.db
          .prepare(`SELECT * FROM objectives WHERE status = ? ORDER BY updated_at DESC`)
          .all(options.status) as ObjectiveRow[])
      : (this.db
          .prepare(`SELECT * FROM objectives ORDER BY updated_at DESC`)
          .all() as ObjectiveRow[]);
    return rows.map((r) => this.rowToObjective(r));
  }

  /** Unconstrained — any status to any other. Unlike Portfolio's project lanes,
   * an objective has no legal-transition matrix to enforce. */
  async transition(id: string, to: ObjectiveStatus): Promise<void> {
    const objective = await this.getObjective(id);
    if (!objective) throw new Error(`Objective not found: ${id}`);
    const from = objective.status;
    this.db
      .prepare(`UPDATE objectives SET status = ?, updated_at = ? WHERE id = ?`)
      .run(to, Date.now(), id);
    this.appendEvent('objective.transitioned', id, { from, to });
  }

  /** Title/description edits only — no event, mirrors Portfolio's updateMetadata(). */
  async updateObjective(
    id: string,
    data: { title?: string; description?: string }
  ): Promise<Objective> {
    const objective = await this.getObjective(id);
    if (!objective) throw new Error(`Objective not found: ${id}`);
    this.db
      .prepare(`UPDATE objectives SET title = ?, description = ?, updated_at = ? WHERE id = ?`)
      .run(
        data.title ?? objective.title,
        data.description ?? objective.description,
        Date.now(),
        id
      );
    return (await this.getObjective(id))!;
  }

  private rowToObjective(r: ObjectiveRow): Objective {
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  close(): void {
    this.db.close();
  }
}
