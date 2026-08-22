import { ResponseBuffer } from '../../streaming/buffer';

describe('ResponseBuffer', () => {
  test('should create a buffer', () => {
    const buffer = new ResponseBuffer();
    expect(buffer).toBeDefined();
  });

  test('should append text', () => {
    const buffer = new ResponseBuffer();
    buffer.append('Hello ');
    buffer.append('World');

    expect(buffer.toString()).toBe('Hello World');
  });

  test('should get current size', () => {
    const buffer = new ResponseBuffer();
    buffer.append('Hello');

    expect(buffer.getSize()).toBe(5);
  });

  test('should clear buffer', () => {
    const buffer = new ResponseBuffer();
    buffer.append('Test');
    buffer.clear();

    expect(buffer.toString()).toBe('');
    expect(buffer.getSize()).toBe(0);
  });

  test('should handle empty buffer', () => {
    const buffer = new ResponseBuffer();

    expect(buffer.toString()).toBe('');
    expect(buffer.getSize()).toBe(0);
    expect(buffer.isEmpty()).toBe(true);
  });

  test('should handle multiple appends', () => {
    const buffer = new ResponseBuffer();

    for (let i = 0; i < 5; i++) {
      buffer.append(`Part ${i} `);
    }

    expect(buffer.toString()).toBe('Part 0 Part 1 Part 2 Part 3 Part 4 ');
  });
});
