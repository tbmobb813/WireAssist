import Anthropic from '@anthropic-ai/sdk';
import { budgetTracker } from '@wireassist/agent-admin';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { extractJson } from './skills/extract-json';

const PREFILL_MODEL = 'claude-haiku-4-5';
const MAX_DOC_CHARS = 8000;

// Checked in order; first one found wins.
const DOC_CANDIDATES = ['README.md', 'STATUS.md'];

export interface GtmPrefillResult {
  name: string;
  cat?: string;
  problem?: string;
  benefit?: string;
  diff?: string;
  docFound: boolean;
  docPath?: string;
}

function findDoc(repoPath: string): { path: string; content: string } | null {
  for (const candidate of DOC_CANDIDATES) {
    const full = join(repoPath, candidate);
    if (existsSync(full)) {
      const content = readFileSync(full, 'utf8').slice(0, MAX_DOC_CHARS);
      return { path: full, content };
    }
  }
  return null;
}

/**
 * Best-effort pre-fill for the GTM wizard: pulls the project name directly, and —
 * if a repo path is known and has a README.md/STATUS.md — summarizes it into
 * category/problem/benefit/differentiator. Buyer, price, competitors, and every
 * other market/business field are intentionally left for the founder to fill in;
 * none of that lives in a repo.
 */
export async function prefillFromRepoDoc(
  projectName: string,
  repoPath?: string
): Promise<GtmPrefillResult> {
  if (!repoPath || !existsSync(repoPath)) {
    return { name: projectName, docFound: false };
  }

  const doc = findDoc(repoPath);
  if (!doc) {
    return { name: projectName, docFound: false };
  }

  budgetTracker.assertWithinBudget();

  const client = new Anthropic();
  const response = await client.messages.create({
    model: PREFILL_MODEL,
    max_tokens: 512,
    system:
      'You summarize a project doc into a few short fields for a GTM strategy form. ' +
      'Return ONLY valid JSON, no markdown fences, no preamble: ' +
      '{"cat": "short category, e.g. SaaS/Mobile App/Agency", ' +
      '"problem": "the problem this solves, one or two sentences", ' +
      '"benefit": "the outcome/benefit it delivers, one or two sentences", ' +
      '"diff": "what differentiates it, one sentence"}. ' +
      'If the doc genuinely does not say enough to infer a field, use an empty string for it.',
    messages: [{ role: 'user', content: doc.content }],
  });

  if (response.usage) {
    budgetTracker.record(
      'gtm-prefill',
      PREFILL_MODEL,
      response.usage.input_tokens,
      response.usage.output_tokens
    );
  }

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  try {
    const parsed = extractJson<{ cat?: string; problem?: string; benefit?: string; diff?: string }>(
      text
    );
    return {
      name: projectName,
      cat: parsed.cat || undefined,
      problem: parsed.problem || undefined,
      benefit: parsed.benefit || undefined,
      diff: parsed.diff || undefined,
      docFound: true,
      docPath: doc.path,
    };
  } catch {
    return { name: projectName, docFound: true, docPath: doc.path };
  }
}
