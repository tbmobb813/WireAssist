// Runtime on/off switch for "diagnostic logging" — writing the raw text of
// model replies that failed to parse into the server log. Those replies can
// contain email senders and subjects, so it's off by default and turns itself
// off again after CAPTURE_WINDOW_MINUTES, so nobody has to remember to.
//
// Stored as a tiny JSON file under WIREASSIST_HOME (same convention as the
// other small settings files) and re-read on demand, so flipping it from the
// Settings page takes effect immediately — no restart, no editing .env — and
// any process sharing WIREASSIST_HOME (e.g. the trendpost MCP server) sees it.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';

export const CAPTURE_WINDOW_MINUTES = 30;

// Re-reading the file on every log call would be wasteful; a couple of
// seconds of staleness is invisible to a human flipping a switch.
const CACHE_TTL_MS = 2000;

export interface DiagnosticsStatus {
  rawCapture: boolean;
  // ISO timestamp when capture switches itself off; null when it's off.
  expiresAt: string | null;
  windowMinutes: number;
}

function settingsPath(): string {
  // Resolved on each call (not at import) so it follows WIREASSIST_HOME.
  return join(process.env.WIREASSIST_HOME ?? homedir(), '.wireassist', 'diagnostics.json');
}

let cache: { path: string; at: number; until: number | null } | null = null;

function readUntil(now: number): number | null {
  const path = settingsPath();
  if (cache && cache.path === path && now - cache.at < CACHE_TTL_MS) return cache.until;

  let until: number | null = null;
  try {
    if (existsSync(path)) {
      const parsed = JSON.parse(readFileSync(path, 'utf-8')) as { rawCaptureUntil?: unknown };
      if (typeof parsed.rawCaptureUntil === 'number') until = parsed.rawCaptureUntil;
    }
  } catch {
    // Corrupt or unreadable file: treat as "off" — failing safe means
    // *not* logging email content.
  }
  cache = { path, at: now, until };
  return until;
}

export function isRawCaptureEnabled(now: number = Date.now()): boolean {
  const until = readUntil(now);
  return until !== null && until > now;
}

export function getDiagnostics(now: number = Date.now()): DiagnosticsStatus {
  const until = readUntil(now);
  const on = until !== null && until > now;
  return {
    rawCapture: on,
    expiresAt: on ? new Date(until).toISOString() : null,
    windowMinutes: CAPTURE_WINDOW_MINUTES,
  };
}

// Turn capture on (for CAPTURE_WINDOW_MINUTES from now) or off.
export function setRawCapture(enabled: boolean, now: number = Date.now()): DiagnosticsStatus {
  const path = settingsPath();
  const until = enabled ? now + CAPTURE_WINDOW_MINUTES * 60_000 : null;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ rawCaptureUntil: until }, null, 2));
  cache = { path, at: now, until };
  return getDiagnostics(now);
}
