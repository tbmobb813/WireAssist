import { extractJson } from '../types';

describe('extractJson', () => {
  it('parses a plain JSON object with no surrounding text', () => {
    expect(extractJson<{ a: number }>('{"a": 1}')).toEqual({ a: 1 });
  });

  it('parses JSON wrapped in ```json fences with nothing else', () => {
    expect(extractJson<{ a: number }>('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it('parses JSON wrapped in bare ``` fences', () => {
    expect(extractJson<{ a: number }>('```\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  // The real bug: a model ignoring "return only JSON" and adding a
  // sentence of commentary before and/or after the object — fence-only
  // stripping leaves this prose in place and JSON.parse rejects it.
  it('parses JSON with a leading sentence of prose', () => {
    expect(extractJson<{ a: number }>('Here you go:\n{"a": 1}')).toEqual({ a: 1 });
  });

  it('parses JSON with trailing prose after the object', () => {
    expect(extractJson<{ a: number }>('{"a": 1}\nLet me know if you need anything else.')).toEqual({
      a: 1,
    });
  });

  it('parses JSON with both leading and trailing prose', () => {
    expect(extractJson<{ a: number }>('Sure, here it is:\n{"a": 1}\nHope that helps!')).toEqual({
      a: 1,
    });
  });

  it('handles nested objects correctly (does not truncate at the first inner "}")', () => {
    const input = 'Result:\n{"a": 1, "nested": {"b": 2}}\nDone.';
    expect(extractJson<{ a: number; nested: { b: number } }>(input)).toEqual({
      a: 1,
      nested: { b: 2 },
    });
  });

  it('still throws on genuinely malformed JSON rather than silently returning garbage', () => {
    expect(() => extractJson('{"a": }')).toThrow();
  });
});
