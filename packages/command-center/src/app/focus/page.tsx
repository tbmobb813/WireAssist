'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Project {
  id: string;
  name: string;
  lane: string;
  status: string;
  resumeNote: string | null;
}

export default function FocusPage() {
  const router = useRouter();
  const [active, setActive] = useState<Project[]>([]);
  const [paused, setPaused] = useState<Project[]>([]);
  const [isoWeek, setIsoWeek] = useState('');
  const [productProjectId, setProductProjectId] = useState('');
  const [careerMilestone, setCareerMilestone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [t, p] = await Promise.all([
        fetch('/api/portfolio/today').then((r) => r.json()),
        fetch('/api/portfolio/projects?status=paused').then((r) => r.json()),
      ]);
      setIsoWeek(t.isoWeek);
      setActive(t.active ?? []);
      setPaused(p.projects ?? []);
      if (t.focus) {
        setProductProjectId(t.focus.productProjectId);
        setCareerMilestone(t.focus.careerMilestone);
      } else if (t.active?.length === 1) {
        setProductProjectId(t.active[0].id);
      }
    })().catch(() => setError('API unreachable — is the command-center API running?'));
  }, []);

  async function activate(id: string) {
    setError(null);
    const res = await fetch(`/api/portfolio/projects/${id}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'active' }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Transition failed');
      return;
    }
    const t = await fetch('/api/portfolio/today').then((r) => r.json());
    setActive(t.active ?? []);
    setPaused((prev) => prev.filter((p) => p.id !== id));
  }

  async function submit() {
    setError(null);
    if (!productProjectId || !careerMilestone.trim()) {
      setError('Pick one active project and write one career milestone. That is the whole point.');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/portfolio/focus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productProjectId, careerMilestone: careerMilestone.trim() }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to set focus');
      return;
    }
    router.push('/');
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">Pick this week&apos;s focus</h1>
      <p className="mt-2 text-sm opacity-70">
        {isoWeek || '…'} — one product, one career milestone. The dashboard stays locked until you
        choose.
      </p>

      <section className="mt-8">
        <h2 className="text-sm uppercase tracking-wide opacity-60">Product focus (active only)</h2>
        <div className="mt-3 space-y-2">
          {active.map((p) => (
            <label
              key={p.id}
              className={`flex cursor-pointer items-center gap-3 rounded border p-3 ${
                productProjectId === p.id ? 'border-white' : 'border-white/20'
              }`}
            >
              <input
                type="radio"
                name="product"
                checked={productProjectId === p.id}
                onChange={() => setProductProjectId(p.id)}
              />
              <span>
                {p.name} <span className="opacity-50">({p.lane})</span>
              </span>
            </label>
          ))}
          {active.length === 0 && (
            <p className="text-sm opacity-70">
              No active projects. Activate one below (WIP limit: 2).
            </p>
          )}
        </div>

        {paused.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm opacity-60">
              Paused ({paused.length}) — activate to make eligible
            </summary>
            <div className="mt-2 space-y-2">
              {paused.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded border border-white/10 p-3"
                >
                  <span>
                    {p.name}
                    {p.resumeNote && (
                      <span className="block text-xs opacity-50">{p.resumeNote}</span>
                    )}
                  </span>
                  <button
                    onClick={() => activate(p.id)}
                    className="rounded border border-white/30 px-3 py-1 text-sm hover:bg-white/10"
                  >
                    Activate
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm uppercase tracking-wide opacity-60">Career milestone</h2>
        <input
          value={careerMilestone}
          onChange={(e) => setCareerMilestone(e.target.value)}
          placeholder="e.g. Submit 1 DC-tech application; Messer sections 2.1–2.4"
          className="mt-3 w-full rounded border border-white/20 bg-transparent p-3 outline-none focus:border-white"
        />
      </section>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <button
        onClick={submit}
        disabled={saving}
        className="mt-8 w-full rounded bg-white p-3 font-bold text-black disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Lock in the week'}
      </button>
    </main>
  );
}
