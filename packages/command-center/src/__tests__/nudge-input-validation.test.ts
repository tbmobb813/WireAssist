// Inlined from server.ts's /api/tasks/budget-warning and /api/tasks/stale-approvals
// routes to test without importing the full server (which bootstraps agents).
function resolveThresholdPercent(raw: unknown): number {
  return Number.isFinite(raw) && (raw as number) >= 0 ? (raw as number) : 80;
}

function resolveDaysStale(raw: unknown): number {
  return Number.isFinite(raw) && (raw as number) >= 0 ? (raw as number) : 3;
}

// Unlike daysStale/thresholdPercent, this has no fixed numeric fallback —
// the skill itself defaults to 5 when backlogThreshold is undefined, so an
// invalid value here is passed through as undefined, not coerced to a
// number the caller never asked for.
function resolveBacklogThreshold(raw: unknown): number | undefined {
  return Number.isFinite(raw) && (raw as number) >= 0 ? (raw as number) : undefined;
}

describe('resolveThresholdPercent()', () => {
  it('passes through a valid non-negative number', () => {
    expect(resolveThresholdPercent(50)).toBe(50);
    expect(resolveThresholdPercent(0)).toBe(0);
    expect(resolveThresholdPercent(100)).toBe(100);
  });

  it('defaults to 80 when undefined', () => {
    expect(resolveThresholdPercent(undefined)).toBe(80);
  });

  it('defaults to 80 for a negative number', () => {
    expect(resolveThresholdPercent(-10)).toBe(80);
  });

  it('defaults to 80 for NaN, Infinity, a string, or an object', () => {
    expect(resolveThresholdPercent(NaN)).toBe(80);
    expect(resolveThresholdPercent(Infinity)).toBe(80);
    expect(resolveThresholdPercent('abc')).toBe(80);
    expect(resolveThresholdPercent({})).toBe(80);
  });
});

describe('resolveDaysStale()', () => {
  it('passes through a valid non-negative number', () => {
    expect(resolveDaysStale(1)).toBe(1);
    expect(resolveDaysStale(0)).toBe(0);
  });

  it('defaults to 3 when undefined', () => {
    expect(resolveDaysStale(undefined)).toBe(3);
  });

  it('defaults to 3 for a negative number', () => {
    expect(resolveDaysStale(-1)).toBe(3);
  });

  it('defaults to 3 for NaN or a non-numeric value', () => {
    expect(resolveDaysStale(NaN)).toBe(3);
    expect(resolveDaysStale('abc')).toBe(3);
  });
});

describe('resolveBacklogThreshold()', () => {
  it('passes through a valid non-negative number', () => {
    expect(resolveBacklogThreshold(5)).toBe(5);
    expect(resolveBacklogThreshold(0)).toBe(0);
  });

  it('is undefined when not provided, letting the skill apply its own default', () => {
    expect(resolveBacklogThreshold(undefined)).toBeUndefined();
  });

  it('is undefined for a negative number, NaN, or a non-numeric value', () => {
    expect(resolveBacklogThreshold(-1)).toBeUndefined();
    expect(resolveBacklogThreshold(NaN)).toBeUndefined();
    expect(resolveBacklogThreshold('abc')).toBeUndefined();
  });
});
