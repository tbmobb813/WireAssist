import { escapeMarkdown, sendMessage } from '../../telegram-format';

type Call = { url: string; body: { chat_id: string; text: string; parse_mode?: string } };

// A fake Telegram: answers each call with the next status in `statuses` and records what was sent.
function fakeTelegram(statuses: number[]) {
  const calls: Call[] = [];
  const fetchFn = (async (url: string, init: { body: string }) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    const status = statuses[calls.length - 1] ?? 200;
    return new Response(
      JSON.stringify(
        status === 200 ? { ok: true } : { ok: false, description: "can't parse entities" }
      ),
      { status }
    );
  }) as unknown as typeof fetch;
  return { calls, fetchFn };
}

const base = { apiBase: 'https://api.telegram.org/botX', chatId: '42' };

describe('escapeMarkdown', () => {
  it('escapes the characters Telegram Markdown treats as formatting', () => {
    expect(escapeMarkdown('BRAVE_API_KEY is not set')).toBe('BRAVE\\_API\\_KEY is not set');
    expect(escapeMarkdown('**bold** `code` [link]')).toBe('\\*\\*bold\\*\\* \\`code\\` \\[link]');
  });

  it('leaves ordinary text, emoji and URLs without formatting characters alone', () => {
    const text = '🧠 Brooklyn news: https://gothamist.com/ — 86.5°F';
    expect(escapeMarkdown(text)).toBe(text);
  });
});

describe('sendMessage', () => {
  it('sends once as Markdown when Telegram accepts it', async () => {
    const { calls, fetchFn } = fakeTelegram([200]);
    expect(await sendMessage({ ...base, text: '*hi*', fetchFn })).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.telegram.org/botX/sendMessage');
    expect(calls[0].body).toMatchObject({ chat_id: '42', text: '*hi*', parse_mode: 'Markdown' });
  });

  it('resends as plain text when Telegram rejects the Markdown, so nothing is dropped', async () => {
    const { calls, fetchFn } = fakeTelegram([400, 200]);
    const errors: string[] = [];
    const ok = await sendMessage({
      ...base,
      text: 'a_b and *unclosed',
      fetchFn,
      onError: (m) => errors.push(m),
    });
    expect(ok).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[1].body.parse_mode).toBeUndefined();
    expect(errors[0]).toMatch(/resending as plain text/);
    expect(errors[0]).toMatch(/can't parse entities/);
  });

  it('drops the escape backslashes in the plain-text resend', async () => {
    const { calls, fetchFn } = fakeTelegram([400, 200]);
    await sendMessage({ ...base, text: escapeMarkdown('BRAVE_API_KEY'), fetchFn });
    expect(calls[0].body.text).toBe('BRAVE\\_API\\_KEY');
    expect(calls[1].body.text).toBe('BRAVE_API_KEY');
  });

  it('reports failure, and says why, when both attempts fail', async () => {
    const { fetchFn } = fakeTelegram([400, 400]);
    const errors: string[] = [];
    expect(await sendMessage({ ...base, text: 'x', fetchFn, onError: (m) => errors.push(m) })).toBe(
      false
    );
    expect(errors).toHaveLength(2);
    expect(errors[1]).toMatch(/sendMessage failed \(HTTP 400/);
  });

  it('treats a network error like a rejection and still tries plain text', async () => {
    let n = 0;
    const fetchFn = (async () => {
      n += 1;
      if (n === 1) throw new TypeError('fetch failed');
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    expect(await sendMessage({ ...base, text: 'x', fetchFn })).toBe(true);
    expect(n).toBe(2);
  });
});
