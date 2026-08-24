import { extractJson } from '../extract-json';

describe('extractJson', () => {
  it('parses plain JSON', () => {
    expect(extractJson<{ a: number }>('{"a": 1}')).toEqual({ a: 1 });
  });

  it('strips ```json fences before parsing', () => {
    expect(extractJson<{ a: number }>('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it('throws a clear, truncation-flagged error when the response was cut off mid-output', () => {
    // No closing "}" — the shape a token-limit cutoff actually produces.
    const truncated = '{"name": "Widget", "features": ["fast", "cheap"';
    expect(() => extractJson(truncated)).toThrow(/likely truncated/);
    expect(() => extractJson(truncated)).toThrow(/did not end with "}" or "\]"/);
  });

  it('does not flag truncation for a genuinely malformed but complete-looking response', () => {
    const malformed = '{"a": 1,}'; // trailing comma, but does end with "}"
    expect(() => extractJson(malformed)).toThrow('extractJson: response was not valid JSON');
    expect(() => extractJson(malformed)).not.toThrow(/likely truncated/);
  });

  it('includes the tail of the response in the error for debugging', () => {
    const truncated = '{"a": "b broken';
    expect(() => extractJson(truncated)).toThrow(
      new RegExp(truncated.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    );
  });
});
