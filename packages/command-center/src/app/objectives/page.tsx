'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

type ObjectiveStatus = 'active' | 'paused' | 'completed';

interface Objective {
  id: string;
  title: string;
  description: string | null;
  status: ObjectiveStatus;
  createdAt: number;
  updatedAt: number;
}

const STATUS_COLOR: Record<ObjectiveStatus, string> = {
  active: '#00ff9d',
  paused: '#ffb347',
  completed: '#4fc3f7',
};

const STATUS_LABEL: Record<ObjectiveStatus, string> = {
  active: 'ACTIVE',
  paused: 'PAUSED',
  completed: 'COMPLETED',
};

const STATUS_FILTERS: (ObjectiveStatus | 'all')[] = ['all', 'active', 'paused', 'completed'];

export default function ObjectivesPage() {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [filter, setFilter] = useState<ObjectiveStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((status: ObjectiveStatus | 'all') => {
    setLoading(true);
    const query = status === 'all' ? '' : `?status=${status}`;
    fetch(`/api/objectives${query}`)
      .then((r) => r.json())
      .then((d) => Array.isArray(d.objectives) && setObjectives(d.objectives))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  const createObjective = async () => {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/objectives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      setTitle('');
      setDescription('');
      load(filter);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the API');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="text-xs tracking-widest text-accent mb-2">WIREASSIST // OBJECTIVES</div>
        <h1 className="text-3xl font-black">OBJECTIVES</h1>
        <p className="text-gray-500 text-sm mt-2">
          Shared outcomes any agent&apos;s tasks can tag into — see who&apos;s working toward what.
        </p>
      </div>

      <div
        className="rounded-lg border p-5 mb-5"
        style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
      >
        <div className="text-xs tracking-widest text-gray-500 mb-3">NEW OBJECTIVE</div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title — e.g. Launch StatusWatch v2"
          className="w-full rounded px-3 py-2 text-sm mb-3 outline-none"
          style={{ background: '#080810', border: '1px solid #1e2040', color: '#e2e8f0' }}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="w-full rounded px-3 py-2 text-sm mb-3 outline-none resize-none"
          style={{ background: '#080810', border: '1px solid #1e2040', color: '#e2e8f0' }}
        />
        <button
          onClick={createObjective}
          disabled={creating || !title.trim()}
          className="w-full py-2 rounded text-xs font-bold tracking-widest transition-colors"
          style={{
            background: creating || !title.trim() ? '#1e2040' : '#4fc3f720',
            border: `1px solid ${creating || !title.trim() ? '#1e2040' : '#4fc3f740'}`,
            color: creating || !title.trim() ? '#475569' : '#4fc3f7',
            cursor: creating || !title.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {creating ? 'CREATING...' : '→ CREATE OBJECTIVE'}
        </button>
      </div>

      {error && (
        <div
          className="rounded-lg border p-4 mb-5 text-sm"
          style={{ background: '#2a0f0f', borderColor: '#f0525240', color: '#f87171' }}
        >
          {error}
        </div>
      )}

      <div className="flex gap-2 mb-5">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className="text-xs px-3 py-1.5 rounded tracking-widest transition-colors"
            style={{
              background: filter === s ? '#4fc3f720' : 'transparent',
              border: `1px solid ${filter === s ? '#4fc3f740' : '#1e2040'}`,
              color: filter === s ? '#4fc3f7' : '#64748b',
            }}
          >
            {s.toUpperCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-xs text-gray-600">Loading...</p>
      ) : objectives.length === 0 ? (
        <p className="text-xs text-gray-600">No objectives yet.</p>
      ) : (
        <div className="space-y-2">
          {objectives.map((o) => (
            <Link
              key={o.id}
              href={`/objectives/${o.id}`}
              className="block rounded-lg border p-4 transition-colors hover:border-accent/40"
              style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
            >
              <div className="flex items-center justify-between gap-3 mb-1">
                <div className="font-medium text-sm text-gray-200">{o.title}</div>
                <div
                  className="text-[11px] font-medium px-2 py-1 rounded-full flex-shrink-0"
                  style={{
                    color: STATUS_COLOR[o.status],
                    background: `${STATUS_COLOR[o.status]}15`,
                  }}
                >
                  {STATUS_LABEL[o.status]}
                </div>
              </div>
              {o.description && (
                <div className="text-xs text-gray-500 line-clamp-2">{o.description}</div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
