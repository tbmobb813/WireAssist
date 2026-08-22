import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';
import { loadWorkflow } from './context-loader';

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
//
// A "_SETTING_PERIODIC:_" placeholder (same syntax, different tag) marks a
// setting whose real-world value drifts over time — a cost sheet, a rate
// card — as opposed to a static brand fact that never changes. Both tags
// substitute identically; the distinction only matters for staleness
// tracking (see StoredSetting.updatedAt below and run-workflow.ts's Diagnose
// staleness note).

interface StoredSetting {
  value: string;
  updatedAt: string;
}

type StoredWorkflow = Record<string, StoredSetting>;

function filePath(): string {
  const base = process.env.WIREASSIST_HOME ?? homedir();
  return (
    process.env.WIREASSIST_OPS_SETTINGS_FILE ??
    join(base, '.wireassist', 'ops-workflow-settings.json')
  );
}

// Older on-disk files stored bare strings per label (pre-dating updatedAt
// tracking). Normalize both shapes on read so nothing on a live deployment
// breaks the moment this ships — an old entry just has no known update time.
function readAll(): Record<string, StoredWorkflow> {
  const path = filePath();
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
  const all = readAll();
  const updatedAt = new Date().toISOString();
  const existing = all[workflow] ?? {};
  const merged: StoredWorkflow = { ...existing };
  for (const [label, value] of Object.entries(values)) {
    merged[label] = { value, updatedAt };
  }
  all[workflow] = merged;
  const path = filePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(all, null, 2));
}

// Parses a workflow's raw, unmerged markdown for every `_SETTING:_` /
// `_SETTING_PERIODIC:_` label. Deliberately reads the raw file rather than
// the merged preview text: once a setting is filled, its placeholder
// disappears from the merged text, so periodic-ness can't be re-derived from
// what the UI currently shows. The raw file never changes (nothing writes
// back to it), so it's the only stable source for "was this ever tagged
// periodic."
export function getWorkflowSettingLabels(workflow: string): { label: string; periodic: boolean }[] {
  let markdown: string;
  try {
    markdown = loadWorkflow(workflow);
  } catch {
    return [];
  }
  const labels: { label: string; periodic: boolean }[] = [];
  const re = /^-\s*(.+?):\s*_SETTING(_PERIODIC)?:\s*.+?_\s*$/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null) {
    labels.push({ label: match[1].trim(), periodic: Boolean(match[2]) });
  }
  return labels;
}

// Substitutes every saved setting into a loaded workflow file's text — call
// this on the result of loadWorkflow() before feeding it to the model or
// showing it in a preview, so a genuinely-unfilled setting still shows its
// real "_SETTING:_"/"_SETTING_PERIODIC:_" placeholder (and Diagnose can
// correctly treat it as missing) while a filled one reads as if it had
// always been in the file.
export function applyWorkflowSettings(markdown: string, workflow: string): string {
  const values = getWorkflowSettings(workflow);
  let content = markdown;
  for (const [label, value] of Object.entries(values)) {
    if (!value) continue;
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^(-\\s*${escapedLabel}:)\\s*_SETTING(?:_PERIODIC)?:\\s*.+?_\\s*$`, 'm');
    content = content.replace(re, `$1 ${value}`);
  }
  return content;
}
