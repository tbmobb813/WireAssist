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
  if (!/^[a-z0-9-]+$/i.test(name)) {
    throw new Error(`Invalid workflow name: ${name}`);
  }
  const path = join(dir, 'workflows', `${name}.md`);
  if (!existsSync(path)) {
    throw new Error(`Unknown workflow: ${name}. Available: ${listWorkflows(dir).join(', ')}`);
  }
  return readFileSync(path, 'utf-8');
}
