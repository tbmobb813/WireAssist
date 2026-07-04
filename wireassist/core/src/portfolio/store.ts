// Portfolio command-center data layer: projects, append-only events, weekly focus.
// Conventions match storage/*: better-sqlite3, class-per-store, hex ids, epoch-ms timestamps.
import Database from 'better-sqlite3';
import { randomBytes } from 'crypto';

function generateId(): string {
  return randomBytes(16).toString('hex');
}

export type ProjectStatus = 'active' | 'paused' | 'icebox' | 'done';
export type ProjectLane = 'product' | 'career' | 'client' | 'personal';

export interface Project {
  id: string;
  name: string;
  lane: ProjectLane;
  status: ProjectStatus;
  resumeNote: string | null;
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, unknown> | null;
}

export interface PortfolioEvent {
  id: string;
  projectId: string | null;
  type: string; // e.g. 'project.created', 'project.transitioned', 'focus.set', 'task.done'
  payload: Record<string, unknown> | null;
  createdAt: number;
}

export interface WeeklyFocus {
  isoWeek: string; // e.g. '2026-W27'
  productProjectId: string;
  careerMilestone: string;
  createdAt: number;
}

/** Max simultaneously-active projects. The WIP limit is enforced here, not in the UI. */
export const ACTIVE_WIP_LIMIT = 2;

const LEGAL_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  active: ['paused', 'icebox', 'done'],
  paused: ['active', 'icebox', 'done'],
  icebox: ['paused', 'active'],
  done: [],
};

export class WipLimitError extends Error {
  constructor(limit: number) {
    super(`Active WIP limit (${limit}) reached. Pause a project before activating another.`);
    this.name = 'WipLimitError';
  }
}

export class IllegalTransitionError extends Error {
  constructor(from: ProjectStatus, to: ProjectStatus) {
    super(`Illegal transition: ${from} -> ${to}`);
    this.name = 'IllegalTransitionError';
  }
}

export function currentIsoWeek(date: Date = new Date()): string {
  // ISO-8601 week number (weeks start Monday; week 1 contains the first Thursday).
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

interface ProjectRow {
  id: string;
  name: string;
  lane: ProjectLane;
  status: ProjectStatus;
  resume_note: string | null;
  created_at: number;
  updated_at: number;
  metadata: string | null;
}

interface EventRow {
  id: string;
  project_id: string | null;
  type: string;
  payload: string | null;
  created_at: number;
}

interface WeeklyFocusRow {
  iso_week: string;
  product_project_id: string;
  career_milestone: string;
  created_at: number;
}

export class PortfolioStore {
  private db: Database.Database;

  constructor(storagePath: string = './data/aia.db') {
    this.db = new Database(storagePath);
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        lane TEXT NOT NULL,
        status TEXT NOT NULL,
        resume_note TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        metadata TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

      CREATE TABLE IF NOT EXISTS portfolio_events (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        type TEXT NOT NULL,
        payload TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_portfolio_events_created
        ON portfolio_events(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_portfolio_events_project
        ON portfolio_events(project_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS weekly_focus (
        iso_week TEXT PRIMARY KEY,
        product_project_id TEXT NOT NULL,
        career_milestone TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (product_project_id) REFERENCES projects(id)
      );
    `);
  }

  // ---- events (append-only; no update/delete methods by design) ----

  private appendEvent(
    type: string,
    projectId: string | null,
    payload: Record<string, unknown> | null
  ): void {
    this.db
      .prepare(
        `INSERT INTO portfolio_events (id, project_id, type, payload, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(generateId(), projectId, type, payload ? JSON.stringify(payload) : null, Date.now());
  }

  async listEvents(options?: { projectId?: string; limit?: number }): Promise<PortfolioEvent[]> {
    const limit = options?.limit ?? 100;
    const rows = options?.projectId
      ? (this.db
          .prepare(
            `SELECT * FROM portfolio_events WHERE project_id = ?
             ORDER BY created_at DESC LIMIT ?`
          )
          .all(options.projectId, limit) as EventRow[])
      : (this.db
          .prepare(`SELECT * FROM portfolio_events ORDER BY created_at DESC LIMIT ?`)
          .all(limit) as EventRow[]);
    return rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      type: r.type,
      payload: r.payload ? (JSON.parse(r.payload) as Record<string, unknown>) : null,
      createdAt: r.created_at,
    }));
  }

  // ---- projects ----

  async createProject(data: {
    name: string;
    lane: ProjectLane;
    status?: ProjectStatus;
    resumeNote?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const status = data.status ?? 'paused';
    if (status === 'active') this.assertWipCapacity();
    const id = generateId();
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO projects (id, name, lane, status, resume_note, created_at, updated_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        data.name,
        data.lane,
        status,
        data.resumeNote ?? null,
        now,
        now,
        data.metadata ? JSON.stringify(data.metadata) : null
      );
    this.appendEvent('project.created', id, { name: data.name, lane: data.lane, status });
    return id;
  }

  async getProject(id: string): Promise<Project | null> {
    const r = this.db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as
      | ProjectRow
      | undefined;
    return r ? this.rowToProject(r) : null;
  }

  async listProjects(options?: { status?: ProjectStatus }): Promise<Project[]> {
    const rows = options?.status
      ? (this.db
          .prepare(`SELECT * FROM projects WHERE status = ? ORDER BY updated_at DESC`)
          .all(options.status) as ProjectRow[])
      : (this.db.prepare(`SELECT * FROM projects ORDER BY updated_at DESC`).all() as ProjectRow[]);
    return rows.map((r) => this.rowToProject(r));
  }

  /** State machine. Throws IllegalTransitionError / WipLimitError. */
  async transition(id: string, to: ProjectStatus, resumeNote?: string): Promise<void> {
    const project = await this.getProject(id);
    if (!project) throw new Error(`Project not found: ${id}`);
    const from = project.status;
    if (!LEGAL_TRANSITIONS[from].includes(to)) throw new IllegalTransitionError(from, to);
    if (to === 'active') this.assertWipCapacity();
    this.db
      .prepare(`UPDATE projects SET status = ?, resume_note = ?, updated_at = ? WHERE id = ?`)
      .run(to, resumeNote ?? project.resumeNote, Date.now(), id);
    this.appendEvent('project.transitioned', id, { from, to });
  }

  private assertWipCapacity(): void {
    const row = this.db
      .prepare(`SELECT COUNT(*) AS n FROM projects WHERE status = 'active'`)
      .get() as { n: number };
    if (row.n >= ACTIVE_WIP_LIMIT) throw new WipLimitError(ACTIVE_WIP_LIMIT);
  }

  // ---- weekly focus (the Sunday forcing function) ----

  async setWeeklyFocus(data: {
    productProjectId: string;
    careerMilestone: string;
    isoWeek?: string;
  }): Promise<WeeklyFocus> {
    const isoWeek = data.isoWeek ?? currentIsoWeek();
    const project = await this.getProject(data.productProjectId);
    if (!project) throw new Error(`Project not found: ${data.productProjectId}`);
    if (project.status !== 'active') {
      throw new Error(`Weekly focus must reference an active project (got '${project.status}')`);
    }
    const createdAt = Date.now();
    this.db
      .prepare(
        `INSERT INTO weekly_focus (iso_week, product_project_id, career_milestone, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(iso_week) DO UPDATE SET
           product_project_id = excluded.product_project_id,
           career_milestone = excluded.career_milestone`
      )
      .run(isoWeek, data.productProjectId, data.careerMilestone, createdAt);
    this.appendEvent('focus.set', data.productProjectId, {
      isoWeek,
      careerMilestone: data.careerMilestone,
    });
    return {
      isoWeek,
      productProjectId: data.productProjectId,
      careerMilestone: data.careerMilestone,
      createdAt,
    };
  }

  /** Null when the current week's focus is unset — the dashboard gate keys off this. */
  async getWeeklyFocus(isoWeek?: string): Promise<WeeklyFocus | null> {
    const week = isoWeek ?? currentIsoWeek();
    const r = this.db.prepare(`SELECT * FROM weekly_focus WHERE iso_week = ?`).get(week) as
      | WeeklyFocusRow
      | undefined;
    return r
      ? {
          isoWeek: r.iso_week,
          productProjectId: r.product_project_id,
          careerMilestone: r.career_milestone,
          createdAt: r.created_at,
        }
      : null;
  }

  /** Zone 1 payload: this week's focus + active projects, in one call. */
  async today(): Promise<{
    isoWeek: string;
    focus: WeeklyFocus | null;
    active: Project[];
  }> {
    const isoWeek = currentIsoWeek();
    return {
      isoWeek,
      focus: await this.getWeeklyFocus(isoWeek),
      active: await this.listProjects({ status: 'active' }),
    };
  }

  private rowToProject(r: ProjectRow): Project {
    return {
      id: r.id,
      name: r.name,
      lane: r.lane,
      status: r.status,
      resumeNote: r.resume_note,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      metadata: r.metadata ? (JSON.parse(r.metadata) as Record<string, unknown>) : null,
    };
  }

  close(): void {
    this.db.close();
  }
}
