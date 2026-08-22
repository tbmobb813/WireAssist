'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.AuditLogger = void 0;
// Audit logging
const better_sqlite3_1 = __importDefault(require('better-sqlite3'));
const crypto_1 = require('crypto');
function generateId() {
  return (0, crypto_1.randomBytes)(16).toString('hex');
}
class AuditLogger {
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
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        prompt TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT,
        timestamp INTEGER NOT NULL,
        tokens_used INTEGER,
        response TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_audit_timestamp 
        ON audit_log(timestamp DESC);
      
      CREATE INDEX IF NOT EXISTS idx_audit_provider 
        ON audit_log(provider);
    `);
  }
  async log(request) {
    const id = generateId();
    this.db
      .prepare(
        `INSERT INTO audit_log (id, prompt, provider, model, timestamp, tokens_used, response)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        request.prompt,
        request.provider,
        request.model || null,
        request.timestamp,
        request.tokensUsed || null,
        request.response || null
      );
  }
  async query(options) {
    let sql = 'SELECT * FROM audit_log WHERE 1=1';
    const params = [];
    if (options?.startDate) {
      sql += ' AND timestamp >= ?';
      params.push(options.startDate);
    }
    if (options?.endDate) {
      sql += ' AND timestamp <= ?';
      params.push(options.endDate);
    }
    if (options?.provider) {
      sql += ' AND provider = ?';
      params.push(options.provider);
    }
    sql += ' ORDER BY timestamp DESC';
    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }
    const rows = this.db.prepare(sql).all(...params);
    return rows.map((row) => ({
      prompt: row.prompt,
      provider: row.provider,
      model: row.model,
      timestamp: row.timestamp,
      tokensUsed: row.tokens_used,
      response: row.response,
    }));
  }
  async clear(beforeDate) {
    if (beforeDate) {
      this.db.prepare('DELETE FROM audit_log WHERE timestamp < ?').run(beforeDate);
    } else {
      this.db.prepare('DELETE FROM audit_log').run();
    }
  }
  async getStats() {
    const total = this.db
      .prepare('SELECT COUNT(*) as count, SUM(tokens_used) as tokens FROM audit_log')
      .get();
    const byProvider = this.db
      .prepare(
        `SELECT provider, COUNT(*) as count 
         FROM audit_log 
         GROUP BY provider`
      )
      .all();
    const providerStats = {};
    for (const row of byProvider) {
      providerStats[row.provider] = row.count;
    }
    return {
      totalRequests: total.count || 0,
      totalTokens: total.tokens || 0,
      byProvider: providerStats,
    };
  }
  close() {
    this.db.close();
  }
}
exports.AuditLogger = AuditLogger;
