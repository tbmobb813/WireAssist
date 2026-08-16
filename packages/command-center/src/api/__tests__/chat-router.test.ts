import { buildRouterMessages, type ChatHistoryMessage } from '../chat-router';

describe('buildRouterMessages()', () => {
  it('returns just the instruction as a single user turn when no history is given', () => {
    expect(buildRouterMessages(undefined, 'hello')).toEqual([{ role: 'user', content: 'hello' }]);
  });

  it('returns just the instruction when history is an empty array', () => {
    expect(buildRouterMessages([], 'hello')).toEqual([{ role: 'user', content: 'hello' }]);
  });

  it('maps history turns in order and appends the instruction as the final user turn', () => {
    const history: ChatHistoryMessage[] = [
      { role: 'user', content: 'what is on my calendar today?' },
      { role: 'assistant', content: 'You have two meetings.' },
    ];

    expect(buildRouterMessages(history, 'what about tomorrow?')).toEqual([
      { role: 'user', content: 'what is on my calendar today?' },
      { role: 'assistant', content: 'You have two meetings.' },
      { role: 'user', content: 'what about tomorrow?' },
    ]);
  });

  it('caps history to the most recent 20 entries', () => {
    const history: ChatHistoryMessage[] = Array.from({ length: 25 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `turn ${i}`,
    }));

    const result = buildRouterMessages(history, 'latest');

    // 20 history entries + the final instruction turn.
    expect(result).toHaveLength(21);
    expect(result[0]).toEqual({ role: 'assistant', content: 'turn 5' });
    expect(result[result.length - 1]).toEqual({ role: 'user', content: 'latest' });
  });
});
