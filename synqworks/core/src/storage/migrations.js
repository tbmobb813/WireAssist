"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
// Database migrations
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const migrations = [
    {
        version: 1,
        name: 'initial_schema',
        up: db => {
            db.exec(`
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          provider TEXT NOT NULL,
          model TEXT NOT NULL,
          metadata TEXT
        );

        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          tokens_used INTEGER,
          context TEXT,
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS audit_log (
          id TEXT PRIMARY KEY,
          prompt TEXT NOT NULL,
          provider TEXT NOT NULL,
          model TEXT,
          timestamp INTEGER NOT NULL,
          tokens_used INTEGER,
          response TEXT
        );
      `);
        },
    },
    {
        version: 2,
        name: 'add_fts_indexes',
        up: db => {
            db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS conversations_fts 
          USING fts5(id, title, content='conversations', content_rowid='rowid');

        CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts 
          USING fts5(id, content, content='messages', content_rowid='rowid');
      `);
        },
    },
];
function runMigrations(storagePath) {
    const db = new better_sqlite3_1.default(storagePath);
    // Create migrations table
    db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);
    // Get current version
    const currentVersion = db.prepare('SELECT MAX(version) as version FROM migrations').get();
    const version = currentVersion?.version || 0;
    // Run pending migrations
    for (const migration of migrations) {
        if (migration.version > version) {
            console.log(`Running migration: ${migration.name}`);
            try {
                migration.up(db);
                db.prepare('INSERT INTO migrations (version, name, applied_at) VALUES (?, ?, ?)').run(migration.version, migration.name, Date.now());
                console.log(`Migration ${migration.name} completed`);
            }
            catch (error) {
                console.error(`Migration ${migration.name} failed:`, error);
                throw error;
            }
        }
    }
    db.close();
}
