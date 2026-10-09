'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarReviewDetail,
  FreeformResponseDetail,
  TriageDetail,
} from '../dashboard-activity-tile';

interface HistoryTask {
  id: string;
  agentRole: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  output?: Record<string, unknown>;
  error?: string;
}

const STATUS_COLOR: Record<string, string> = {
  complete: '#00ff9d',
  approved: '#00ff9d',
  failed: '#ef4444',
  rejected: '#ef4444',
  running: '#4fc3f7',
  queued: '#94a3b8',
  awaiting_approval: '#ffb347',
};

const FETCH_LIMIT = 200;

// Saved results are keyed by shape, not by event name, because the database
// keeps only the payload — the same payloads the dashboard feed renders live.
function OutputDetail({ output }: { output: Record<string, unknown> }) {
  if (output.categories) return <TriageDetail payload={output} />;
  if (output.review || Array.isArray(output.events)) {
    return <CalendarReviewDetail payload={output} />;
  }
  if (typeof output.response === 'string') return <FreeformResponseDetail payload={output} />;
  return (
    <pre
      className="text-xs text-gray-400 rounded p-3 overflow-x-auto whitespace-pre-wrap"
      style={{ background: '#080810', border: '1px solid #1e2040' }}
    >
      {JSON.stringify(output, null, 2)}
    </pre>
  );
}

function summaryLine(output?: Record<string, unknown>): string | undefined {
  if (!output) return undefined;
  return typeof output.summary === 'string' ? output.summary : undefined;
}

export default function HistoryClient() {
  const [tasks, setTasks] = useState<HistoryTask[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [agent, setAgent] = useState('all');
  const [open, setOpen] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks?limit=${FETCH_LIMIT}`);
      if (!res.ok) throw new Error(String(res.status));
      setTasks((await res.json()) as HistoryTask[]);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const agents = useMemo(
    () => ['all', ...Array.from(new Set((tasks ?? []).map((t) => t.agentRole))).sort()],
    [tasks]
  );
  const shown = (tasks ?? []).filter((t) => agent === 'all' || t.agentRole === agent);

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="mb-6">
        <div className="text-xs tracking-widest text-accent mb-1">WIREASSIST // HISTORY</div>
        <h1 className="text-3xl font-black">History</h1>
        <p className="text-gray-500 text-sm mt-2">
          Everything the agents have run, with the saved result. Tap a row to read it.
        </p>
      </div>

      {tasks && tasks.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {agents.map((a) => (
            <button
              key={a}
              onClick={() => setAgent(a)}
              className="text-xs px-3 py-1.5 rounded-full border"
              style={{
                borderColor: agent === a ? '#4fc3f7' : '#1e2040',
                color: agent === a ? '#4fc3f7' : '#94a3b8',
                background: agent === a ? '#4fc3f720' : 'transparent',
              }}
            >
              {a}
            </button>
          ))}
        </div>
      )}

      {loadError ? (
        <div className="text-sm text-red-400">
          Couldn&apos;t load history.{' '}
          <button className="underline" onClick={load}>
            Try again
          </button>
        </div>
      ) : tasks === null ? (
        <div className="text-gray-400 text-sm">Loading...</div>
      ) : shown.length === 0 ? (
        <div
          className="rounded-lg border p-10 text-center text-sm text-gray-500"
          style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
        >
          Nothing here yet. Run a task from the dashboard and it will show up.
        </div>
      ) : (
        <div
          className="rounded-lg border divide-y"
          style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
        >
          {shown.map((t) => {
            const expanded = open.has(t.id);
            const summary = summaryLine(t.output);
            return (
              <div key={t.id} style={{ borderColor: '#1e2040' }}>
                <button
                  onClick={() => toggle(t.id)}
                  aria-expanded={expanded}
                  className="w-full text-left px-4 py-3 hover:bg-white/5 flex flex-col gap-1"
                >
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-gray-500">{new Date(t.updatedAt).toLocaleString()}</span>
                    <span className="tracking-widest text-gray-400">
                      {t.agentRole.toUpperCase()}
                    </span>
                    <span style={{ color: STATUS_COLOR[t.status] ?? '#64748b' }}>
                      {t.status.replace('_', ' ')}
                    </span>
                    <span className="ml-auto opacity-40">{expanded ? '▾' : '▸'}</span>
                  </div>
                  <div className="text-sm text-gray-200 break-words">{t.description}</div>
                  {summary && !expanded && (
                    <div className="text-xs text-gray-500 line-clamp-2">{summary}</div>
                  )}
                </button>
                {expanded && (
                  <div className="px-4 pb-4 space-y-3">
                    {summary && <p className="text-sm text-gray-300">{summary}</p>}
                    {t.error && <p className="text-sm text-red-400 break-words">{t.error}</p>}
                    {t.output ? (
                      <OutputDetail output={t.output} />
                    ) : (
                      !t.error && (
                        <p className="text-xs text-gray-500">
                          No result was saved for this run (it may still be running, or it produced
                          nothing to keep).
                        </p>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tasks && tasks.length >= FETCH_LIMIT && (
        <p className="text-xs text-gray-600 mt-3">Showing the {FETCH_LIMIT} most recent runs.</p>
      )}
    </div>
  );
}
