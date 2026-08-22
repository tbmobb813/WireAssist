'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.MemoryStore = void 0;
const better_sqlite3_1 = __importDefault(require('better-sqlite3'));
const crypto_1 = require('crypto');
class MemoryStore {
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
  store(entry) {
    const id = (0, crypto_1.randomUUID)();
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
    return id;
  }
  search(query, filters) {
    let sql = `
      SELECT m.* FROM memories m
      JOIN memories_fts fts ON m.rowid = fts.rowid
      WHERE memories_fts MATCH ?
    `;
    const params = [query];
    if (filters?.agentRole) {
      sql += ` AND m.agent_role = ?`;
      params.push(filters.agentRole);
    }
    sql += ` ORDER BY rank LIMIT 20`;
    const rows = this.db.prepare(sql).all(...params);
    return rows.map((r) => ({
      id: r.id,
      content: r.content,
      agentRole: r.agent_role,
      tags: JSON.parse(r.tags),
      createdAt: new Date(r.created_at),
    }));
  }
}
exports.MemoryStore = MemoryStore;
