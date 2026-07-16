import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';

// Per-MTok USD pricing (standard, non-introductory rates).
const PRICES: Record<string, { input: number; output: number }> = {
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-opus-4-8': { input: 5, output: 25 },
};
// Unknown models are priced at the most expensive tier so the cap can't be dodged.
const FALLBACK_PRICE = { input: 10, output: 50 };

interface UsageEntry {
  ts: string;
  agentRole: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export interface BudgetStatus {
  budget: number;
  spent: number;
  remaining: number;
  percent: number;
  byModel: Record<string, { cost: number; calls: number }>;
  resetsAt: string;
}

export class BudgetExceededError extends Error {
  constructor(spent: number, budget: number) {
    super(
      `Monthly agent budget exhausted: $${spent.toFixed(2)} of $${budget.toFixed(2)} spent. ` +
        `Raise WIREASSIST_BUDGET_MONTHLY or wait for the monthly reset.`
    );
    this.name = 'BudgetExceededError';
  }
}

export class BudgetTracker {
  private filePath: string;
  readonly monthlyBudget: number;

  constructor(options?: { filePath?: string; monthlyBudget?: number }) {
    this.filePath =
      options?.filePath ??
      process.env.WIREASSIST_BUDGET_FILE ??
      join(homedir(), '.wireassist', 'budget.json');
    this.monthlyBudget =
      options?.monthlyBudget ?? Number(process.env.WIREASSIST_BUDGET_MONTHLY ?? 30);
  }

  static estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    const price = PRICES[model] ?? FALLBACK_PRICE;
    return (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
  }

  private readEntries(): UsageEntry[] {
    if (!existsSync(this.filePath)) return [];
    try {
      return JSON.parse(readFileSync(this.filePath, 'utf-8')) as UsageEntry[];
    } catch {
      return [];
    }
  }

  record(agentRole: string, model: string, inputTokens: number, outputTokens: number): number {
    const cost = BudgetTracker.estimateCost(model, inputTokens, outputTokens);
    const entries = this.readEntries();
    entries.push({
      ts: new Date().toISOString(),
      agentRole,
      model,
      inputTokens,
      outputTokens,
      cost,
    });
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(entries, null, 2));
    return cost;
  }

  private monthEntries(): UsageEntry[] {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return this.readEntries().filter((e) => new Date(e.ts) >= monthStart);
  }

  spentThisMonth(): number {
    return this.monthEntries().reduce((sum, e) => sum + e.cost, 0);
  }

  /** Throws BudgetExceededError when month-to-date spend has reached the cap. */
  assertWithinBudget(): void {
    const spent = this.spentThisMonth();
    if (spent >= this.monthlyBudget) {
      throw new BudgetExceededError(spent, this.monthlyBudget);
    }
  }

  status(): BudgetStatus {
    const entries = this.monthEntries();
    const spent = entries.reduce((sum, e) => sum + e.cost, 0);
    const byModel: Record<string, { cost: number; calls: number }> = {};
    for (const e of entries) {
      byModel[e.model] ??= { cost: 0, calls: 0 };
      byModel[e.model].cost += e.cost;
      byModel[e.model].calls += 1;
    }
    const now = new Date();
    return {
      budget: this.monthlyBudget,
      spent,
      remaining: Math.max(0, this.monthlyBudget - spent),
      percent: this.monthlyBudget > 0 ? (spent / this.monthlyBudget) * 100 : 0,
      byModel,
      resetsAt: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
    };
  }
}

// Shared tracker used by BaseAgent; construct your own for custom paths/caps.
export const budgetTracker = new BudgetTracker();
