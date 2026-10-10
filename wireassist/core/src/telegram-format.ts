// Telegram "Markdown" (legacy) treats _ * ` [ as formatting. Model-written and
// error text is full of them — BRAVE_API_KEY arrived as "BRAVEAPIKEY" because
// the underscores were read as italics — so any text we did not write ourselves
// is escaped before it goes into a Markdown message. Telegram removes the
// backslash and shows the character.
export const escapeMarkdown = (text: string): string => text.replace(/([_*`[])/g, '\\$1');

type FetchFn = typeof fetch;

export interface SendOptions {
  apiBase: string; // https://api.telegram.org/bot<token>
  chatId: string;
  text: string;
  fetchFn?: FetchFn;
  onError?: (message: string) => void;
}

async function post(
  { apiBase, chatId, text }: SendOptions,
  fetchFn: FetchFn,
  parseMode?: 'Markdown'
): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetchFn(`${apiBase}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(parseMode ? { parse_mode: parseMode } : {}),
      }),
    });
    if (res.ok) return { ok: true, detail: '' };
    // Telegram answers HTTP 400 with a description such as "can't parse entities".
    const body = (await res.json().catch(() => ({}))) as { description?: string };
    return { ok: false, detail: `HTTP ${res.status} ${body.description ?? ''}`.trim() };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

// Sends as Markdown, and if Telegram rejects it (a stray _ or * we did not
// escape) resends the same text as plain text, so a message is never silently
// dropped over formatting. Returns whether anything was delivered.
export async function sendMessage(opts: SendOptions): Promise<boolean> {
  const fetchFn = opts.fetchFn ?? fetch;
  const report = opts.onError ?? (() => undefined);

  const formatted = await post(opts, fetchFn, 'Markdown');
  if (formatted.ok) return true;
  report(`sendMessage as Markdown failed (${formatted.detail}); resending as plain text`);

  // Plain text has no escapes, so drop the backslashes escapeMarkdown() added.
  const plain = await post({ ...opts, text: opts.text.replace(/\\([_*`[])/g, '$1') }, fetchFn);
  if (plain.ok) return true;
  report(`sendMessage failed (${plain.detail})`);
  return false;
}
