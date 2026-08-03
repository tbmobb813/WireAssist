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

export function setTrustStage(workflow: string, stage: number): number {
  const clamped = Math.min(MAX_TRUST_STAGE, Math.max(MIN_TRUST_STAGE, Math.round(stage)));
  const all = readAll();
  all[workflow] = clamped;
  const path = filePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(all, null, 2));
  return clamped;
}

export function listTrustStages(): Record<string, number> {
  return readAll();
}
