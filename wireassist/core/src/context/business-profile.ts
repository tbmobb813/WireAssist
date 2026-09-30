import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';

// Same WIREASSIST_HOME/homedir() + ~/.wireassist convention as
// packages/agents/ops/src/trust-stage.ts's ops-trust.json, so all of
// WireAssist's local runtime state lives under one directory.
export function businessProfilePath(): string {
  const base = process.env.WIREASSIST_HOME ?? homedir();
  return (
    process.env.WIREASSIST_BUSINESS_PROFILE_FILE ?? join(base, '.wireassist', 'business-profile.md')
  );
}

// Every agent extends BaseAgent, whose buildSystemPrompt() calls this on
// every think()/runToolLoop() invocation (not cached) — a small markdown
// file read is cheap, and it means an update written mid-session (e.g. via
// the update_business_profile skill) is visible to every agent, including
// ones other than the one that just wrote it, on their very next call.
// Returns '' rather than throwing when no profile exists yet — not every
// install has filled one in, and a missing profile shouldn't break agents.
export function loadBusinessProfile(): string {
  const path = businessProfilePath();
  if (!existsSync(path)) return '';
  try {
    return readFileSync(path, 'utf-8').trim();
  } catch {
    return '';
  }
}

export function saveBusinessProfile(content: string): void {
  const path = businessProfilePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content.trim() + '\n');
}
