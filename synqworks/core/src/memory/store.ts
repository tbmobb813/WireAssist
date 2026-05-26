import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { AgentRole } from '../agents/types';

export interface MemoryEntry {
  id: string;
  content: string;
  agentRole: AgentRole;
  tags: string[];
  createdAt: Date;
}

export class MemoryStore {
  private db: Database.Database;

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
        created_at TEXT NOT NULL
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts
        USING fts5(content, agent_role, tags, content='memories', content_rowid='rowid');
      CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(rowid, content, agent_role, tags)
        VALUES (new.rowid, new.content, new.agent_role, new.tags);
      END;
    `);
  }

  store(entry: Omit<MemoryEntry, 'id'>): string {
    const id = randomUUID();
    this.db.prepare(`
      INSERT INTO memories (id, content, agent_role, tags, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, entry.content, entry.agentRole, JSON.stringify(entry.tags), entry.createdAt.toISOString());
    return id;
  }

  search(query: string, filters?: { agentRole?: AgentRole }): MemoryEntry[] {
    let sql = `
      SELECT m.* FROM memories m
      JOIN memories_fts fts ON m.rowid = fts.rowid
      WHERE memories_fts MATCH ?
    `;
    const params: unknown[] = [query];

    if (filters?.agentRole) {
      sql += ` AND m.agent_role = ?`;
      params.push(filters.agentRole);
    }

    sql += ` ORDER BY rank LIMIT 20`;
    const rows = this.db.prepare(sql).all(...params) as any[];

    return rows.map(r => ({
      id: r.id,
      content: r.content,
      agentRole: r.agent_role as AgentRole,
      tags: JSON.parse(r.tags),
      createdAt: new Date(r.created_at),
    }));
  }
}
