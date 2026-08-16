import { distributeDates, timelineWeekNumber } from '../tools';

describe('distributeDates()', () => {
  it('returns an empty array for count <= 0', () => {
    expect(distributeDates(0, 1)).toEqual([]);
    expect(distributeDates(-1, 1)).toEqual([]);
  });

  it('spreads count items evenly across the weeksAhead*7-day window', () => {
    const from = new Date('2026-06-01T00:00:00Z');
    const dates = distributeDates(3, 1, from);
    expect(dates).toHaveLength(3);
    // Window is 7 days starting tomorrow (2026-06-02); 3 items step ~2.33 days apart.
    expect(dates[0].getUTCDate()).toBe(2);
    expect(dates[1].getUTCDate()).toBeGreaterThan(dates[0].getUTCDate());
    expect(dates[2].getUTCDate()).toBeGreaterThan(dates[1].getUTCDate());
  });

  it('starts strictly after "from" (never schedules for today)', () => {
    const from = new Date('2026-06-01T15:00:00Z');
    const [first] = distributeDates(1, 1, from);
    expect(first.getTime()).toBeGreaterThan(from.getTime());
  });

  it('produces dates in ascending order', () => {
    const dates = distributeDates(5, 2, new Date('2026-06-01T00:00:00Z'));
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i].getTime()).toBeGreaterThanOrEqual(dates[i - 1].getTime());
    }
  });
});

describe('timelineWeekNumber()', () => {
  it('parses a leading integer from the label', () => {
    expect(timelineWeekNumber('Week 1', 0)).toBe(1);
    expect(timelineWeekNumber('Week 2: Launch', 0)).toBe(2);
  });

  it('falls back to the 1-indexed position when the label has no number', () => {
    expect(timelineWeekNumber('Pre-launch', 0)).toBe(1);
    expect(timelineWeekNumber('Pre-launch', 2)).toBe(3);
  });
});
