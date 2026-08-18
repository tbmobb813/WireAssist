'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAgentEvents, type AgentEvent } from '@/hooks/useAgentEvents';
import {
  foldRoster,
  foldTasks,
  describeEvent,
  type ObjectiveStatus,
  type AgentRole,
  type RosterStatus,
  type Objective,
  type ObjectiveEvent,
  type KanbanColumn,
  type KanbanCard,
} from '@/lib/objective-events';

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
  { role: 'github', name: 'GitHub Dev Agent', href: '/github' },
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

const roleName = (role: AgentRole) => ROSTER.find((r) => r.role === role)?.name ?? role;

const COLUMNS: KanbanColumn[] = ['todo', 'in_progress', 'review', 'done'];
const COLUMN_LABEL: Record<KanbanColumn, string> = {
  todo: 'TODO',
  in_progress: 'IN PROGRESS',
  review: 'REVIEW',
  done: 'DONE',
};

export default function ObjectiveDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [objective, setObjective] = useState<Objective | null>(null);
  const [events, setEvents] = useState<ObjectiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [newCardText, setNewCardText] = useState('');
  const [addingCard, setAddingCard] = useState(false);
  const [movingCardId, setMovingCardId] = useState<string | null>(null);

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
      // manual_card_* events are objective-native (written directly via
      // recordAgentEvent with an objective. prefix), not agent-bus-sourced
      // — everything else keeps the agent. prefix broadcast() applies.
      const type =
        e.event === 'manual_card_created'
          ? 'objective.manual_task_created'
          : e.event === 'manual_card_moved'
            ? 'objective.manual_task_moved'
            : `agent.${e.event}`;
      setEvents((prev) => [
        {
          id: `live:${Date.now()}:${Math.random()}`,
          objectiveId: id,
          type,
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
  const cards = useMemo(() => foldTasks([...events].reverse()), [events]);
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

  const addCard = async () => {
    if (!id || !newCardText.trim() || addingCard) return;
    setAddingCard(true);
    try {
      const res = await fetch(`/api/objectives/${id}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newCardText.trim() }),
      });
      if (res.ok) setNewCardText('');
    } finally {
      setAddingCard(false);
    }
  };

  const moveCard = async (cardId: string, to: KanbanColumn) => {
    if (!id || movingCardId) return;
    setMovingCardId(cardId);
    try {
      await fetch(`/api/objectives/${id}/cards/${cardId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to }),
      });
    } finally {
      setMovingCardId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <p className="text-xs text-gray-600">Loading...</p>
      </div>
    );
  }

  if (notFound || !objective) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <p className="text-sm text-gray-500 mt-6">Objective not found.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
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
        <div className="text-xs tracking-widest text-gray-500 mb-3">BOARD</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {COLUMNS.map((column) => {
            const columnCards = cards.filter((card) => card.column === column);
            return (
              <div
                key={column}
                className="rounded p-3"
                style={{ background: '#080810', border: '1px solid #1e2040' }}
              >
                <div className="text-xs tracking-widest text-gray-500 mb-3">
                  {COLUMN_LABEL[column]} {columnCards.length > 0 ? `— ${columnCards.length}` : ''}
                </div>
                <div className="space-y-2">
                  {columnCards.map((card) => (
                    <KanbanCardView
                      key={card.kind === 'agent' ? card.taskId : card.cardId}
                      card={card}
                      moving={movingCardId === (card.kind === 'manual' ? card.cardId : null)}
                      onMove={moveCard}
                    />
                  ))}
                </div>
                {column === 'todo' && (
                  <div className="mt-3 space-y-2">
                    <input
                      type="text"
                      value={newCardText}
                      onChange={(e) => setNewCardText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addCard()}
                      placeholder="+ Add card"
                      className="w-full rounded px-2 py-1.5 text-xs outline-none"
                      style={{
                        background: '#0d0d1a',
                        border: '1px solid #1e2040',
                        color: '#e2e8f0',
                      }}
                    />
                    <button
                      onClick={addCard}
                      disabled={addingCard || !newCardText.trim()}
                      className="w-full py-1.5 rounded text-xs font-bold tracking-widest transition-colors"
                      style={{
                        background: addingCard || !newCardText.trim() ? '#1e2040' : '#4fc3f720',
                        border: `1px solid ${addingCard || !newCardText.trim() ? '#1e2040' : '#4fc3f740'}`,
                        color: addingCard || !newCardText.trim() ? '#475569' : '#4fc3f7',
                        cursor: addingCard || !newCardText.trim() ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {addingCard ? 'ADDING...' : '+ ADD CARD'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
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

function KanbanCardView({
  card,
  moving,
  onMove,
}: {
  card: KanbanCard;
  moving: boolean;
  onMove: (cardId: string, to: KanbanColumn) => void;
}) {
  if (card.kind === 'agent') {
    return (
      <div
        className="rounded p-2.5"
        style={
          card.errored
            ? { background: '#2a0f0f', border: '1px solid #ef444440' }
            : { background: '#0d0d1a', border: '1px solid #1e2040' }
        }
      >
        <div className="text-[10px] tracking-widest text-gray-600 mb-1">
          {roleName(card.agentRole)}
        </div>
        <div className="text-xs text-gray-300">{card.description || '(no description)'}</div>
        {card.errored && card.error && (
          <div className="text-[11px] mt-1" style={{ color: '#f87171' }}>
            {card.error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded p-2.5" style={{ background: '#0d0d1a', border: '1px solid #1e2040' }}>
      <div className="text-xs text-gray-300 mb-2">{card.text}</div>
      <div className="flex gap-1 flex-wrap">
        {COLUMNS.map((c) => (
          <button
            key={c}
            onClick={() => onMove(card.cardId, c)}
            disabled={moving || card.column === c}
            className="text-[10px] px-1.5 py-0.5 rounded tracking-wide transition-colors"
            style={{
              background: card.column === c ? '#4fc3f720' : 'transparent',
              border: `1px solid ${card.column === c ? '#4fc3f740' : '#1e2040'}`,
              color: card.column === c ? '#4fc3f7' : '#64748b',
              cursor: moving || card.column === c ? 'not-allowed' : 'pointer',
            }}
          >
            {COLUMN_LABEL[c]}
          </button>
        ))}
      </div>
    </div>
  );
}
