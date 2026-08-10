import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// SOUL.md hard guardrail: "Log every run to logs/YYYY-MM-DD-<workflow>.md" —
// independent of the approval-gated memory store (which only records
// completed, non-blocked runs). This logs every outcome: blocked, approved,
// auto-approved, or rejected, so there's always a plain-file audit trail.
function logDir(): string {
  const base = process.env.WIREASSIST_HOME ?? homedir();
  return process.env.WIREASSIST_OPS_LOG_DIR ?? join(base, '.wireassist', 'logs', 'ops');
}

export function logRun(workflow: string, outcome: string, body: string): void {
  const dir = logDir();
  mkdirSync(dir, { recursive: true });
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 8);
  const file = join(dir, `${date}-${workflow}.md`);

  const header = existsSync(file) ? '' : `# ${workflow} — ${date}\n`;
  const entry = `${header}\n## ${time} — ${outcome}\n\n${body}\n`;
  appendFileSync(file, entry);
}
