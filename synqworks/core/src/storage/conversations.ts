// Conversation CRUD
import Database from 'better-sqlite3';
import type { Conversation } from '../types';
import { randomBytes } from 'crypto';

function generateId(): string {
  return randomBytes(16).toString('hex');
}

export class ConversationStore {
  private db: Database.Database;

  constructor(storagePath: string = './data/lai.db') {
    this.db = new Database(storagePath);
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        metadata TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_conversations_updated 
        ON conversations(updated_at DESC);

      CREATE VIRTUAL TABLE IF NOT EXISTS conversations_fts 
        USING fts5(id, title, content='conversations', content_rowid='rowid');

      CREATE TRIGGER IF NOT EXISTS conversations_ai AFTER INSERT ON conversations BEGIN
        INSERT INTO conversations_fts(id, title) VALUES (new.id, new.title);
      END;

      CREATE TRIGGER IF NOT EXISTS conversations_au AFTER UPDATE ON conversations BEGIN
        UPDATE conversations_fts SET title = new.title WHERE id = old.id;
      END;

      CREATE TRIGGER IF NOT EXISTS conversations_ad AFTER DELETE ON conversations BEGIN
        DELETE FROM conversations_fts WHERE id = old.id;
      END;
    `);
  }

  async create(data: {
    title: string;
    provider: string;
    model: string;
    metadata?: Record<string, any>;
  }): Promise<string> {
    try {
      const id = generateId();
      const now = Date.now();

      this.db
        .prepare(
          `INSERT INTO conversations (id, title, created_at, updated_at, provider, model, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          data.title,
          now,
          now,
          data.provider,
          data.model,
          JSON.stringify(data.metadata || {})
        );

      return id;
    } catch (error) {
      throw new Error(
        `Failed to create conversation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async get(id: string): Promise<Conversation> {
    try {
      const row = this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as any;

      if (!row) {
        throw new Error(`Conversation ${id} not found`);
      }

      return {
        id: row.id,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        provider: row.provider,
        model: row.model,
        messages: [], // Messages loaded separately
        metadata: JSON.parse(row.metadata || '{}'),
      };
    } catch (error) {
      throw new Error(
        `Failed to get conversation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async update(
    id: string,
    data: Partial<{ title: string; metadata: Record<string, any> }>
  ): Promise<void> {
    try {
      const updates: string[] = [];
      const values: any[] = [];

      if (data.title !== undefined) {
        updates.push('title = ?');
        values.push(data.title);
      }

      if (data.metadata !== undefined) {
        updates.push('metadata = ?');
        values.push(JSON.stringify(data.metadata));
      }

      updates.push('updated_at = ?');
      values.push(Date.now());

      values.push(id);

      this.db.prepare(`UPDATE conversations SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    } catch (error) {
      throw new Error(
        `Failed to update conversation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async delete(id: string): Promise<void> {
    try {
      this.db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
    } catch (error) {
      throw new Error(
        `Failed to delete conversation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async list(options?: { limit?: number; offset?: number }): Promise<Conversation[]> {
    try {
      const limit = options?.limit || 50;
      const offset = options?.offset || 0;

      const rows = this.db
        .prepare(
          `SELECT * FROM conversations 
           ORDER BY updated_at DESC 
           LIMIT ? OFFSET ?`
        )
        .all(limit, offset) as any[];

      return rows.map(row => ({
        id: row.id,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        provider: row.provider,
        model: row.model,
        messages: [],
        metadata: JSON.parse(row.metadata || '{}'),
      }));
    } catch (error) {
      throw new Error(
        `Failed to list conversations: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async search(query: string): Promise<Conversation[]> {
    try {
      const rows = this.db
        .prepare(
          `SELECT c.* FROM conversations c
           JOIN conversations_fts fts ON c.id = fts.id
           WHERE conversations_fts MATCH ?
           ORDER BY rank`
        )
        .all(query) as any[];

      return rows.map(row => ({
        id: row.id,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        provider: row.provider,
        model: row.model,
        messages: [],
        metadata: JSON.parse(row.metadata || '{}'),
      }));
    } catch (error) {
      throw new Error(
        `Failed to search conversations: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  close(): void {
    this.db.close();
  }
}
