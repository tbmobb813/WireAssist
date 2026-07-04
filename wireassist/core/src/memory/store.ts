import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { AgentRole } from '../agents/types';
import { embed, cosineSimilarity } from './embeddings';

export interface MemoryEntry {
  id: string;
  content: string;
  agentRole: AgentRole;
  tags: string[];
  createdAt: Date;
}

const DIMS = 384;
const SIMILARITY_THRESHOLD = 0.3;

export class MemoryStore {
  private db: Database.Database;
  private queryEmbCache = new Map<string, Float32Array>();

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        agent_role TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        embedding BLOB
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts
        USING fts5(content, agent_role, tags, content='memories', content_rowid='rowid');
      CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(rowid, content, agent_role, tags)
        VALUES (new.rowid, new.content, new.agent_role, new.tags);
      END;
    `);

    // Migrate existing DBs that pre-date the embedding column
    const cols = this.db.prepare('PRAGMA table_info(memories)').all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === 'embedding')) {
      this.db.exec('ALTER TABLE memories ADD COLUMN embedding BLOB');
    }
  }

  /** Synchronous store — embedding is generated fire-and-forget in the background. */
  store(entry: Omit<MemoryEntry, 'id'>): string {
    const id = randomUUID();
    this.db
      .prepare(
        `
      INSERT INTO memories (id, content, agent_role, tags, created_at)
      VALUES (?, ?, ?, ?, ?)
    `
      )
      .run(
        id,
        entry.content,
        entry.agentRole,
        JSON.stringify(entry.tags),
        entry.createdAt.toISOString()
      );

    this.backfillEmbedding(id, entry.content).catch((err) => {
      console.warn(
        '[MemoryStore] Background embedding failed for entry',
        id,
        err instanceof Error ? err.message : err
      );
    });
    return id;
  }

  /** Awaited store — embedding is written before returning. Preferred for onboarding. */
  async storeAsync(entry: Omit<MemoryEntry, 'id'>): Promise<string> {
    const id = randomUUID();
    const vec = await embed(entry.content);

    this.db
      .prepare(
        `
      INSERT INTO memories (id, content, agent_role, tags, created_at, embedding)
      VALUES (?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        id,
        entry.content,
        entry.agentRole,
        JSON.stringify(entry.tags),
        entry.createdAt.toISOString(),
        this.vecToBuffer(vec)
      );

    return id;
  }

  private async backfillEmbedding(id: string, content: string): Promise<void> {
    const vec = await embed(content);
    this.db
      .prepare(`UPDATE memories SET embedding = ? WHERE id = ?`)
      .run(this.vecToBuffer(vec), id);
  }

  listRecent(limit = 50, filters?: { agentRole?: AgentRole }): MemoryEntry[] {
    let sql = `SELECT id, content, agent_role, tags, created_at FROM memories`;
    const params: unknown[] = [];
    if (filters?.agentRole) {
      sql += ` WHERE agent_role = ?`;
      params.push(filters.agentRole);
    }
    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);
    return this.mapRows(this.db.prepare(sql).all(...params) as RawRow[]);
  }

  /**
   * Synchronous search — returns vector results if the query embedding is already cached,
   * otherwise falls back to FTS5 and primes the cache for the next call.
   */
  search(query: string, filters?: { agentRole?: AgentRole }): MemoryEntry[] {
    const cached = this.queryEmbCache.get(query);
    if (cached) return this.vectorSearch(cached, filters);

    // Prime cache for the next call (fire-and-forget)
    embed(query)
      .then((vec) => {
        this.cacheQueryVec(query, vec);
      })
      .catch((err) => {
        console.warn(
          '[MemoryStore] Query embedding cache-prime failed:',
          err instanceof Error ? err.message : err
        );
      });

    return this.ftsSearch(query, filters);
  }

  /** Async search — always uses vector similarity, falls back to FTS5 if no vectors exist yet. */
  async searchAsync(query: string, filters?: { agentRole?: AgentRole }): Promise<MemoryEntry[]> {
    let vec = this.queryEmbCache.get(query);
    if (!vec) {
      vec = await embed(query);
      this.cacheQueryVec(query, vec);
    }

    const results = this.vectorSearch(vec, filters);
    return results.length > 0 ? results : this.ftsSearch(query, filters);
  }

  /** Backfill embeddings for all rows that were stored before the model was available. */
  async upgradeEmbeddings(): Promise<{ upgraded: number; total: number }> {
    const rows = this.db
      .prepare(`SELECT id, content FROM memories WHERE embedding IS NULL`)
      .all() as Array<{ id: string; content: string }>;

    let upgraded = 0;
    for (const row of rows) {
      try {
        await this.backfillEmbedding(row.id, row.content);
        upgraded++;
      } catch {
        // best-effort; move on to the next row
      }
    }

    return { upgraded, total: rows.length };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private vectorSearch(queryVec: Float32Array, filters?: { agentRole?: AgentRole }): MemoryEntry[] {
    let sql = `SELECT id, content, agent_role, tags, created_at, embedding FROM memories WHERE embedding IS NOT NULL`;
    const params: unknown[] = [];

    if (filters?.agentRole) {
      sql += ` AND agent_role = ?`;
      params.push(filters.agentRole);
    }

    const rows = this.db.prepare(sql).all(...params) as RawRowWithEmbedding[];

    const scored = rows
      .map((r) => {
        const vec = this.bufferToVec(r.embedding);
        return { row: r, score: cosineSimilarity(queryVec, vec) };
      })
      .filter((x) => x.score > SIMILARITY_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    return scored.map(({ row: r }) => this.mapRow(r));
  }

  private ftsSearch(query: string, filters?: { agentRole?: AgentRole }): MemoryEntry[] {
    const ftsQuery = this.toFtsQuery(query);
    if (!ftsQuery) return [];

    let sql = `
      SELECT m.id, m.content, m.agent_role, m.tags, m.created_at
      FROM memories m
      JOIN memories_fts fts ON m.rowid = fts.rowid
      WHERE memories_fts MATCH ?
    `;
    const params: unknown[] = [ftsQuery];

    if (filters?.agentRole) {
      sql += ` AND m.agent_role = ?`;
      params.push(filters.agentRole);
    }
    sql += ` ORDER BY rank LIMIT 20`;

    try {
      return this.mapRows(this.db.prepare(sql).all(...params) as RawRow[]);
    } catch {
      return [];
    }
  }

  private toFtsQuery(raw: string): string | null {
    const tokens = raw
      .trim()
      .split(/[^\w]+/)
      .map((t) => t.replace(/"/g, '""'))
      .filter((t) => t.length > 0);
    if (tokens.length === 0) return null;
    return tokens.map((t) => `"${t}"`).join(' ');
  }

  private cacheQueryVec(query: string, vec: Float32Array): void {
    this.queryEmbCache.set(query, vec);
    if (this.queryEmbCache.size > 100) {
      const oldest = this.queryEmbCache.keys().next().value;
      if (oldest) this.queryEmbCache.delete(oldest);
    }
  }

  private vecToBuffer(vec: Float32Array): Buffer {
    return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
  }

  private bufferToVec(buf: Buffer): Float32Array {
    // Ensure clean byteOffset=0 view regardless of how Buffer is sliced
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return new Float32Array(ab, 0, DIMS);
  }

  private mapRow(r: RawRow): MemoryEntry {
    return {
      id: r.id,
      content: r.content,
      agentRole: r.agent_role as AgentRole,
      tags: JSON.parse(r.tags),
      createdAt: new Date(r.created_at),
    };
  }

  private mapRows(rows: RawRow[]): MemoryEntry[] {
    return rows.map((r) => this.mapRow(r));
  }
}

interface RawRow {
  id: string;
  content: string;
  agent_role: string;
  tags: string;
  created_at: string;
}

interface RawRowWithEmbedding extends RawRow {
  embedding: Buffer;
}
