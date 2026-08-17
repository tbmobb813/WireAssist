import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';

// Agent files live in context/ next to dist/ and src/ so both builds resolve them.
const CONTEXT_DIR = join(__dirname, '..', 'context');

export interface OpsContext {
  soul: string;
  identity: string;
  user: string;
}

export function loadOpsContext(dir: string = CONTEXT_DIR): OpsContext {
  const read = (name: string): string => {
    const path = join(dir, name);
    if (!existsSync(path)) {
      throw new Error(`NixOps context file missing: ${path}`);
    }
    return readFileSync(path, 'utf-8');
  };
  return {
    soul: read('SOUL.md'),
    identity: read('IDENTITY.md'),
    user: read('USER.md'),
  };
}

export function listWorkflows(dir: string = CONTEXT_DIR): string[] {
  const wfDir = join(dir, 'workflows');
  if (!existsSync(wfDir)) return [];
  return readdirSync(wfDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => basename(f, '.md'));
}

export function loadWorkflow(name: string, dir: string = CONTEXT_DIR): string {
  // Reject path separators so task input can't escape the workflows directory.
  // The explicit typeof check matters: RegExp#test() coerces a non-string
  // argument to a string first, so a missing `name` (undefined, from a
  // malformed tool call) would otherwise stringify to "undefined" — which
  // itself matches the regex — and silently pass this guard.
  if (typeof name !== 'string' || !/^[a-z0-9-]+$/i.test(name)) {
    throw new Error(`Invalid workflow name: ${name}`);
  }
  const path = join(dir, 'workflows', `${name}.md`);
  if (!existsSync(path)) {
    throw new Error(`Unknown workflow: ${name}. Available: ${listWorkflows(dir).join(', ')}`);
  }
  return readFileSync(path, 'utf-8');
}

export interface SheetRef {
  spreadsheetId: string;
  range: string;
}

// A workflow file may declare its Google Sheet system of record with a line
// like:
//   **Sheet:** <spreadsheetId> | <range>
// e.g. **Sheet:** 1a2B3cD4eFgH | Costs!A1:D100
// This is how SOUL.md's Diagnose step ("pull the current real state —
// inbox, sheet, API, files") gets an actual sheet to pull. Optional — a
// workflow with no such line just skips the sheet-read entirely.
export function parseSheetRef(workflowMarkdown: string): SheetRef | null {
  const match = workflowMarkdown.match(/\*\*Sheet:\*\*\s*([^\s|]+)\s*\|\s*(.+)/);
  if (!match) return null;
  const [, spreadsheetId, range] = match;
  return { spreadsheetId, range: range.trim() };
}
