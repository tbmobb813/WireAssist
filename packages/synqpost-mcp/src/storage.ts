import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as os from 'os';

export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';
export type Platform = 'twitter' | 'linkedin' | 'instagram' | 'threads';

export interface ScheduledPost {
  id: string;
  content: string;
  platform: Platform;
  scheduledAt: Date;
  status: PostStatus;
  createdAt: Date;
  publishedAt?: Date;
  errorMessage?: string;
  tags: string[];
  campaignId?: string;
}

export interface ContentIdea {
  id: string;
  topic: string;
  angle: string;
  platform: Platform;
  status: 'idea' | 'approved' | 'written' | 'scheduled';
  createdAt: Date;
}

export class SynqPostStorage {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath ?? path.join(os.homedir(), '.synqworks', 'synqworks.db');
    this.db = new Database(resolvedPath);
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scheduled_posts (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        platform TEXT NOT NULL,
        scheduled_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL,
        published_at TEXT,
        error_message TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        campaign_id TEXT
      );

      CREATE TABLE IF NOT EXISTS content_ideas (
        id TEXT PRIMARY KEY,
        topic TEXT NOT NULL,
        angle TEXT NOT NULL,
        platform TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'idea',
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_posts_status ON scheduled_posts(status);
      CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON scheduled_posts(scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_posts_platform ON scheduled_posts(platform);
    `);
  }

  // ─── POSTS ────────────────────────────────────────────────────

  createPost(params: {
    content: string;
    platform: Platform;
    scheduledAt: Date;
    tags?: string[];
    campaignId?: string;
  }): ScheduledPost {
    const id = randomUUID();
    const now = new Date();

    this.db.prepare(`
      INSERT INTO scheduled_posts (id, content, platform, scheduled_at, status, created_at, tags, campaign_id)
      VALUES (?, ?, ?, ?, 'draft', ?, ?, ?)
    `).run(
      id,
      params.content,
      params.platform,
      params.scheduledAt.toISOString(),
      now.toISOString(),
      JSON.stringify(params.tags ?? []),
      params.campaignId ?? null,
    );

    return this.getPost(id)!;
  }

  getPost(id: string): ScheduledPost | null {
    const row = this.db.prepare('SELECT * FROM scheduled_posts WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.mapPost(row) : null;
  }

  listPosts(filters?: {
    status?: PostStatus;
    platform?: Platform;
    from?: Date;
    to?: Date;
  }): ScheduledPost[] {
    let sql = 'SELECT * FROM scheduled_posts WHERE 1=1';
    const params: unknown[] = [];

    if (filters?.status) { sql += ' AND status = ?'; params.push(filters.status); }
    if (filters?.platform) { sql += ' AND platform = ?'; params.push(filters.platform); }
    if (filters?.from) { sql += ' AND scheduled_at >= ?'; params.push(filters.from.toISOString()); }
    if (filters?.to) { sql += ' AND scheduled_at <= ?'; params.push(filters.to.toISOString()); }

    sql += ' ORDER BY scheduled_at ASC';
    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map(r => this.mapPost(r));
  }

  updatePostStatus(id: string, status: PostStatus, errorMessage?: string): void {
    this.db.prepare(`
      UPDATE scheduled_posts
      SET status = ?, published_at = ?, error_message = ?
      WHERE id = ?
    `).run(
      status,
      status === 'published' ? new Date().toISOString() : null,
      errorMessage ?? null,
      id,
    );
  }

  deletePost(id: string): void {
    this.db.prepare('DELETE FROM scheduled_posts WHERE id = ?').run(id);
  }

  // ─── IDEAS ────────────────────────────────────────────────────

  createIdea(params: { topic: string; angle: string; platform: Platform }): ContentIdea {
    const id = randomUUID();
    this.db.prepare(`
      INSERT INTO content_ideas (id, topic, angle, platform, status, created_at)
      VALUES (?, ?, ?, ?, 'idea', ?)
    `).run(id, params.topic, params.angle, params.platform, new Date().toISOString());

    const row = this.db.prepare('SELECT * FROM content_ideas WHERE id = ?').get(id) as Record<string, unknown>;
    return this.mapIdea(row);
  }

  listIdeas(status?: string): ContentIdea[] {
    const sql = status
      ? 'SELECT * FROM content_ideas WHERE status = ? ORDER BY created_at DESC'
      : 'SELECT * FROM content_ideas ORDER BY created_at DESC';
    const rows = this.db.prepare(sql).all(...(status ? [status] : [])) as Record<string, unknown>[];
    return rows.map(r => this.mapIdea(r));
  }

  private mapPost(r: Record<string, unknown>): ScheduledPost {
    return {
      id: r.id as string,
      content: r.content as string,
      platform: r.platform as Platform,
      scheduledAt: new Date(r.scheduled_at as string),
      status: r.status as PostStatus,
      createdAt: new Date(r.created_at as string),
      publishedAt: r.published_at ? new Date(r.published_at as string) : undefined,
      errorMessage: (r.error_message as string | null) ?? undefined,
      tags: JSON.parse(r.tags as string),
      campaignId: (r.campaign_id as string | null) ?? undefined,
    };
  }

  private mapIdea(r: Record<string, unknown>): ContentIdea {
    return {
      id: r.id as string,
      topic: r.topic as string,
      angle: r.angle as string,
      platform: r.platform as Platform,
      status: r.status as ContentIdea['status'],
      createdAt: new Date(r.created_at as string),
    };
  }
}
