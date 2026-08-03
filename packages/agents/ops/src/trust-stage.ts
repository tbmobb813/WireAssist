import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';

// Per SOUL.md's trust ladder: 2 = approve everything (default, current stage
// for every workflow until JNix explicitly advances it), 3 = pre-approved,
// runs deliver without asking, 4 = same as 3 but meant to be triggered
// unattended (by an external cron) rather than by a human click — the code
// path is identical for 3 and 4, only who calls the endpoint differs.
export const DEFAULT_TRUST_STAGE = 2;
export const MIN_TRUST_STAGE = 2;
export const MAX_TRUST_STAGE = 4;

function filePath(): string {
  const base = process.env.WIREASSIST_HOME ?? homedir();
  return process.env.WIREASSIST_OPS_TRUST_FILE ?? join(base, '.wireassist', 'ops-trust.json');
}

function readAll(): Record<string, number> {
  const path = filePath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, number>;
  } catch {
    return {};
  }
}

export function getTrustStage(workflow: string): number {
  return readAll()[workflow] ?? DEFAULT_TRUST_STAGE;
}

// Agent files live in context/ next to dist/ and src/ so both builds resolve them
// (same layout convention as context-loader.ts).
const CONTEXT_DIR = join(__dirname, '..', 'context');

function stageLabel(stage: number): string {
  switch (stage) {
    case 2:
      return '2 (approve everything first)';
    case 3:
      return '3 (pre-approved — runs deliver without asking)';
    case 4:
      return '4 (heartbeat — unattended scheduled runs)';
    default:
      return `${stage}`;
  }
}

// The workflow file's own "**Trust stage:**" line is what the agent treats as
// the durable, JNix-authored source of truth (per SOUL.md: "Advance a
// workflow to the next stage only when JNix says so, per workflow"). Setting
// the stage through the dashboard/API *is* that explicit action, so the line
// must be rewritten to match — otherwise the agent correctly refuses to trust
// a value that contradicts the one document it's told to treat as authoritative.
function syncWorkflowFile(workflow: string, stage: number): void {
  const path = join(CONTEXT_DIR, 'workflows', `${workflow}.md`);
  if (!existsSync(path)) return;
  const content = readFileSync(path, 'utf-8');
  const updated = content.replace(
    /\*\*Trust stage:\*\*.*/,
    `**Trust stage:** ${stageLabel(stage)}`
  );
  if (updated !== content) writeFileSync(path, updated);
}

export function setTrustStage(workflow: string, stage: number): number {
  const clamped = Math.min(MAX_TRUST_STAGE, Math.max(MIN_TRUST_STAGE, Math.round(stage)));
  const all = readAll();
  all[workflow] = clamped;
  const path = filePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(all, null, 2));
  syncWorkflowFile(workflow, clamped);
  return clamped;
}

export function listTrustStages(): Record<string, number> {
  return readAll();
}
