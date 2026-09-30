import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as os from 'os';

export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';
export type Platform = 'twitter' | 'linkedin' | 'instagram' | 'threads' | 'facebook';

// Which specific brand/account this content is for — a real, previously
// missing distinction. "platform" alone (e.g. "instagram") is ambiguous
// once more than one brand has an account on the same platform (confirmed
// live 2026-09-05: a single content-plan batch mixed NixLevel/Etsy,
// micro-SaaS, controller-repair, and MindType.Studio content all tagged
// only "instagram", with no way to tell which was meant for which
// account). A free string, not a strict enum — new ventures/accounts get
// added over time and this shouldn't need a code change to support one.
export type ContentAccount = string;

export interface ScheduledPost {
  id: string;
  content: string;
  platform: Platform;
  account?: ContentAccount;
  scheduledAt: Date;
  status: PostStatus;
  createdAt: Date;
  publishedAt?: Date;
  errorMessage?: string;
  tags: string[];
  campaignId?: string;
  platformPostId?: string;
  objectiveId?: string;
  category?: string;
  contentPillar?: string;
  // Real platform engagement, filled in by the check_post_metrics sweep
  // 24h and 7d after publish — see check-post-metrics.ts (agent-content).
  // Each *CheckedAt timestamp being set (even with every count left
  // undefined, e.g. no platformPostId or the platform call failed) is what
  // stops that window from being re-checked on every future sweep.
  metricsChecked24hAt?: Date;
  metricsChecked7dAt?: Date;
  likesCount?: number;
  viewsCount?: number;
  commentsCount?: number;
  sharesCount?: number;
  // Raw platform-specific fields (e.g. Twitter's impression_count, quote
  // count) that don't map onto the four normalized columns above — kept as
  // an escape hatch rather than adding a column per platform's own metric
  // vocabulary. Also where a fetch failure's error message is recorded.
  engagementRaw?: Record<string, unknown>;
}

export interface ContentIdea {
  id: string;
  topic: string;
  angle: string;
  platform: Platform;
  account?: ContentAccount;
  status: 'idea' | 'approved' | 'written' | 'scheduled';
  createdAt: Date;
  scheduledFor?: Date;
  campaignId?: string;
  category?: string;
  contentPillar?: string;
}

export type CampaignSource = 'manual' | 'gtm';

export interface Campaign {
  id: string;
  name: string;
  source: CampaignSource;
  createdAt: Date;
}

// A reusable, named set of hashtags (a personal library) — plain reference
// data, not something an agent needs to reason about, so it's managed via
// direct CRUD from the command-center UI rather than an agent tool/skill.
// Character count is deliberately not stored: it's derived from
// `hashtags.length` at read time so it can never go stale.
export interface HashtagGroup {
  id: string;
  name: string;
  hashtags: string;
  createdAt: Date;
  characterCount: number;
}

export class TrendPostStorage {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath ?? path.join(os.homedir(), '.wireassist', 'wireassist.db');
    this.db = new Database(resolvedPath, { timeout: 5000 });
    this.init();
    // Every store sharing this file (ApprovalQueue, MemoryStore,
    // ConversationStore, etc.) must agree on journal mode (WAL), set only
    // after init() finishes creating any FTS5 virtual tables/triggers.
    this.db.pragma('journal_mode = WAL');
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

      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'manual',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS hashtag_groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        hashtags TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      -- The scoreboard's single write target — every source (content
      -- engagement, lead signups, and eventually YouTube/WordPress once
      -- their own stats-pulling code exists) writes normalized rows here
      -- instead of the digest skill needing to know how to read N
      -- different source-specific shapes. One row per (date, source,
      -- metric); re-running a day's sync upserts via the unique index
      -- below rather than accumulating duplicates.
      CREATE TABLE IF NOT EXISTS metrics (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        source TEXT NOT NULL,
        metric TEXT NOT NULL,
        value REAL NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_posts_status ON scheduled_posts(status);
      CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON scheduled_posts(scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_posts_platform ON scheduled_posts(platform);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_unique ON metrics(date, source, metric);
      CREATE INDEX IF NOT EXISTS idx_metrics_date ON metrics(date);
    `);

    // content_ideas predates scheduledFor/campaignId — retrofit existing
    // installs with a guarded ALTER TABLE rather than a full migration
    // framework, since these are the only two columns ever added post-launch.
    this.addColumnIfMissing('content_ideas', 'scheduled_for', 'TEXT');
    this.addColumnIfMissing('content_ideas', 'campaign_id', 'TEXT');
    this.addColumnIfMissing('scheduled_posts', 'platform_post_id', 'TEXT');
    this.addColumnIfMissing('scheduled_posts', 'objective_id', 'TEXT');
    this.addColumnIfMissing('scheduled_posts', 'account', 'TEXT');
    this.addColumnIfMissing('content_ideas', 'account', 'TEXT');
    this.addColumnIfMissing('scheduled_posts', 'category', 'TEXT');
    this.addColumnIfMissing('scheduled_posts', 'content_pillar', 'TEXT');
    this.addColumnIfMissing('content_ideas', 'category', 'TEXT');
    this.addColumnIfMissing('content_ideas', 'content_pillar', 'TEXT');
    this.addColumnIfMissing('scheduled_posts', 'metrics_checked_24h_at', 'TEXT');
    this.addColumnIfMissing('scheduled_posts', 'metrics_checked_7d_at', 'TEXT');
    this.addColumnIfMissing('scheduled_posts', 'likes_count', 'INTEGER');
    this.addColumnIfMissing('scheduled_posts', 'views_count', 'INTEGER');
    this.addColumnIfMissing('scheduled_posts', 'comments_count', 'INTEGER');
    this.addColumnIfMissing('scheduled_posts', 'shares_count', 'INTEGER');
    this.addColumnIfMissing('scheduled_posts', 'engagement_raw', 'TEXT');
  }

  private addColumnIfMissing(table: string, column: string, type: string): void {
    const columns = this.db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (columns.some((c) => c.name === column)) return;
    this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }

  // ─── POSTS ────────────────────────────────────────────────────

  createPost(params: {
    content: string;
    platform: Platform;
    account?: ContentAccount;
    scheduledAt: Date;
    tags?: string[];
    campaignId?: string;
    objectiveId?: string;
    category?: string;
    contentPillar?: string;
  }): ScheduledPost {
    const id = randomUUID();
    const now = new Date();

    // Status starts at 'scheduled', not 'draft' — createPost() is only ever
    // reached after schedulePostSkill's approval gate passes, so a post that
    // exists here already is scheduled, not still awaiting that decision.
    this.db
      .prepare(
        `
      INSERT INTO scheduled_posts (id, content, platform, account, scheduled_at, status, created_at, tags, campaign_id, objective_id, category, content_pillar)
      VALUES (?, ?, ?, ?, ?, 'scheduled', ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        id,
        params.content,
        params.platform,
        params.account ?? null,
        params.scheduledAt.toISOString(),
        now.toISOString(),
        JSON.stringify(params.tags ?? []),
        params.campaignId ?? null,
        params.objectiveId ?? null,
        params.category ?? null,
        params.contentPillar ?? null
      );

    return this.getPost(id)!;
  }

  // Category/content-pillar are edit-only fields for now (not exposed on
  // createPost's approval-gated path) — set after the fact from the
  // command-center UI, same as how a spreadsheet cell gets filled in after
  // the row already exists.
  updatePostPlanningFields(
    id: string,
    fields: { category?: string; contentPillar?: string }
  ): void {
    this.db
      .prepare(
        `
      UPDATE scheduled_posts
      SET category = COALESCE(?, category), content_pillar = COALESCE(?, content_pillar)
      WHERE id = ?
    `
      )
      .run(fields.category ?? null, fields.contentPillar ?? null, id);
  }

  getPost(id: string): ScheduledPost | null {
    const row = this.db.prepare('SELECT * FROM scheduled_posts WHERE id = ?').get(id) as
      Record<string, unknown> | undefined;
    return row ? this.mapPost(row) : null;
  }

  listPosts(filters?: {
    status?: PostStatus;
    platform?: Platform;
    account?: ContentAccount;
    from?: Date;
    to?: Date;
  }): ScheduledPost[] {
    let sql = 'SELECT * FROM scheduled_posts WHERE 1=1';
    const params: unknown[] = [];

    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.platform) {
      sql += ' AND platform = ?';
      params.push(filters.platform);
    }
    if (filters?.account) {
      sql += ' AND account = ?';
      params.push(filters.account);
    }
    if (filters?.from) {
      sql += ' AND scheduled_at >= ?';
      params.push(filters.from.toISOString());
    }
    if (filters?.to) {
      sql += ' AND scheduled_at <= ?';
      params.push(filters.to.toISOString());
    }

    sql += ' ORDER BY scheduled_at ASC';
    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map((r) => this.mapPost(r));
  }

  updatePostStatus(
    id: string,
    status: PostStatus,
    errorMessage?: string,
    platformPostId?: string
  ): void {
    // platform_post_id uses COALESCE so a plain status-only call (e.g. the
    // self-report path used by content_mark_published, which never passes
    // this arg) never clobbers an ID recorded by an earlier call.
    this.db
      .prepare(
        `
      UPDATE scheduled_posts
      SET status = ?, published_at = ?, error_message = ?, platform_post_id = COALESCE(?, platform_post_id)
      WHERE id = ?
    `
      )
      .run(
        status,
        status === 'published' ? new Date().toISOString() : null,
        errorMessage ?? null,
        platformPostId ?? null,
        id
      );
  }

  deletePost(id: string): void {
    this.db.prepare('DELETE FROM scheduled_posts WHERE id = ?').run(id);
  }

  // ─── METRICS ──────────────────────────────────────────────────

  // Published posts whose 24h (or 7d) mark has passed but haven't been
  // checked for that window yet. A narrow ±1h/±0.5day tolerance on the
  // lower bound, not an open-ended "anything past the mark," keeps a post
  // that's been sitting unchecked for weeks (e.g. the cron was down) from
  // silently skipping the check just because it's also past the window —
  // it's still eligible, just via the "not yet checked" half of the
  // WHERE clause, independent of how long ago the mark passed.
  listPostsNeedingMetricsCheck(window: '24h' | '7d'): ScheduledPost[] {
    const hoursAgo = window === '24h' ? 24 : 24 * 7;
    const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
    const checkedColumn = window === '24h' ? 'metrics_checked_24h_at' : 'metrics_checked_7d_at';

    const rows = this.db
      .prepare(
        `
      SELECT * FROM scheduled_posts
      WHERE status = 'published'
        AND platform_post_id IS NOT NULL
        AND published_at <= ?
        AND ${checkedColumn} IS NULL
      ORDER BY published_at ASC
    `
      )
      .all(cutoff) as Record<string, unknown>[];
    return rows.map((r) => this.mapPost(r));
  }

  // Always stamps the window's *CheckedAt column, even when every metric
  // value is omitted (platform call failed or returned nothing usable) —
  // that stamp, not the presence of data, is what stops a future sweep
  // from retrying this post/window forever. Metric columns use COALESCE
  // so a 24h check with only `likes` doesn't null out a `views` value a
  // later call might also want to set for the same window.
  recordPostMetrics(
    id: string,
    window: '24h' | '7d',
    metrics: {
      likes?: number;
      views?: number;
      comments?: number;
      shares?: number;
      raw?: Record<string, unknown>;
    }
  ): void {
    const checkedColumn = window === '24h' ? 'metrics_checked_24h_at' : 'metrics_checked_7d_at';
    this.db
      .prepare(
        `
      UPDATE scheduled_posts
      SET ${checkedColumn} = ?,
          likes_count = COALESCE(?, likes_count),
          views_count = COALESCE(?, views_count),
          comments_count = COALESCE(?, comments_count),
          shares_count = COALESCE(?, shares_count),
          engagement_raw = COALESCE(?, engagement_raw)
      WHERE id = ?
    `
      )
      .run(
        new Date().toISOString(),
        metrics.likes ?? null,
        metrics.views ?? null,
        metrics.comments ?? null,
        metrics.shares ?? null,
        metrics.raw ? JSON.stringify(metrics.raw) : null,
        id
      );
  }

  // ─── SCOREBOARD METRICS ───────────────────────────────────────
  // See the `metrics` table's own comment in init() — one normalized store
  // every source writes to, so scoreboardDigestSkill (agent-admin) never
  // needs to know how any individual source's data actually shapes up.

  recordMetric(params: { date: string; source: string; metric: string; value: number }): void {
    this.db
      .prepare(
        `
      INSERT INTO metrics (id, date, source, metric, value, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(date, source, metric) DO UPDATE SET value = excluded.value
    `
      )
      .run(
        randomUUID(),
        params.date,
        params.source,
        params.metric,
        params.value,
        new Date().toISOString()
      );
  }

  listMetrics(filters?: { source?: string; from?: string; to?: string }): {
    date: string;
    source: string;
    metric: string;
    value: number;
  }[] {
    let sql = 'SELECT date, source, metric, value FROM metrics WHERE 1=1';
    const params: unknown[] = [];
    if (filters?.source) {
      sql += ' AND source = ?';
      params.push(filters.source);
    }
    if (filters?.from) {
      sql += ' AND date >= ?';
      params.push(filters.from);
    }
    if (filters?.to) {
      sql += ' AND date <= ?';
      params.push(filters.to);
    }
    sql += ' ORDER BY date ASC';
    return this.db.prepare(sql).all(...params) as {
      date: string;
      source: string;
      metric: string;
      value: number;
    }[];
  }

  // ─── IDEAS ────────────────────────────────────────────────────

  createIdea(params: {
    topic: string;
    angle: string;
    platform: Platform;
    account?: ContentAccount;
    scheduledFor?: Date;
    campaignId?: string;
    category?: string;
    contentPillar?: string;
  }): ContentIdea {
    const id = randomUUID();
    this.db
      .prepare(
        `
      INSERT INTO content_ideas (id, topic, angle, platform, account, status, created_at, scheduled_for, campaign_id, category, content_pillar)
      VALUES (?, ?, ?, ?, ?, 'idea', ?, ?, ?, ?, ?)
    `
      )
      .run(
        id,
        params.topic,
        params.angle,
        params.platform,
        params.account ?? null,
        new Date().toISOString(),
        params.scheduledFor?.toISOString() ?? null,
        params.campaignId ?? null,
        params.category ?? null,
        params.contentPillar ?? null
      );

    const row = this.db.prepare('SELECT * FROM content_ideas WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    return this.mapIdea(row);
  }

  listIdeas(status?: string): ContentIdea[] {
    const sql = status
      ? 'SELECT * FROM content_ideas WHERE status = ? ORDER BY created_at DESC, rowid DESC'
      : 'SELECT * FROM content_ideas ORDER BY created_at DESC, rowid DESC';
    const rows = this.db.prepare(sql).all(...(status ? [status] : [])) as Record<string, unknown>[];
    return rows.map((r) => this.mapIdea(r));
  }

  // Same edit-after-creation shape as updatePostPlanningFields — an idea's
  // category/pillar gets filled in from the UI, not at generation time.
  updateIdeaPlanningFields(
    id: string,
    fields: { category?: string; contentPillar?: string }
  ): void {
    this.db
      .prepare(
        `
      UPDATE content_ideas
      SET category = COALESCE(?, category), content_pillar = COALESCE(?, content_pillar)
      WHERE id = ?
    `
      )
      .run(fields.category ?? null, fields.contentPillar ?? null, id);
  }

  // Distinct, previously-used values across both tables — this is what
  // lets the UI offer an autocomplete/dropdown for category and content
  // pillar without either being a hardcoded enum anywhere in the codebase.
  listCategories(): string[] {
    return this.listDistinctPlanningValues('category');
  }

  listContentPillars(): string[] {
    return this.listDistinctPlanningValues('content_pillar');
  }

  private listDistinctPlanningValues(column: 'category' | 'content_pillar'): string[] {
    const rows = this.db
      .prepare(
        `
      SELECT ${column} AS value FROM scheduled_posts WHERE ${column} IS NOT NULL AND ${column} != ''
      UNION
      SELECT ${column} AS value FROM content_ideas WHERE ${column} IS NOT NULL AND ${column} != ''
      ORDER BY value ASC
    `
      )
      .all() as { value: string }[];
    return rows.map((r) => r.value);
  }

  // ─── HASHTAG GROUPS ───────────────────────────────────────────
  // Plain reference-data CRUD — deliberately not agent-mediated (see the
  // HashtagGroup interface comment above).

  createHashtagGroup(params: { name: string; hashtags: string }): HashtagGroup {
    const id = randomUUID();
    const now = new Date();
    this.db
      .prepare('INSERT INTO hashtag_groups (id, name, hashtags, created_at) VALUES (?, ?, ?, ?)')
      .run(id, params.name, params.hashtags, now.toISOString());
    return {
      id,
      name: params.name,
      hashtags: params.hashtags,
      createdAt: now,
      characterCount: params.hashtags.length,
    };
  }

  listHashtagGroups(): HashtagGroup[] {
    const rows = this.db.prepare('SELECT * FROM hashtag_groups ORDER BY name ASC').all() as Record<
      string,
      unknown
    >[];
    return rows.map((r) => this.mapHashtagGroup(r));
  }

  updateHashtagGroup(
    id: string,
    fields: { name?: string; hashtags?: string }
  ): HashtagGroup | null {
    this.db
      .prepare(
        'UPDATE hashtag_groups SET name = COALESCE(?, name), hashtags = COALESCE(?, hashtags) WHERE id = ?'
      )
      .run(fields.name ?? null, fields.hashtags ?? null, id);
    const row = this.db.prepare('SELECT * FROM hashtag_groups WHERE id = ?').get(id) as
      Record<string, unknown> | undefined;
    return row ? this.mapHashtagGroup(row) : null;
  }

  deleteHashtagGroup(id: string): void {
    this.db.prepare('DELETE FROM hashtag_groups WHERE id = ?').run(id);
  }

  private mapHashtagGroup(r: Record<string, unknown>): HashtagGroup {
    const hashtags = r.hashtags as string;
    return {
      id: r.id as string,
      name: r.name as string,
      hashtags,
      createdAt: new Date(r.created_at as string),
      characterCount: hashtags.length,
    };
  }

  // ─── CAMPAIGNS ────────────────────────────────────────────────

  createCampaign(params: { name: string; source: CampaignSource }): Campaign {
    const id = randomUUID();
    const now = new Date();
    this.db
      .prepare(
        `
      INSERT INTO campaigns (id, name, source, created_at)
      VALUES (?, ?, ?, ?)
    `
      )
      .run(id, params.name, params.source, now.toISOString());

    return { id, name: params.name, source: params.source, createdAt: now };
  }

  listCampaigns(): Campaign[] {
    const rows = this.db
      .prepare('SELECT * FROM campaigns ORDER BY created_at DESC, rowid DESC')
      .all() as Record<string, unknown>[];
    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      source: r.source as CampaignSource,
      createdAt: new Date(r.created_at as string),
    }));
  }

  private mapPost(r: Record<string, unknown>): ScheduledPost {
    return {
      id: r.id as string,
      content: r.content as string,
      platform: r.platform as Platform,
      account: (r.account as string | null) ?? undefined,
      scheduledAt: new Date(r.scheduled_at as string),
      status: r.status as PostStatus,
      createdAt: new Date(r.created_at as string),
      publishedAt: r.published_at ? new Date(r.published_at as string) : undefined,
      errorMessage: (r.error_message as string | null) ?? undefined,
      tags: JSON.parse(r.tags as string),
      campaignId: (r.campaign_id as string | null) ?? undefined,
      platformPostId: (r.platform_post_id as string | null) ?? undefined,
      objectiveId: (r.objective_id as string | null) ?? undefined,
      category: (r.category as string | null) ?? undefined,
      contentPillar: (r.content_pillar as string | null) ?? undefined,
      metricsChecked24hAt: r.metrics_checked_24h_at
        ? new Date(r.metrics_checked_24h_at as string)
        : undefined,
      metricsChecked7dAt: r.metrics_checked_7d_at
        ? new Date(r.metrics_checked_7d_at as string)
        : undefined,
      likesCount: (r.likes_count as number | null) ?? undefined,
      viewsCount: (r.views_count as number | null) ?? undefined,
      commentsCount: (r.comments_count as number | null) ?? undefined,
      sharesCount: (r.shares_count as number | null) ?? undefined,
      engagementRaw: r.engagement_raw ? JSON.parse(r.engagement_raw as string) : undefined,
    };
  }

  private mapIdea(r: Record<string, unknown>): ContentIdea {
    return {
      id: r.id as string,
      topic: r.topic as string,
      angle: r.angle as string,
      platform: r.platform as Platform,
      account: (r.account as string | null) ?? undefined,
      status: r.status as ContentIdea['status'],
      createdAt: new Date(r.created_at as string),
      scheduledFor: r.scheduled_for ? new Date(r.scheduled_for as string) : undefined,
      campaignId: (r.campaign_id as string | null) ?? undefined,
      category: (r.category as string | null) ?? undefined,
      contentPillar: (r.content_pillar as string | null) ?? undefined,
    };
  }
}
