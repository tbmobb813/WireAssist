'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.ConversationStore = void 0;
// Conversation CRUD
const better_sqlite3_1 = __importDefault(require('better-sqlite3'));
const crypto_1 = require('crypto');
function generateId() {
  return (0, crypto_1.randomBytes)(16).toString('hex');
}
class ConversationStore {
  constructor(storagePath = './data/lai.db') {
    Object.defineProperty(this, 'db', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    this.db = new better_sqlite3_1.default(storagePath);
    this.initTables();
  }
  initTables() {
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
  async create(data) {
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
  async get(id) {
    try {
      const row = this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
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
  async update(id, data) {
    try {
      const updates = [];
      const values = [];
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
  async delete(id) {
    try {
      this.db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
    } catch (error) {
      throw new Error(
        `Failed to delete conversation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  async list(options) {
    try {
      const limit = options?.limit || 50;
      const offset = options?.offset || 0;
      const rows = this.db
        .prepare(
          `SELECT * FROM conversations 
           ORDER BY updated_at DESC 
           LIMIT ? OFFSET ?`
        )
        .all(limit, offset);
      return rows.map((row) => ({
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
  async search(query) {
    try {
      const rows = this.db
        .prepare(
          `SELECT c.* FROM conversations c
           JOIN conversations_fts fts ON c.id = fts.id
           WHERE conversations_fts MATCH ?
           ORDER BY rank`
        )
        .all(query);
      return rows.map((row) => ({
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
  close() {
    this.db.close();
  }
}
exports.ConversationStore = ConversationStore;
