import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';
import Database from 'better-sqlite3';
import { loadWorkflow, parseWorkflowFrontmatter } from './context-loader';

interface StoredSetting {
  value: string;
  updatedAt: string;
}

type StoredWorkflow = Record<string, StoredSetting>;

function getDbPath(): string {
  if (process.env.WIREASSIST_OPS_SETTINGS_FILE) {
    return join(dirname(process.env.WIREASSIST_OPS_SETTINGS_FILE), 'ops-settings-test.db');
  }
  const base = process.env.WIREASSIST_HOME ?? homedir();
  return process.env.DB_PATH ?? join(base, '.wireassist', 'wireassist.db');
}

function jsonFilePath(): string {
  const base = process.env.WIREASSIST_HOME ?? homedir();
  return (
    process.env.WIREASSIST_OPS_SETTINGS_FILE ??
    join(base, '.wireassist', 'ops-workflow-settings.json')
  );
}

function initDb(): Database.Database | null {
  try {
    const dbPath = getDbPath();
    mkdirSync(dirname(dbPath), { recursive: true });
    const db = new Database(dbPath, { timeout: 5000 });
    db.exec(`
      CREATE TABLE IF NOT EXISTS ops_settings (
        workflow TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (workflow, key)
      );
    `);

    // Auto-migrate legacy JSON settings if present
    const legacyPath = jsonFilePath();
    if (existsSync(legacyPath)) {
      try {
        const raw = JSON.parse(readFileSync(legacyPath, 'utf-8'));
        const stmt = db.prepare(
          'INSERT OR REPLACE INTO ops_settings (workflow, key, value, updated_at) VALUES (?, ?, ?, ?)'
        );
        for (const [workflow, settings] of Object.entries(raw)) {
          for (const [label, entry] of Object.entries(settings as Record<string, any>)) {
            const val = typeof entry === 'string' ? entry : entry.value;
            const updated = typeof entry === 'string' ? '' : (entry.updatedAt ?? '');
            stmt.run(workflow, label, val, updated);
          }
        }
      } catch {
        // Ignore legacy migration errors
      }
    }
    return db;
  } catch {
    return null;
  }
}

function readAll(): Record<string, StoredWorkflow> {
  const db = initDb();
  if (db) {
    try {
      const rows = db
        .prepare('SELECT workflow, key, value, updated_at FROM ops_settings')
        .all() as {
        workflow: string;
        key: string;
        value: string;
        updated_at: string;
      }[];
      db.close();

      const result: Record<string, StoredWorkflow> = {};
      for (const row of rows) {
        if (!result[row.workflow]) result[row.workflow] = {};
        result[row.workflow][row.key] = { value: row.value, updatedAt: row.updated_at };
      }
      return result;
    } catch {
      db.close();
    }
  }

  // Fallback to JSON file if SQLite fails or in pure mock environments
  const path = jsonFilePath();
  if (!existsSync(path)) return {};
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as Record<
      string,
      Record<string, string | StoredSetting>
    >;
    const normalized: Record<string, StoredWorkflow> = {};
    for (const [workflow, settings] of Object.entries(raw)) {
      normalized[workflow] = {};
      for (const [label, entry] of Object.entries(settings)) {
        normalized[workflow][label] =
          typeof entry === 'string' ? { value: entry, updatedAt: '' } : entry;
      }
    }
    return normalized;
  } catch {
    return {};
  }
}

export function getWorkflowSettings(workflow: string): Record<string, string> {
  const stored = readAll()[workflow] ?? {};
  const values: Record<string, string> = {};
  for (const [label, entry] of Object.entries(stored)) values[label] = entry.value;
  return values;
}

export function getWorkflowSettingsMeta(workflow: string): Record<string, { updatedAt: string }> {
  const stored = readAll()[workflow] ?? {};
  const meta: Record<string, { updatedAt: string }> = {};
  for (const [label, entry] of Object.entries(stored)) meta[label] = { updatedAt: entry.updatedAt };
  return meta;
}

export function setWorkflowSettings(workflow: string, values: Record<string, string>): void {
  const updatedAt = new Date().toISOString();
  const db = initDb();
  if (db) {
    try {
      const stmt = db.prepare(
        'INSERT OR REPLACE INTO ops_settings (workflow, key, value, updated_at) VALUES (?, ?, ?, ?)'
      );
      const transaction = db.transaction(() => {
        for (const [label, value] of Object.entries(values)) {
          stmt.run(workflow, label, value, updatedAt);
        }
      });
      transaction();
      db.close();
    } catch {
      db.close();
    }
  }

  // Also sync JSON fallback file for compatibility
  const all = readAll();
  const existing = all[workflow] ?? {};
  const merged: StoredWorkflow = { ...existing };
  for (const [label, value] of Object.entries(values)) {
    merged[label] = { value, updatedAt };
  }
  all[workflow] = merged;
  const path = jsonFilePath();
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(all, null, 2));
  } catch {
    // Ignore JSON fallback write errors
  }
}

// Parses a workflow for both Frontmatter input schemas AND legacy `_SETTING:_` labels.
export function getWorkflowSettingLabels(workflow: string): { label: string; periodic: boolean }[] {
  let markdown: string;
  try {
    markdown = loadWorkflow(workflow);
  } catch {
    return [];
  }

  const { frontmatter, body } = parseWorkflowFrontmatter(markdown);
  const labels: { label: string; periodic: boolean }[] = [];
  const seen = new Set<string>();

  // Extract from Frontmatter inputs if present
  if (frontmatter?.inputs) {
    for (const [name, spec] of Object.entries(frontmatter.inputs)) {
      seen.add(name);
      labels.push({ label: name, periodic: Boolean(spec.periodic) });
    }
  }

  // Extract legacy `_SETTING:_` / `_SETTING_PERIODIC:_` placeholders
  const re = /^-\s*(.+?):\s*_SETTING(_PERIODIC)?:\s*.+?_\s*$/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    const label = match[1].trim();
    if (!seen.has(label)) {
      seen.add(label);
      labels.push({ label, periodic: Boolean(match[2]) });
    }
  }
  return labels;
}

export function applyWorkflowSettings(markdown: string, workflow: string): string {
  const values = getWorkflowSettings(workflow);
  const { frontmatter, body } = parseWorkflowFrontmatter(markdown);

  let content = body;

  // Substitute values for legacy placeholders
  for (const [label, value] of Object.entries(values)) {
    if (!value) continue;
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^(-\\s*${escapedLabel}:)\\s*_SETTING(?:_PERIODIC)?:\\s*.+?_\\s*$`, 'm');
    content = content.replace(re, `$1 ${value}`);
  }

  // If frontmatter defines inputs, append structured context block for prompt clarity
  if (frontmatter?.inputs) {
    const filledContext: string[] = [];
    for (const [name, spec] of Object.entries(frontmatter.inputs)) {
      const val = values[name];
      if (val) {
        filledContext.push(`- **${name}** (${spec.description}): ${val}`);
      }
    }
    if (filledContext.length > 0) {
      content = `## Configured Workflow Inputs\n${filledContext.join('\n')}\n\n${content}`;
    }
  }

  return content;
}
