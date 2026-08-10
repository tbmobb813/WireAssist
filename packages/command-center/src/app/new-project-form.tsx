'use client';

// Inline "create a project" form, shared by the /focus gate (where a brand
// new instance has nothing to pick from) and the dashboard's portfolio
// zones (for adding projects later without leaving the page).
import { useState } from 'react';

const LANES = ['product', 'career', 'client', 'personal'] as const;
type Lane = (typeof LANES)[number];

export default function NewProjectForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [lane, setLane] = useState<Lane>('product');
  const [startActive, setStartActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/portfolio/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        lane,
        status: startActive ? 'active' : 'paused',
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to create project');
      return;
    }
    setName('');
    setLane('product');
    setStartActive(true);
    setOpen(false);
    onCreated();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded border border-white/30 px-3 py-2 text-sm hover:bg-white/10"
      >
        + New project
      </button>
    );
  }

  return (
    <div className="rounded border border-white/20 p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name"
          autoFocus
          className="rounded border border-white/20 bg-transparent p-2 text-sm outline-none focus:border-white"
        />
        <select
          value={lane}
          onChange={(e) => setLane(e.target.value as Lane)}
          className="rounded border border-white/20 bg-transparent p-2 text-sm outline-none focus:border-white"
        >
          {LANES.map((l) => (
            <option key={l} value={l} className="bg-black">
              {l}
            </option>
          ))}
        </select>
      </div>
      <label className="mt-3 flex items-center gap-2 text-xs opacity-70">
        <input
          type="checkbox"
          checked={startActive}
          onChange={(e) => setStartActive(e.target.checked)}
        />
        Start active (subject to the WIP limit of 2 active projects)
      </label>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={submit}
          disabled={saving}
          className="rounded bg-white px-3 py-1.5 text-xs font-bold text-black disabled:opacity-50"
        >
          {saving ? 'Creating…' : 'Create'}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="rounded border border-white/30 px-3 py-1.5 text-xs hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
