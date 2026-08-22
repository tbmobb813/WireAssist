import { parseSSEChunk } from '../../streaming/parser';

describe('SSE Parser', () => {
  test('should parse OpenAI-style SSE chunk', () => {
    const chunk = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n';
    const result = parseSSEChunk(chunk);

    expect(result).toBeDefined();
    expect(result).toBe('Hello');
  });

  test('should handle data prefix with plain text', () => {
    const chunk = 'data: test content\n\n';
    const result = parseSSEChunk(chunk);

    expect(result).toBe('test content');
  });

  test('should handle empty chunk', () => {
    const result = parseSSEChunk('');
    expect(result).toBeNull();
  });

  test('should handle whitespace-only chunk', () => {
    const result = parseSSEChunk('   \n  ');
    expect(result).toBeNull();
  });

  test('should parse Anthropic-style SSE', () => {
    const chunk = 'data: {"delta":{"text":"Hi"}}\n\n';
    const result = parseSSEChunk(chunk);

    expect(result).toBe('Hi');
  });

  test('should handle [DONE] marker', () => {
    const chunk = 'data: [DONE]\n\n';
    const result = parseSSEChunk(chunk);

    expect(result).toBeNull();
  });

  test('should parse generic text field', () => {
    const chunk = 'data: {"text":"Test message"}\n\n';
    const result = parseSSEChunk(chunk);

    expect(result).toBe('Test message');
  });
});
