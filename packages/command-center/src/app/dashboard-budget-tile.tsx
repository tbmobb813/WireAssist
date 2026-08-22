'use client';

interface BudgetStatus {
  budget: number;
  spent: number;
  remaining: number;
  percent: number;
  resetsAt: string;
}

const BUDGET_WARN_PERCENT = 80;

export default function DashboardBudgetTile({ budget }: { budget: BudgetStatus | null }) {
  return (
    // Small stat tile, always visible (not just when near cap).
    <div
      className="rounded-2xl border p-5 flex flex-col justify-between"
      style={{ background: '#0d0d1a', borderColor: '#1e2040', minHeight: '160px' }}
    >
      <div className="text-sm font-semibold text-gray-300">Budget</div>
      {budget ? (
        <div>
          <div className="text-3xl font-semibold text-gray-100 tabular-nums">
            ${budget.remaining.toFixed(2)}
          </div>
          {/* Whole-dollar rounding used to make small spend
              (e.g. $0.03 of $30) round to the same number as the cap
              and look like nothing was tracked — cents fix that, and
              spend is now shown explicitly rather than only implied
              by remaining vs. cap. */}
          <div className="text-xs text-gray-600 mb-2">
            left of ${budget.budget.toFixed(0)} · ${budget.spent.toFixed(2)} spent
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1e2040' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, budget.percent)}%`,
                background:
                  budget.percent >= BUDGET_WARN_PERCENT
                    ? '#ffb347'
                    : budget.percent >= 100
                      ? '#ef4444'
                      : '#00ff9d',
              }}
            />
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-600">Loading…</p>
      )}
    </div>
  );
}
