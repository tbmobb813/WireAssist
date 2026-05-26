"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsStore = void 0;
// Settings management
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
class SettingsStore {
    constructor(storagePath = './data/lai.db') {
        Object.defineProperty(this, "db", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.db = new better_sqlite3_1.default(storagePath);
        this.initTables();
    }
    initTables() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    }
    async get(key, defaultValue) {
        const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
        if (!row) {
            return defaultValue;
        }
        try {
            return JSON.parse(row.value);
        }
        catch {
            return row.value;
        }
    }
    async set(key, value) {
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);
        const now = Date.now();
        this.db
            .prepare(`INSERT INTO settings (key, value, updated_at) 
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET 
           value = excluded.value,
           updated_at = excluded.updated_at`)
            .run(key, serialized, now);
    }
    async delete(key) {
        this.db.prepare('DELETE FROM settings WHERE key = ?').run(key);
    }
    async getAll() {
        const rows = this.db.prepare('SELECT key, value FROM settings').all();
        const result = {};
        for (const row of rows) {
            try {
                result[row.key] = JSON.parse(row.value);
            }
            catch {
                result[row.key] = row.value;
            }
        }
        return result;
    }
    async clear() {
        this.db.prepare('DELETE FROM settings').run();
    }
    close() {
        this.db.close();
    }
}
exports.SettingsStore = SettingsStore;
