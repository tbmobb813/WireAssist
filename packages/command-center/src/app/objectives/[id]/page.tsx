'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAgentEvents, type AgentEvent } from '@/hooks/useAgentEvents';

type ObjectiveStatus = 'active' | 'paused' | 'completed';
type AgentRole = 'admin' | 'content' | 'research' | 'strategy' | 'gtm';
type RosterStatus = 'idle' | 'running' | 'waiting_approval' | 'error';

interface Objective {
  id: string;
  title: string;
  description: string | null;
  status: ObjectiveStatus;
  createdAt: number;
  updatedAt: number;
}

interface ObjectiveEvent {
  id: string;
  objectiveId: string;
  type: string;
  payload: Record<string, unknown> | null;
  createdAt: number;
}

const STATUS_COLOR: Record<ObjectiveStatus, string> = {
  active: '#00ff9d',
  paused: '#ffb347',
  completed: '#4fc3f7',
};

const ROSTER: { role: AgentRole; name: string; href: string }[] = [
  { role: 'admin', name: 'Admin Agent', href: '/chat' },
  { role: 'content', name: 'Content Agent', href: '/content' },
  { role: 'research', name: 'Research Agent', href: '/research' },
  { role: 'strategy', name: 'NixOps', href: '/ops' },
  { role: 'gtm', name: 'GTM Agent', href: '/gtm' },
];

const rosterStatusColor = (s: RosterStatus) =>
  ({
    idle: '#4fc3f7',
    running: '#00ff9d',
    waiting_approval: '#ffb347',
    error: '#ef4444',
  })[s];

const rosterStatusLabel = (s: RosterStatus) =>
  ({
    idle: 'IDLE',
    running: 'RUNNING',
    waiting_approval: 'NEEDS APPROVAL',
    error: 'ERROR',
  })[s];

interface RosterEntry {
  status: RosterStatus;
  lastDescription: string | null;
  lastAt: number | null;
}

function emptyRoster(): Record<AgentRole, RosterEntry> {
  return {
    admin: { status: 'idle', lastDescription: null, lastAt: null },
    content: { status: 'idle', lastDescription: null, lastAt: null },
    research: { status: 'idle', lastDescription: null, lastAt: null },
    strategy: { status: 'idle', lastDescription: null, lastAt: null },
    gtm: { status: 'idle', lastDescription: null, lastAt: null },
  };
}

// Folds a chronological (oldest-first) list of agent.* events into a
// per-role current status — same status transitions dashboard-client.tsx's
// Workforce panel uses (task_started -> running, task_complete -> idle,
// task_failed -> error, waiting_approval -> waiting_approval), just scoped
// to one objective instead of global.
function foldRoster(events: ObjectiveEvent[]): Record<AgentRole, RosterEntry> {
  const roster = emptyRoster();
  for (const e of events) {
    const type = e.type.startsWith('agent.') ? e.type.slice('agent.'.length) : e.type;
    const payload = e.payload as {
      agentRole?: AgentRole;
      description?: string;
      error?: string;
    } | null;
    const role = payload?.agentRole;
    if (!role || !(role in roster)) continue;

    if (type === 'task_started') {
      roster[role] = {
        status: 'running',
        lastDescription: payload?.description ?? roster[role].lastDescription,
        lastAt: e.createdAt,
      };
    } else if (type === 'task_complete') {
      roster[role] = { ...roster[role], status: 'idle', lastAt: e.createdAt };
    } else if (type === 'task_failed') {
      roster[role] = {
        status: 'error',
        lastDescription: payload?.error ?? roster[role].lastDescription,
        lastAt: e.createdAt,
      };
    } else if (type === 'waiting_approval') {
      roster[role] = { ...roster[role], status: 'waiting_approval', lastAt: e.createdAt };
    }
  }
  return roster;
}

function describeEvent(e: ObjectiveEvent): string {
  const type = e.type.startsWith('agent.') ? e.type.slice('agent.'.length) : e.type;
  const payload = e.payload as {
    agentRole?: string;
    description?: string;
    error?: string;
    action?: string;
    to?: string;
  } | null;
  switch (e.type) {
    case 'objective.created':
      return 'Objective created';
    case 'objective.transitioned':
      return `Status changed to ${payload?.to ?? 'unknown'}`;
  }
  switch (type) {
    case 'task_started':
      return `${payload?.agentRole ?? 'agent'} started: ${payload?.description ?? ''}`;
    case 'task_complete':
      return `${payload?.agentRole ?? 'agent'} completed a task`;
    case 'task_failed':
      return `${payload?.agentRole ?? 'agent'} failed: ${payload?.error ?? ''}`;
    case 'waiting_approval':
      return `${payload?.agentRole ?? 'agent'} waiting on approval: ${payload?.action ?? ''}`;
    case 'approval_resolved':
      return `${payload?.agentRole ?? 'agent'} approval resolved`;
    default:
      return type;
  }
}

export default function ObjectiveDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [objective, setObjective] = useState<Objective | null>(null);
  const [events, setEvents] = useState<ObjectiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/objectives/${id}`)
      .then((r) => {
        if (r.status === 404) {
          setNotFound(true);
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        setObjective(d.objective);
        setEvents(Array.isArray(d.events) ? d.events : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleLiveEvent = useCallback(
    (e: AgentEvent) => {
      if (e.event === 'connected') return;
      const payload = e.payload as { objectiveId?: string };
      if (payload?.objectiveId !== id) return;
      setEvents((prev) => [
        {
          id: `live:${Date.now()}:${Math.random()}`,
          objectiveId: id,
          type: `agent.${e.event}`,
          payload: payload as Record<string, unknown>,
          createdAt: Date.now(),
        },
        ...prev,
      ]);
    },
    [id]
  );
  useAgentEvents(handleLiveEvent);

  const roster = useMemo(() => foldRoster([...events].reverse()), [events]);
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => b.createdAt - a.createdAt),
    [events]
  );

  const transition = async (to: ObjectiveStatus) => {
    if (!id) return;
    setTransitioning(true);
    try {
      const res = await fetch(`/api/objectives/${id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to }),
      });
      // Transitions are recorded server-side but don't flow through the
      // agent EventBus/SSE (only agent:* events do) — refetch to pick up
      // the objective.transitioned event the API just appended.
      if (res.ok) {
        const detail = await fetch(`/api/objectives/${id}`).then((r) => r.json());
        setObjective(detail.objective);
        setEvents(Array.isArray(detail.events) ? detail.events : []);
      }
    } finally {
      setTransitioning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-8 max-w-3xl mx-auto">
        <p className="text-xs text-gray-600">Loading...</p>
      </div>
    );
  }

  if (notFound || !objective) {
    return (
      <div className="min-h-screen p-8 max-w-3xl mx-auto">
        <Link
          href="/objectives"
          className="text-xs text-gray-600 hover:text-accent tracking-widest"
        >
          ← OBJECTIVES
        </Link>
        <p className="text-sm text-gray-500 mt-6">Objective not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link
          href="/objectives"
          className="text-xs text-gray-600 hover:text-accent tracking-widest"
        >
          ← OBJECTIVES
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="text-xs tracking-widest text-accent">WIREASSIST // OBJECTIVE</div>
          <div
            className="text-[11px] font-medium px-2 py-1 rounded-full flex-shrink-0"
            style={{
              color: STATUS_COLOR[objective.status],
              background: `${STATUS_COLOR[objective.status]}15`,
            }}
          >
            {objective.status.toUpperCase()}
          </div>
        </div>
        <h1 className="text-3xl font-black">{objective.title}</h1>
        {objective.description && (
          <p className="text-gray-500 text-sm mt-2">{objective.description}</p>
        )}
      </div>

      <div className="flex gap-2 mb-8">
        {(['active', 'paused', 'completed'] as ObjectiveStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => transition(s)}
            disabled={transitioning || objective.status === s}
            className="text-xs px-3 py-1.5 rounded tracking-widest transition-colors"
            style={{
              background: objective.status === s ? `${STATUS_COLOR[s]}20` : 'transparent',
              border: `1px solid ${objective.status === s ? `${STATUS_COLOR[s]}40` : '#1e2040'}`,
              color: objective.status === s ? STATUS_COLOR[s] : '#64748b',
              cursor: transitioning || objective.status === s ? 'not-allowed' : 'pointer',
            }}
          >
            {s.toUpperCase()}
          </button>
        ))}
      </div>

      <div
        className="rounded-lg border p-5 mb-5"
        style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
      >
        <div className="text-xs tracking-widest text-gray-500 mb-3">TEAM DIRECTORY</div>
        <div className="space-y-2">
          {ROSTER.map(({ role, name, href }) => {
            const entry = roster[role];
            return (
              <Link
                key={role}
                href={href}
                className="flex items-center justify-between rounded-lg px-4 py-3 border transition-colors hover:border-accent/40"
                style={{ background: '#080810', borderColor: '#1e2040' }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: rosterStatusColor(entry.status) }}
                  />
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-gray-200">{name}</div>
                    <div className="text-xs text-gray-600 truncate max-w-xs">
                      {entry.lastDescription ?? 'No activity on this objective yet'}
                    </div>
                  </div>
                </div>
                <div
                  className="text-[11px] font-medium px-2 py-1 rounded-full flex-shrink-0"
                  style={{
                    color: rosterStatusColor(entry.status),
                    background: `${rosterStatusColor(entry.status)}15`,
                  }}
                >
                  {rosterStatusLabel(entry.status)}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div
        className="rounded-lg border p-5"
        style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
      >
        <div className="text-xs tracking-widest text-gray-500 mb-3">ACTIVITY</div>
        {sortedEvents.length === 0 ? (
          <p className="text-xs text-gray-600">No activity yet.</p>
        ) : (
          <div className="space-y-2">
            {sortedEvents.map((e) => (
              <div
                key={e.id}
                className="rounded px-3 py-2 text-xs text-gray-400"
                style={{ background: '#080810', border: '1px solid #1e2040' }}
              >
                {describeEvent(e)}
                <span className="text-gray-600 ml-2">{new Date(e.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
