// Settings management
import Database from 'better-sqlite3';

export class SettingsStore {
  private db: Database.Database;

  constructor(storagePath: string = './data/lai.db') {
    this.db = new Database(storagePath);
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  async get<T = any>(key: string, defaultValue?: T): Promise<T | undefined> {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;

    if (!row) {
      return defaultValue;
    }

    try {
      return JSON.parse(row.value);
    } catch {
      return row.value as T;
    }
  }

  async set(key: string, value: any): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    const now = Date.now();

    this.db
      .prepare(
        `INSERT INTO settings (key, value, updated_at) 
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET 
           value = excluded.value,
           updated_at = excluded.updated_at`
      )
      .run(key, serialized, now);
  }

  async delete(key: string): Promise<void> {
    this.db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  }

  async getAll(): Promise<Record<string, any>> {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as any[];

    const result: Record<string, any> = {};
    for (const row of rows) {
      try {
        result[row.key] = JSON.parse(row.value);
      } catch {
        result[row.key] = row.value;
      }
    }

    return result;
  }

  async clear(): Promise<void> {
    this.db.prepare('DELETE FROM settings').run();
  }

  close(): void {
    this.db.close();
  }
}
