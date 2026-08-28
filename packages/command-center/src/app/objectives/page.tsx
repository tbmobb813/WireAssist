'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  foldTasks,
  type ObjectiveStatus,
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

const STATUS_LABEL: Record<ObjectiveStatus, string> = {
  active: 'ACTIVE',
  paused: 'PAUSED',
  completed: 'COMPLETED',
};

const STATUS_FILTERS: (ObjectiveStatus | 'all')[] = ['all', 'active', 'paused', 'completed'];
const COLUMNS: KanbanColumn[] = ['todo', 'in_progress', 'review', 'done'];
const COLUMN_LABEL: Record<KanbanColumn, string> = {
  todo: 'TODO',
  in_progress: 'IN PROGRESS',
  review: 'REVIEW',
  done: 'DONE',
};

type ViewMode = 'boards' | 'list';

export default function ObjectivesPage() {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [filter, setFilter] = useState<ObjectiveStatus | 'all'>('active');
  const [view, setView] = useState<ViewMode>('boards');
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // objectiveId -> that objective's card list, only populated in board view.
  const [cardsByObjective, setCardsByObjective] = useState<Record<string, KanbanCard[]>>({});

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

  const loadCardsFor = useCallback(async (objectiveId: string) => {
    const res = await fetch(`/api/objectives/${objectiveId}`);
    if (!res.ok) return;
    const d = await res.json();
    const events: ObjectiveEvent[] = Array.isArray(d.events) ? d.events : [];
    setCardsByObjective((prev) => ({
      ...prev,
      [objectiveId]: foldTasks([...events].reverse()),
    }));
  }, []);

  // Fetch every visible objective's cards in parallel whenever the board view
  // is showing and the objective list changes. Deliberately no live SSE sync
  // here (that's the single-objective detail page's job) -- this view refetches
  // just the one objective that changed after an add/move action instead.
  useEffect(() => {
    if (view !== 'boards' || objectives.length === 0) return;
    objectives.forEach((o) => loadCardsFor(o.id));
  }, [view, objectives, loadCardsFor]);

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
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs tracking-widest text-accent mb-2">WIREASSIST // OBJECTIVES</div>
          <h1 className="text-3xl font-black">OBJECTIVES</h1>
          <p className="text-gray-500 text-sm mt-2">
            Shared outcomes any agent&apos;s tasks can tag into — see who&apos;s working toward
            what.
          </p>
        </div>
        <div className="flex gap-2">
          {(['boards', 'list'] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="text-xs px-3 py-1.5 rounded tracking-widest transition-colors"
              style={{
                background: view === v ? '#4fc3f720' : 'transparent',
                border: `1px solid ${view === v ? '#4fc3f740' : '#1e2040'}`,
                color: view === v ? '#4fc3f7' : '#64748b',
              }}
            >
              {v.toUpperCase()}
            </button>
          ))}
        </div>
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
      ) : view === 'list' ? (
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
      ) : (
        <div className="space-y-6">
          {objectives.map((o) => (
            <ObjectiveBoardSection
              key={o.id}
              objective={o}
              cards={cardsByObjective[o.id]}
              onChanged={() => loadCardsFor(o.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ObjectiveBoardSection({
  objective,
  cards,
  onChanged,
}: {
  objective: Objective;
  cards: KanbanCard[] | undefined;
  onChanged: () => void;
}) {
  const [newCardText, setNewCardText] = useState('');
  const [adding, setAdding] = useState(false);
  const [movingCardId, setMovingCardId] = useState<string | null>(null);

  const addCard = async () => {
    if (!newCardText.trim() || adding) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/objectives/${objective.id}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newCardText.trim() }),
      });
      if (res.ok) {
        setNewCardText('');
        onChanged();
      }
    } finally {
      setAdding(false);
    }
  };

  const moveCard = async (cardId: string, to: KanbanColumn) => {
    if (movingCardId) return;
    setMovingCardId(cardId);
    try {
      const res = await fetch(`/api/objectives/${objective.id}/cards/${cardId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to }),
      });
      if (res.ok) onChanged();
    } finally {
      setMovingCardId(null);
    }
  };

  const cardsByColumn = useMemo(() => {
    const map: Record<KanbanColumn, KanbanCard[]> = {
      todo: [],
      in_progress: [],
      review: [],
      done: [],
    };
    (cards ?? []).forEach((c) => map[c.column].push(c));
    return map;
  }, [cards]);

  return (
    <div
      className="rounded-lg border p-5"
      style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
    >
      <div className="flex items-center justify-between gap-3 mb-1">
        <Link
          href={`/objectives/${objective.id}`}
          className="font-bold text-base text-gray-100 hover:text-accent transition-colors"
        >
          {objective.title}
        </Link>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div
            className="text-[11px] font-medium px-2 py-1 rounded-full"
            style={{
              color: STATUS_COLOR[objective.status],
              background: `${STATUS_COLOR[objective.status]}15`,
            }}
          >
            {STATUS_LABEL[objective.status]}
          </div>
          <Link
            href={`/objectives/${objective.id}`}
            className="text-[11px] text-gray-600 hover:text-accent transition-colors"
          >
            Details →
          </Link>
        </div>
      </div>
      {objective.description && (
        <p className="text-xs text-gray-500 mb-4">{objective.description}</p>
      )}

      {cards === undefined ? (
        <p className="text-xs text-gray-600">Loading board...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {COLUMNS.map((column) => {
            const columnCards = cardsByColumn[column];
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
                    <BoardCard
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
                      disabled={adding || !newCardText.trim()}
                      className="w-full py-1.5 rounded text-xs font-bold tracking-widest transition-colors"
                      style={{
                        background: adding || !newCardText.trim() ? '#1e2040' : '#4fc3f720',
                        border: `1px solid ${adding || !newCardText.trim() ? '#1e2040' : '#4fc3f740'}`,
                        color: adding || !newCardText.trim() ? '#475569' : '#4fc3f7',
                        cursor: adding || !newCardText.trim() ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {adding ? 'ADDING...' : '+ ADD CARD'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BoardCard({
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
        <div className="text-[10px] tracking-widest text-gray-600 mb-1">{card.agentRole}</div>
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
