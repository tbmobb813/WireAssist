'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface Diagnostics {
  rawCapture: boolean;
  expiresAt: string | null;
  windowMinutes: number;
}

function minutesLeft(expiresAt: string | null, now: number): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 60_000));
}

export default function SettingsClient() {
  const [diag, setDiag] = useState<Diagnostics | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ticks so the "minutes left" label counts down, and flips to Off by itself
  // when the server-side window ends, without needing a page refresh.
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/diagnostics');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDiag((await res.json()) as Diagnostics);
      setError(null);
    } catch {
      setError('Could not load this setting. Is the server running?');
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [load]);

  const on = Boolean(diag?.rawCapture) && minutesLeft(diag?.expiresAt ?? null, now) > 0;

  const toggle = async () => {
    if (!diag || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/settings/diagnostics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawCapture: !on }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDiag((await res.json()) as Diagnostics);
      setNow(Date.now());
      setError(null);
    } catch {
      setError('Could not change this setting. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="text-xs tracking-widest text-purple mb-2">WIREASSIST // SETTINGS</div>
        <h1 className="text-3xl font-black">SETTINGS</h1>
        <p className="text-gray-500 text-sm mt-2">Options that change how the app behaves.</p>
      </div>

      <div
        className="rounded-2xl border p-6 max-w-2xl"
        style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
      >
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-sm font-semibold text-gray-300">Diagnostic logging</div>
            <p className="text-sm text-gray-500 mt-2">
              When something fails, the app normally logs only what happened — never the text the AI
              wrote, because that can include your email subjects and senders. Turn this on to
              capture that text so a problem can be diagnosed, then turn it off.
            </p>
            <p className="text-xs text-gray-600 mt-2">
              It switches itself off after {diag?.windowMinutes ?? 30} minutes.
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label="Diagnostic logging"
            disabled={!diag || saving}
            onClick={toggle}
            className="shrink-0 relative h-7 w-12 rounded-full transition-colors disabled:opacity-50"
            style={{ background: on ? '#00ff9d' : '#1e2040' }}
          >
            <span
              className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all"
              style={{ left: on ? '1.5rem' : '0.25rem' }}
            />
          </button>
        </div>

        <div className="mt-4 text-sm" aria-live="polite">
          {!diag && !error && <span className="text-gray-600">Loading…</span>}
          {diag && on && (
            <span style={{ color: '#ffb347' }}>
              On — {minutesLeft(diag.expiresAt, now)} min left. Raw AI replies that fail to parse
              are being written to the server log.
            </span>
          )}
          {diag && !on && <span className="text-gray-500">Off</span>}
          {error && <span style={{ color: '#ef4444' }}>{error}</span>}
        </div>
      </div>

      <div
        className="rounded-2xl border p-6 max-w-2xl mt-6"
        style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
      >
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-sm font-semibold text-gray-300">Agent memory</div>
            <p className="text-sm text-gray-500 mt-2">
              The short notes your agents keep and look up before a task, like contacts and past
              decisions. Review or delete them here. Past results live in History.
            </p>
          </div>
          <Link href="/memory" className="shrink-0 text-sm text-accent hover:underline">
            Manage →
          </Link>
        </div>
      </div>
    </div>
  );
}
