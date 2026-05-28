// Inlined from server.ts to test without importing the full server (which bootstraps agents)
const VALID_PLATFORMS = new Set(['twitter', 'linkedin', 'instagram', 'threads']);
function isValidPlatform(p: unknown): p is 'twitter' | 'linkedin' | 'instagram' | 'threads' {
  return typeof p === 'string' && VALID_PLATFORMS.has(p);
}

function parseDaysAhead(raw: string | undefined): number {
  const parsed = parseInt(raw ?? '14', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 14;
}

describe('isValidPlatform()', () => {
  it.each(['twitter', 'linkedin', 'instagram', 'threads'])('accepts valid platform: %s', (p) => {
    expect(isValidPlatform(p)).toBe(true);
  });

  it.each([
    ['empty string', ''],
    ['unknown platform', 'facebook'],
    ['number', 42],
    ['null', null],
    ['undefined', undefined],
    ['object', {}],
    ['partial match', 'twit'],
  ])('rejects invalid input: %s', (_label, p) => {
    expect(isValidPlatform(p)).toBe(false);
  });
});

describe('parseDaysAhead()', () => {
  it('returns the parsed number when valid', () => {
    expect(parseDaysAhead('7')).toBe(7);
    expect(parseDaysAhead('30')).toBe(30);
    expect(parseDaysAhead('1')).toBe(1);
  });

  it('defaults to 14 when input is undefined', () => {
    expect(parseDaysAhead(undefined)).toBe(14);
  });

  it('defaults to 14 for non-numeric strings', () => {
    expect(parseDaysAhead('abc')).toBe(14);
    expect(parseDaysAhead('')).toBe(14);
  });

  it('defaults to 14 for zero', () => {
    expect(parseDaysAhead('0')).toBe(14);
  });

  it('defaults to 14 for negative numbers', () => {
    expect(parseDaysAhead('-5')).toBe(14);
  });
});
