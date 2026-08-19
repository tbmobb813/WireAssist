import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';

// Same idea as trust-stage.ts's ladder: a workflow file's "- Label: _SETTING:
// instruction_" bullets are shop-level constants (variant naming, cost
// sheets, brand voice examples) that shouldn't be re-typed on every run.
// This stores the filled values once and, like trust-stage.ts's
// syncWorkflowFile(), rewrites the workflow .md file itself so the DATA
// loop's Diagnose stage (which just reads the raw file text) sees the real
// value with zero changes to run-workflow.ts.

function filePath(): string {
  const base = process.env.WIREASSIST_HOME ?? homedir();
  return (
    process.env.WIREASSIST_OPS_SETTINGS_FILE ??
    join(base, '.wireassist', 'ops-workflow-settings.json')
  );
}

function readAll(): Record<string, Record<string, string>> {
  const path = filePath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, Record<string, string>>;
  } catch {
    return {};
  }
}

export function getWorkflowSettings(workflow: string): Record<string, string> {
  return readAll()[workflow] ?? {};
}

// Agent files live in context/ next to dist/ and src/ so both builds resolve
// them (same layout convention as context-loader.ts / trust-stage.ts).
const CONTEXT_DIR = join(__dirname, '..', 'context');

function syncWorkflowFile(workflow: string, values: Record<string, string>): void {
  const path = join(CONTEXT_DIR, 'workflows', `${workflow}.md`);
  if (!existsSync(path)) return;
  let content = readFileSync(path, 'utf-8');
  for (const [label, value] of Object.entries(values)) {
    if (!value) continue;
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^(-\\s*${escapedLabel}:)\\s*_SETTING:\\s*.+?_\\s*$`, 'm');
    content = content.replace(re, `$1 ${value}`);
  }
  writeFileSync(path, content);
}

export function setWorkflowSettings(workflow: string, values: Record<string, string>): void {
  const all = readAll();
  all[workflow] = { ...(all[workflow] ?? {}), ...values };
  const path = filePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(all, null, 2));
  syncWorkflowFile(workflow, values);
}
