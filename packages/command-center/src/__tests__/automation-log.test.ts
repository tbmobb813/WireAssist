import { computeNextRun, isValidAutomationJob, AUTOMATION_REGISTRY } from '../api/automation-log';

describe('computeNextRun()', () => {
  it('every-5-minutes: rounds up to the next :05 boundary', () => {
    const from = new Date(2026, 0, 1, 10, 2, 0); // 10:02
    const next = computeNextRun('*/5 * * * *', from);
    expect(next?.getHours()).toBe(10);
    expect(next?.getMinutes()).toBe(5);
  });

  it('every-5-minutes: rolls into the next hour past :55', () => {
    const from = new Date(2026, 0, 1, 10, 57, 0);
    const next = computeNextRun('*/5 * * * *', from);
    expect(next?.getHours()).toBe(11);
    expect(next?.getMinutes()).toBe(0);
  });

  it('hourly: next run is the top of the next hour', () => {
    const from = new Date(2026, 0, 1, 10, 30, 0);
    const next = computeNextRun('0 * * * *', from);
    expect(next?.getHours()).toBe(11);
    expect(next?.getMinutes()).toBe(0);
  });

  it('daily at a fixed hour: same day if not yet passed', () => {
    const from = new Date(2026, 0, 1, 5, 0, 0); // 5am
    const next = computeNextRun('0 7 * * *', from); // daily at 7am
    expect(next?.getDate()).toBe(1);
    expect(next?.getHours()).toBe(7);
  });

  it('daily at a fixed hour: next day if already passed', () => {
    const from = new Date(2026, 0, 1, 9, 0, 0); // 9am
    const next = computeNextRun('0 7 * * *', from); // daily at 7am
    expect(next?.getDate()).toBe(2);
    expect(next?.getHours()).toBe(7);
  });

  it('weekly on a specific day: lands on that weekday', () => {
    // 2026-01-01 is a Thursday (day 4)
    const from = new Date(2026, 0, 1, 0, 0, 0);
    const next = computeNextRun('0 8 * * 1', from); // weekly, Monday 8am
    expect(next?.getDay()).toBe(1);
    expect(next?.getHours()).toBe(8);
  });

  it('monthly on a specific day of month', () => {
    const from = new Date(2026, 0, 5, 0, 0, 0); // Jan 5
    const next = computeNextRun('0 8 1 * *', from); // 1st of the month, 8am
    expect(next?.getMonth()).toBe(1); // February (0-indexed)
    expect(next?.getDate()).toBe(1);
  });

  it('returns null for a malformed expression', () => {
    expect(computeNextRun('not a cron')).toBeNull();
  });
});

describe('isValidAutomationJob()', () => {
  it('accepts every registered job', () => {
    for (const { job } of AUTOMATION_REGISTRY) {
      expect(isValidAutomationJob(job)).toBe(true);
    }
  });

  it('rejects an unknown job', () => {
    expect(isValidAutomationJob('not-a-real-job')).toBe(false);
  });
});
