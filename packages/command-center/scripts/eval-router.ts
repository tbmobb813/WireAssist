/**
 * Golden-set routing-accuracy eval. Calls the real routeChatMessage()
 * classifier (real Anthropic API call, real budget accounting) against a
 * curated set of prompts and reports pass/fail per case plus overall
 * accuracy. There was previously zero coverage of actual classification
 * behavior — chat-router.test.ts only exercises the pure
 * buildRouterMessages()/buildDecision() helpers.
 *
 * Run: pnpm --filter @wireassist/command-center eval:router
 */
import { routeChatMessage } from '../src/api/chat-router';
import { ROUTER_EVAL_CASES } from './router-eval-cases';

async function main() {
  const results: Array<{
    prompt: string;
    expected: string;
    actual: string;
    pass: boolean;
    notes: string;
  }> = [];

  for (const c of ROUTER_EVAL_CASES) {
    try {
      const decision = await routeChatMessage(c.prompt);
      results.push({
        prompt: c.prompt,
        expected: c.expectedKind,
        actual: decision.kind,
        pass: decision.kind === c.expectedKind,
        notes: c.notes,
      });
    } catch (err) {
      results.push({
        prompt: c.prompt,
        expected: c.expectedKind,
        actual: `ERROR: ${err instanceof Error ? err.message : String(err)}`,
        pass: false,
        notes: c.notes,
      });
    }
  }

  const passed = results.filter((r) => r.pass);
  const failed = results.filter((r) => !r.pass);

  console.log(`\nRouter eval: ${passed.length}/${results.length} passed\n`);

  if (failed.length > 0) {
    console.log('FAILURES:');
    for (const f of failed) {
      console.log(`\n  prompt:   "${f.prompt}"`);
      console.log(`  expected: ${f.expected}`);
      console.log(`  actual:   ${f.actual}`);
      console.log(`  why this case exists: ${f.notes}`);
    }
    console.log('');
  }

  const accuracy = ((passed.length / results.length) * 100).toFixed(1);
  console.log(`Accuracy: ${accuracy}%\n`);

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Eval script crashed:', err);
  process.exit(1);
});
