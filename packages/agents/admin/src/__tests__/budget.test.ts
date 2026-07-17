import { BudgetTracker, BudgetExceededError } from '../budget';
import { mkdtempSync } from 'fs';
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
});
