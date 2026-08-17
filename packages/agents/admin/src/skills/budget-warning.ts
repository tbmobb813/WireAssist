import type { Skill } from '@wireassist/core';
import { budgetTracker } from '../budget';

const DEFAULT_THRESHOLD_PERCENT = 80;

export interface BudgetWarningInput {
  thresholdPercent?: number;
}

export const budgetWarningSkill: Skill<BudgetWarningInput, void> = {
  name: 'budget_warning_nudge',
  role: 'admin',
  description:
    'Warn when month-to-date agent spend has crossed a threshold of the monthly budget cap.',

  // No agent.think() here on purpose — budgetTracker.assertWithinBudget()
  // guards every think() call, so spending against the budget in order to
  // warn about the budget would be a little absurd. This is plain
  // arithmetic on already-computed BudgetStatus, no LLM call needed.
  async execute({ agent, task, input }) {
    const threshold = input.thresholdPercent ?? DEFAULT_THRESHOLD_PERCENT;
    const status = budgetTracker.status();
    const warranted = status.percent >= threshold;

    const summary = warranted
      ? `Month-to-date spend is $${status.spent.toFixed(2)} of $${status.budget.toFixed(2)} ` +
        `(${status.percent.toFixed(1)}%) — over the ${threshold}% warning threshold. Resets ` +
        `${new Date(status.resetsAt).toLocaleDateString()}.`
      : `Month-to-date spend is $${status.spent.toFixed(2)} of $${status.budget.toFixed(2)} ` +
        `(${status.percent.toFixed(1)}%) — under the ${threshold}% warning threshold.`;

    agent.emit('agent:budget_warning_complete', {
      taskId: task.id,
      warranted,
      summary,
      spent: status.spent,
      budget: status.budget,
      percent: status.percent,
      resetsAt: status.resetsAt,
    });
  },
};
