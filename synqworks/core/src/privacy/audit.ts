// Audit logging
import Database from 'better-sqlite3';
import { randomBytes } from 'crypto';
import type { AIRequest, AuditLogOptions } from '../types';

function generateId(): string {
  return randomBytes(16).toString('hex');
}

export class AuditLogger {
  private db: Database.Database;

  constructor(storagePath: string = './data/lai.db') {
    this.db = new Database(storagePath);
    this.initTables();
  }

  private initTables(): void {
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

  async log(request: AIRequest): Promise<void> {
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

  async query(options?: AuditLogOptions): Promise<AIRequest[]> {
    let sql = 'SELECT * FROM audit_log WHERE 1=1';
    const params: any[] = [];

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

    const rows = this.db.prepare(sql).all(...params) as any[];

    return rows.map(row => ({
      prompt: row.prompt,
      provider: row.provider,
      model: row.model,
      timestamp: row.timestamp,
      tokensUsed: row.tokens_used,
      response: row.response,
    }));
  }

  async clear(beforeDate?: number): Promise<void> {
    if (beforeDate) {
      this.db.prepare('DELETE FROM audit_log WHERE timestamp < ?').run(beforeDate);
    } else {
      this.db.prepare('DELETE FROM audit_log').run();
    }
  }

  async getStats(): Promise<{
    totalRequests: number;
    totalTokens: number;
    byProvider: Record<string, number>;
  }> {
    const total = this.db
      .prepare('SELECT COUNT(*) as count, SUM(tokens_used) as tokens FROM audit_log')
      .get() as any;

    const byProvider = this.db
      .prepare(
        `SELECT provider, COUNT(*) as count 
         FROM audit_log 
         GROUP BY provider`
      )
      .all() as any[];

    const providerStats: Record<string, number> = {};
    for (const row of byProvider) {
      providerStats[row.provider] = row.count;
    }

    return {
      totalRequests: total.count || 0,
      totalTokens: total.tokens || 0,
      byProvider: providerStats,
    };
  }

  close(): void {
    this.db.close();
  }
}
