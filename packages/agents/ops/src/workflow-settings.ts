import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';

// A workflow file's "- Label: _SETTING: instruction_" bullets are shop-level
// constants (variant naming, cost sheets, brand voice examples) that
// shouldn't be re-typed on every run. This stores the filled value once in a
// JSON store under $WIREASSIST_HOME (a real persistent volume in the Docker
// deployment) and merges it into the workflow's text in memory whenever it's
// read — never written back into the workflow .md file itself, which lives
// inside the app's own source tree and gets rebuilt from git on every
// deploy, wiping any on-disk edit. (An earlier version of this file did
// write the value into the .md file — that's exactly why settings kept
// reverting after a redeploy.)

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

export function setWorkflowSettings(workflow: string, values: Record<string, string>): void {
  const all = readAll();
  all[workflow] = { ...(all[workflow] ?? {}), ...values };
  const path = filePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(all, null, 2));
}

// Substitutes every saved setting into a loaded workflow file's text — call
// this on the result of loadWorkflow() before feeding it to the model or
// showing it in a preview, so a genuinely-unfilled setting still shows its
// real "_SETTING:_" placeholder (and Diagnose can correctly treat it as
// missing) while a filled one reads as if it had always been in the file.
export function applyWorkflowSettings(markdown: string, workflow: string): string {
  const values = getWorkflowSettings(workflow);
  let content = markdown;
  for (const [label, value] of Object.entries(values)) {
    if (!value) continue;
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^(-\\s*${escapedLabel}:)\\s*_SETTING:\\s*.+?_\\s*$`, 'm');
    content = content.replace(re, `$1 ${value}`);
  }
  return content;
}
