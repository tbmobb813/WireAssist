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

// Extracts a workflow's "**Use when:**" trigger line, so callers picking
// between workflows (the model via list_workflows, or JNix via the /ops
// dropdown) see what distinguishes it without opening the file. Falls back
// to the bare name for any workflow that hasn't been given the line yet —
// this must never throw, since a missing line is expected during rollout.
export function getWorkflowSummary(name: string, dir: string = CONTEXT_DIR): string {
  try {
    const markdown = loadWorkflow(name, dir);
    const match = markdown.match(/^\*\*Use when:\*\*\s*(.+)$/m);
    return match ? match[1].trim() : name;
  } catch {
    return name;
  }
}

export function listWorkflowSummaries(
  dir: string = CONTEXT_DIR
): { name: string; useWhen: string }[] {
  return listWorkflows(dir).map((name) => ({ name, useWhen: getWorkflowSummary(name, dir) }));
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

// A workflow file may declare a publish destination with a line like:
//   **Publish target:** wordpress
// Only 'wordpress' is supported today. A workflow with no such line never
// attempts to publish anything — its approved output just ends up in the
// run log and memory, same as before this existed.
export type PublishTarget = 'wordpress';

export function parsePublishTarget(workflowMarkdown: string): PublishTarget | null {
  const match = workflowMarkdown.match(/\*\*Publish target:\*\*\s*(\S+)/);
  if (!match) return null;
  const target = match[1].toLowerCase();
  return target === 'wordpress' ? 'wordpress' : null;
}

export interface WorkflowInputSpec {
  type: 'string' | 'multiline' | 'boolean' | 'number';
  required?: boolean;
  periodic?: boolean;
  description: string;
}

export interface WorkflowFrontmatter {
  name?: string;
  trust_stage?: number;
  publish_target?: string;
  inputs?: Record<string, WorkflowInputSpec>;
}

export function parseWorkflowFrontmatter(markdown: string): {
  frontmatter: WorkflowFrontmatter | null;
  body: string;
} {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: null, body: markdown };

  const yamlStr = match[1];
  const body = match[2];

  try {
    const frontmatter: WorkflowFrontmatter = {};
    const lines = yamlStr.split('\n');
    let currentKey: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim() || line.trim().startsWith('#')) continue;

      if (!line.startsWith(' ') && line.includes(':')) {
        const [k, ...v] = line.split(':');
        const key = k.trim();
        const val = v.join(':').trim();
        currentKey = key;

        if (key === 'name') frontmatter.name = val;
        else if (key === 'trust_stage') frontmatter.trust_stage = parseInt(val, 10);
        else if (key === 'publish_target') frontmatter.publish_target = val;
        else if (key === 'inputs') frontmatter.inputs = {};
      } else if (
        currentKey === 'inputs' &&
        line.startsWith('  ') &&
        !line.startsWith('    ') &&
        line.includes(':')
      ) {
        const [inputName] = line.split(':');
        const name = inputName.trim();
        if (!frontmatter.inputs) frontmatter.inputs = {};
        frontmatter.inputs[name] = { type: 'string', description: '' };

        let j = i + 1;
        while (j < lines.length && lines[j].startsWith('    ')) {
          const subLine = lines[j].trim();
          if (subLine.includes(':')) {
            const [propK, ...propV] = subLine.split(':');
            const propKey = propK.trim();
            const propVal = propV.join(':').trim();
            if (propKey === 'type') frontmatter.inputs[name].type = propVal as any;
            else if (propKey === 'required') frontmatter.inputs[name].required = propVal === 'true';
            else if (propKey === 'periodic') frontmatter.inputs[name].periodic = propVal === 'true';
            else if (propKey === 'description') frontmatter.inputs[name].description = propVal;
          }
          j++;
        }
        i = j - 1;
      }
    }

    return { frontmatter, body };
  } catch {
    return { frontmatter: null, body: markdown };
  }
}
