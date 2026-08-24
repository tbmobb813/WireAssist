import { BudgetTracker, BudgetExceededError } from '../budget';
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const file = () => join(mkdtempSync(join(tmpdir(), 'budget-')), 'budget.json');

describe('BudgetTracker', () => {
  it('prices known models correctly', () => {
    // 1M in + 1M out on sonnet-5 = $3 + $15
    expect(BudgetTracker.estimateCost('claude-sonnet-5', 1_000_000, 1_000_000)).toBe(18);
    expect(BudgetTracker.estimateCost('claude-haiku-4-5', 1_000_000, 0)).toBe(1);
  });

  it('prices unknown models at the most expensive tier', () => {
    expect(BudgetTracker.estimateCost('mystery-model', 1_000_000, 0)).toBe(10);
  });

  it('records usage and reports month-to-date status', () => {
    const t = new BudgetTracker({ filePath: file(), monthlyBudget: 30 });
    t.record('strategy', 'claude-sonnet-5', 100_000, 50_000);
    const s = t.status();
    expect(s.spent).toBeCloseTo(0.3 + 0.75);
    expect(s.remaining).toBeCloseTo(30 - 1.05);
    expect(s.byModel['claude-sonnet-5'].calls).toBe(1);
  });

  it('throws once the monthly cap is reached', () => {
    const t = new BudgetTracker({ filePath: file(), monthlyBudget: 0.5 });
    t.record('admin', 'claude-sonnet-5', 100_000, 20_000); // $0.60
    expect(() => t.assertWithinBudget()).toThrow(BudgetExceededError);
  });

  it('allows calls while under budget', () => {
    const t = new BudgetTracker({ filePath: file(), monthlyBudget: 30 });
    expect(() => t.assertWithinBudget()).not.toThrow();
  });

  it('throws when spend-so-far is under the cap but adding a worst-case estimate would exceed it', () => {
    // The gap this closes: without an estimate, this call would pass the
    // check (spent $29 < $30 cap) and only get caught *after* it actually
    // cost $5, overshooting to $34.
    const t = new BudgetTracker({ filePath: file(), monthlyBudget: 30 });
    t.record('strategy', 'claude-sonnet-5', 1_000_000 * (29 / 3), 0); // sonnet-5 input is $3/1M -> ~$29
    expect(() => t.assertWithinBudget(5)).toThrow(BudgetExceededError);
  });

  it('does not throw when spend + estimate stays under the cap', () => {
    const t = new BudgetTracker({ filePath: file(), monthlyBudget: 30 });
    t.record('strategy', 'claude-sonnet-5', 1_000_000, 0); // $3
    expect(() => t.assertWithinBudget(5)).not.toThrow();
  });

  it('prunes entries older than the start of last month on every record()', () => {
    const path = file();
    const t = new BudgetTracker({ filePath: path, monthlyBudget: 30 });
    const now = new Date();
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 15).toISOString();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString();
    writeFileSync(
      path,
      JSON.stringify([
        {
          ts: twoMonthsAgo,
          agentRole: 'admin',
          model: 'claude-sonnet-5',
          inputTokens: 1,
          outputTokens: 1,
          cost: 0.01,
        },
        {
          ts: lastMonth,
          agentRole: 'admin',
          model: 'claude-sonnet-5',
          inputTokens: 1,
          outputTokens: 1,
          cost: 0.01,
        },
      ])
    );

    t.record('strategy', 'claude-sonnet-5', 1000, 1000); // triggers the prune

    const stored = JSON.parse(readFileSync(path, 'utf-8'));
    expect(stored.some((e: { ts: string }) => e.ts === twoMonthsAgo)).toBe(false);
    expect(stored.some((e: { ts: string }) => e.ts === lastMonth)).toBe(true);
    expect(stored).toHaveLength(2); // last-month entry kept + the new one just recorded
  });

  describe('default file path', () => {
    const originalHome = process.env.WIREASSIST_HOME;
    const originalBudgetFile = process.env.WIREASSIST_BUDGET_FILE;

    afterEach(() => {
      process.env.WIREASSIST_HOME = originalHome;
      process.env.WIREASSIST_BUDGET_FILE = originalBudgetFile;
    });

    it('honors WIREASSIST_HOME when no explicit filePath is given', () => {
      delete process.env.WIREASSIST_BUDGET_FILE;
      const home = mkdtempSync(join(tmpdir(), 'wireassist-home-'));
      process.env.WIREASSIST_HOME = home;

      const t = new BudgetTracker({ monthlyBudget: 30 });
      t.record('strategy', 'claude-sonnet-5', 1000, 1000);

      expect(existsSync(join(home, '.wireassist', 'budget.json'))).toBe(true);
    });
  });
});
