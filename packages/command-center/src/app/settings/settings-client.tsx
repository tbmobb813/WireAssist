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

interface WeatherSettings {
  location: { lat: number; lon: number; label: string } | null;
  units: 'imperial' | 'metric';
}

// The one saved location the dashboard weather chip and the assistant's
// weather answers both use. The city is looked up on Save (server-side), so a
// typo comes back as a readable error and a success says which place it chose.
function WeatherCard() {
  const [saved, setSaved] = useState<WeatherSettings | null>(null);
  const [location, setLocation] = useState('');
  const [units, setUnits] = useState<'imperial' | 'metric'>('imperial');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/settings/weather')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: WeatherSettings) => {
        setSaved(data);
        setLocation(data.location?.label ?? '');
        setUnits(data.units);
      })
      .catch(() => setMessage({ ok: false, text: 'Could not load weather settings.' }));
  }, []);

  const savedLabel = saved?.location?.label ?? '';
  const locationChanged = saved !== null && location.trim() !== savedLabel;
  const dirty = saved !== null && (locationChanged || units !== saved.units);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      // Only send the city when it was edited, so changing just the units
      // never triggers (or can fail on) a fresh lookup.
      const res = await fetch('/api/settings/weather', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(locationChanged ? { location: location.trim() } : {}),
          units,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Server said no (${res.status})`);
      const next = data as WeatherSettings;
      setSaved(next);
      setLocation(next.location?.label ?? '');
      setUnits(next.units);
      setMessage({
        ok: true,
        text: next.location ? `Saved — using ${next.location.label}.` : 'Saved — no location set.',
      });
    } catch (err) {
      setMessage({
        ok: false,
        text: err instanceof Error ? err.message : 'Could not save. Try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-2xl border p-6 max-w-2xl mt-6"
      style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
    >
      <div className="text-sm font-semibold text-gray-300">Weather</div>
      <p className="text-sm text-gray-500 mt-2">
        Your location, used for the weather on the dashboard and whenever you ask the assistant
        about the weather without naming a place. A city works best, like &quot;Austin, TX&quot; or
        &quot;Berlin&quot;.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && dirty && !busy && save()}
          placeholder="Your city"
          aria-label="Your location"
          maxLength={100}
          disabled={!saved}
          className="flex-1 rounded-lg px-3 py-2 text-sm bg-transparent border text-gray-200"
          style={{ borderColor: '#1e2040' }}
        />
        <select
          value={units}
          onChange={(e) => setUnits(e.target.value as 'imperial' | 'metric')}
          aria-label="Units"
          disabled={!saved}
          className="rounded-lg px-3 py-2 text-sm border text-gray-200"
          style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
        >
          <option value="imperial">°F · mph</option>
          <option value="metric">°C · km/h</option>
        </select>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || busy}
          className="rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-40"
          style={{ background: '#00ff9d20', border: '1px solid #00ff9d40', color: '#00ff9d' }}
        >
          {busy ? '...' : 'Save'}
        </button>
      </div>

      <div className="mt-3 text-sm" aria-live="polite">
        {message && (
          <span style={{ color: message.ok ? '#00ff9d' : '#ef4444' }}>{message.text}</span>
        )}
        {!message && saved && !saved.location && (
          <span className="text-gray-500">
            No location saved — the assistant will ask each time.
          </span>
        )}
      </div>
    </div>
  );
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

      <WeatherCard />

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
