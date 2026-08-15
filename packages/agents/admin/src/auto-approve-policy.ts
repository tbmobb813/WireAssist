import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';

// Narrow, hardcoded auto-approval carve-out: after Jason approves the exact
// same action (ignore-labeling one sender) this many times in a row, future
// occurrences of THAT action for THAT sender skip the approval queue.
// Everything else (send, draft, archive, trash, spam, any calendar mutation,
// any sheets write) is never eligible — enforced in isAutoApproveEligibleType
// below, not by this threshold or by prompt instructions.
export const AUTO_APPROVE_THRESHOLD = 3;

// Label names that count as "mark this sender as ignored" for auto-approval
// purposes. Keep in sync with the labels AdminAgent actually proposes for
// the triage `ignore` category.
const IGNORE_LABEL_PATTERN = /ignore|low.?priority/i;

interface SenderRecord {
  consecutiveApprovals: number;
  consecutiveRejections: number;
  autoApproveIgnore: boolean;
  lastUpdated: string;
  // Set via the Command Center API; overrides the derived value in either
  // direction until cleared (null).
  manualOverride?: boolean | null;
}

type Store = Record<string, SenderRecord>;

function filePath(): string {
  const base = process.env.WIREASSIST_HOME ?? homedir();
  return (
    process.env.WIREASSIST_ADMIN_AUTO_APPROVE_FILE ??
    join(base, '.wireassist', 'admin-auto-approve.json')
  );
}

function readAll(): Store {
  const path = filePath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as Store;
  } catch {
    return {};
  }
}

function writeAll(store: Store): void {
  const path = filePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(store, null, 2));
}

function emptyRecord(): SenderRecord {
  return {
    consecutiveApprovals: 0,
    consecutiveRejections: 0,
    autoApproveIgnore: false,
    lastUpdated: new Date().toISOString(),
  };
}

// Hardcoded eligibility check — the actual security boundary. Only a
// gmail_label_thread action whose label marks a thread as ignored/low-
// priority can ever be auto-approved. gmail_send, gmail_create_draft, every
// calendar_* mutation, archive/trash/spam, and sheets writes always return
// false here.
export function isAutoApproveEligibleType(action: {
  type: string;
  payload: Record<string, unknown>;
}): boolean {
  return (
    action.type === 'gmail_label_thread' &&
    IGNORE_LABEL_PATTERN.test(String(action.payload.labelName ?? ''))
  );
}

export function isEligibleForAutoApproval(sender: string): boolean {
  const record = readAll()[normalizeSender(sender)];
  if (!record) return false;
  if (record.manualOverride === false) return false;
  if (record.manualOverride === true) return true;
  return record.autoApproveIgnore;
}

// Call after every approval/rejection decision on an auto-approve-eligible
// action, keyed by sender. Flips autoApproveIgnore on once the sender has
// AUTO_APPROVE_THRESHOLD consecutive approvals; any rejection resets the
// streak and immediately turns auto-approval back off.
export function recordDecision(sender: string, approved: boolean): SenderRecord {
  const key = normalizeSender(sender);
  const store = readAll();
  const record = store[key] ?? emptyRecord();

  if (approved) {
    record.consecutiveApprovals += 1;
    record.consecutiveRejections = 0;
    if (record.consecutiveApprovals >= AUTO_APPROVE_THRESHOLD) {
      record.autoApproveIgnore = true;
    }
  } else {
    record.consecutiveRejections += 1;
    record.consecutiveApprovals = 0;
    record.autoApproveIgnore = false;
  }
  record.lastUpdated = new Date().toISOString();

  store[key] = record;
  writeAll(store);
  return record;
}

export function listAutoApproveRecords(): Store {
  return readAll();
}

// Manual control surface for the Command Center API. Pass null to clear a
// previously-set override and fall back to the derived (threshold-based)
// value.
export function setAutoApproveOverride(sender: string, enabled: boolean | null): SenderRecord {
  const key = normalizeSender(sender);
  const store = readAll();
  const record = store[key] ?? emptyRecord();
  record.manualOverride = enabled;
  record.lastUpdated = new Date().toISOString();
  store[key] = record;
  writeAll(store);
  return record;
}

function normalizeSender(sender: string): string {
  // "From" headers are often "Name <email@x.com>" — key on the email alone,
  // case-insensitively, so approvals accrue per-address regardless of how
  // the display name is capitalized/formatted across messages. Extracted
  // with indexOf rather than a regex: a `<([^>]+)>`-style pattern has
  // quadratic worst-case backtracking on attacker-controlled input like a
  // long run of `<` characters (this is an untrusted "From" header), which
  // indexOf can't exhibit since it never backtracks.
  const start = sender.indexOf('<');
  const end = start === -1 ? -1 : sender.indexOf('>', start + 1);
  const email = start !== -1 && end !== -1 ? sender.slice(start + 1, end) : sender;
  return email.trim().toLowerCase();
}
