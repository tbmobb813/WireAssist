'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAgentEvents, type AgentEvent } from '@/hooks/useAgentEvents';
import Link from 'next/link';
import PortfolioZones from './portfolio-zones';

interface AgentCard {
  role: string;
  name: string;
  status: 'idle' | 'running' | 'waiting_approval' | 'error';
}

interface UpcomingEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
}

function greeting(date: Date): string {
  const h = date.getHours();
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Working late';
}

function formatEventWhen(iso: string): string {
  const d = new Date(iso);
  const isAllDay = !iso.includes('T');
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  const time = isAllDay
    ? 'All day'
    : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isToday) return time;
  if (isTomorrow) return `Tomorrow ${isAllDay ? '' : time}`.trim();
  return `${d.toLocaleDateString([], { weekday: 'short' })} ${isAllDay ? '' : time}`.trim();
}

interface DashboardLocation {
  lat: number;
  lon: number;
  label: string;
}

interface Weather {
  tempF: number;
  code: number;
}

// WMO weather codes (Open-Meteo) collapsed to a small icon set.
function weatherIcon(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code === 45 || code === 48) return '🌫️';
  if (code >= 51 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '🌨️';
  if (code >= 80 && code <= 82) return '🌦️';
  if (code >= 95) return '⛈️';
  return '🌡️';
}

interface QuickNote {
  id: string;
  text: string;
  createdAt: string;
}

// role 'strategy' is NixOps — there's no dedicated 'ops' AgentRole yet.
function agentLink(role: string): { href: string; label: string } {
  switch (role) {
    case 'content':
      return { href: '/content', label: 'Open content' };
    case 'gtm':
      return { href: '/gtm', label: 'Open GTM' };
    case 'research':
      return { href: '/research', label: 'Open research' };
    case 'strategy':
      return { href: '/ops', label: 'Open ops' };
    default:
      return { href: '/chat', label: 'Ask via chat' };
  }
}

interface ActivityItem {
  id: string;
  time: Date;
  event: string;
  description: string;
  role: string;
  payload: unknown;
}

function activityId(event: string, payload: unknown): string {
  const p = payload as { taskId?: string };
  if (p?.taskId) return `${p.taskId}:${event}`;
  return `${event}:${Math.random().toString(36).slice(2)}`;
}

function describeEvent(event: string, payload: unknown): { description: string; role: string } {
  const p = payload as Record<string, unknown>;
  const role = typeof p.agentRole === 'string' ? p.agentRole : 'admin';

  switch (event) {
    case 'task_started':
      return {
        description: typeof p.description === 'string' ? p.description : 'Task started',
        role,
      };
    case 'task_complete':
      return { description: 'Task finished', role };
    case 'task_failed':
      return {
        description: typeof p.error === 'string' ? p.error : 'Task failed',
        role,
      };
    case 'waiting_approval':
      return {
        description: typeof p.action === 'string' ? p.action : 'Waiting for approval',
        role,
      };
    case 'triage_complete': {
      const totalEmails = typeof p.totalEmails === 'number' ? p.totalEmails : 0;
      const categories = p.categories as
        | {
            urgent?: unknown[];
            replyNeeded?: unknown[];
            fyi?: unknown[];
          }
        | undefined;
      const urgentCount = Array.isArray(categories?.urgent) ? categories.urgent.length : 0;
      const replyNeededCount = Array.isArray(categories?.replyNeeded)
        ? categories.replyNeeded.length
        : 0;
      const fyiCount = Array.isArray(categories?.fyi) ? categories.fyi.length : 0;
      const proposedActionCount = Array.isArray(p.proposedActions) ? p.proposedActions.length : 0;
      const summary = p.summary ? String(p.summary) : '';
      return {
        description:
          `Triage complete: ${totalEmails} unread (urgent:${urgentCount}, reply-needed:${replyNeededCount}, fyi:${fyiCount}). Proposed actions:${proposedActionCount}. ${summary}`.trim(),
        role: 'admin',
      };
    }
    case 'calendar_review_complete': {
      const eventsCount = Array.isArray(p.events) ? p.events.length : 0;
      const review = p.review as
        | {
            summary?: string;
            conflicts?: unknown[];
            overloadedDays?: unknown[];
            suggestions?: unknown[];
          }
        | undefined;
      const conflictsCount = Array.isArray(review?.conflicts) ? review.conflicts.length : 0;
      const overloadedCount = Array.isArray(review?.overloadedDays)
        ? review.overloadedDays.length
        : 0;
      const suggestionsCount = Array.isArray(review?.suggestions) ? review.suggestions.length : 0;
      const summary = review?.summary ? String(review.summary) : '';
      return {
        description:
          `Calendar review complete: ${eventsCount} events (conflicts:${conflictsCount}, overloaded-days:${overloadedCount}, suggestions:${suggestionsCount}). ${summary}`.trim(),
        role: 'admin',
      };
    }
    case 'content_generated': {
      const topic = typeof p.topic === 'string' ? p.topic : 'unknown topic';
      const platform = typeof p.platform === 'string' ? p.platform : '';
      return {
        description: `Generated ${platform} post: "${topic}" — awaiting approval`,
        role: 'content',
      };
    }
    case 'content_approved': {
      const platform = typeof p.platform === 'string' ? p.platform : '';
      const content = typeof p.content === 'string' ? p.content.slice(0, 60) : '';
      return { description: `${platform} post approved: "${content}..."`, role: 'content' };
    }
    case 'content_plan_generated': {
      const total = typeof p.totalGenerated === 'number' ? p.totalGenerated : 0;
      return {
        description: `Content plan generated: ${total} ideas — awaiting approval`,
        role: 'content',
      };
    }
    case 'post_scheduled': {
      const post = p.post as { platform?: string; scheduledAt?: string } | undefined;
      const platform = post?.platform ?? '';
      const date = post?.scheduledAt ? new Date(post.scheduledAt).toLocaleDateString() : '';
      return { description: `${platform} post scheduled for ${date}`, role: 'content' };
    }
    case 'content_analyzed':
      return { description: 'Content analysis complete', role: 'content' };
    case 'scheduled_posts': {
      const count = Array.isArray(p.posts) ? p.posts.length : 0;
      return {
        description: `Loaded ${count} scheduled post${count !== 1 ? 's' : ''}`,
        role: 'content',
      };
    }
    case 'daily_briefing_complete': {
      const summary = p.summary ? String(p.summary) : '';
      return { description: `Daily briefing: ${summary}`.trim(), role: 'admin' };
    }
    case 'follow_up_nudges_complete': {
      const count = Array.isArray(p.staleThreads) ? p.staleThreads.length : 0;
      return {
        description: `Follow-up nudges: ${count} stale thread${count !== 1 ? 's' : ''} found`,
        role: 'admin',
      };
    }
    case 'proactive_insights_complete': {
      const summary = p.summary ? String(p.summary) : '';
      return { description: `Proactive insight: ${summary}`.trim(), role: 'admin' };
    }
    default:
      return { description: event, role: typeof p.agentRole === 'string' ? p.agentRole : 'admin' };
  }
}

// Events whose payload carries more than the one-line summary shown in the
// feed — the row can be expanded to see it instead of it being discarded.
function hasExpandableDetail(event: string): boolean {
  return event === 'triage_complete' || event === 'calendar_review_complete';
}

function TriageDetail({ payload }: { payload: unknown }) {
  const p = payload as {
    categories?: {
      urgent?: { threadId: string; from: string; subject: string; reason: string }[];
      replyNeeded?: { threadId: string; from: string; subject: string; draftReply: string }[];
      fyi?: { threadId: string; from: string; subject: string }[];
      ignore?: { threadId: string; reason: string }[];
    };
  };
  const c = p.categories ?? {};
  return (
    <div className="space-y-3">
      {(c.urgent?.length ?? 0) > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-red-400 mb-1">Urgent</div>
          <div className="space-y-1">
            {c.urgent!.map((e, i) => (
              <div key={i} className="rounded border border-white/10 p-2 text-xs">
                <div className="text-gray-300">
                  <span className="opacity-60">{e.from}</span> — {e.subject}
                </div>
                <div className="mt-1 opacity-60">{e.reason}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {(c.replyNeeded?.length ?? 0) > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-amber-400 mb-1">Reply needed</div>
          <div className="space-y-1">
            {c.replyNeeded!.map((e, i) => (
              <div key={i} className="rounded border border-white/10 p-2 text-xs">
                <div className="text-gray-300">
                  <span className="opacity-60">{e.from}</span> — {e.subject}
                </div>
                <div className="mt-1 opacity-60 italic">&quot;{e.draftReply}&quot;</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {(c.fyi?.length ?? 0) > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-sky-400 mb-1">FYI</div>
          <div className="space-y-1">
            {c.fyi!.map((e, i) => (
              <div key={i} className="rounded border border-white/10 p-2 text-xs text-gray-300">
                <span className="opacity-60">{e.from}</span> — {e.subject}
              </div>
            ))}
          </div>
        </div>
      )}
      {(c.ignore?.length ?? 0) > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
            Ignored ({c.ignore!.length})
          </div>
          <div className="space-y-1">
            {c.ignore!.map((e, i) => (
              <div key={i} className="text-xs opacity-50">
                {e.reason}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarReviewDetail({ payload }: { payload: unknown }) {
  const p = payload as {
    events?: { id: string; summary: string; start: string; end: string }[];
    review?: {
      conflicts?: { event1: string; event2: string; overlap: string }[];
      overloadedDays?: { date: string; eventCount: number; recommendation: string }[];
      suggestions?: { type: string; description: string; action: string }[];
    };
  };
  const r = p.review ?? {};
  const events = p.events ?? [];
  return (
    <div className="space-y-3">
      {(r.conflicts?.length ?? 0) > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-red-400 mb-1">Conflicts</div>
          <div className="space-y-1">
            {r.conflicts!.map((c, i) => (
              <div key={i} className="rounded border border-white/10 p-2 text-xs text-gray-300">
                {c.event1} ↔ {c.event2}
                <div className="mt-1 opacity-60">{c.overlap}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {(r.overloadedDays?.length ?? 0) > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-amber-400 mb-1">Overloaded days</div>
          <div className="space-y-1">
            {r.overloadedDays!.map((d, i) => (
              <div key={i} className="rounded border border-white/10 p-2 text-xs text-gray-300">
                {d.date} — {d.eventCount} events
                <div className="mt-1 opacity-60">{d.recommendation}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {(r.suggestions?.length ?? 0) > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-sky-400 mb-1">Suggestions</div>
          <div className="space-y-1">
            {r.suggestions!.map((s, i) => (
              <div key={i} className="rounded border border-white/10 p-2 text-xs text-gray-300">
                <span className="opacity-60">{s.type}</span> — {s.description}
              </div>
            ))}
          </div>
        </div>
      )}
      {events.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
            Events in window ({events.length})
          </div>
          <div className="space-y-1">
            {events.map((e) => (
              <div key={e.id} className="text-xs text-gray-400">
                {e.summary} — {new Date(e.start).toLocaleString()} →{' '}
                {new Date(e.end).toLocaleString()}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityDetail({ event, payload }: { event: string; payload: unknown }) {
  if (event === 'triage_complete') return <TriageDetail payload={payload} />;
  if (event === 'calendar_review_complete') return <CalendarReviewDetail payload={payload} />;
  return null;
}

interface Failure {
  id: string;
  role: string;
  message: string;
  at: Date;
}

interface BudgetStatus {
  budget: number;
  spent: number;
  remaining: number;
  percent: number;
  resetsAt: string;
}

const BUDGET_WARN_PERCENT = 80;

export default function DashboardClient() {
  const [agents, setAgents] = useState<AgentCard[]>([
    { role: 'admin', name: 'Admin Agent', status: 'idle' },
    { role: 'content', name: 'Content Agent', status: 'idle' },
    { role: 'research', name: 'Research Agent', status: 'idle' },
    { role: 'strategy', name: 'NixOps', status: 'idle' },
    { role: 'gtm', name: 'GTM Agent', status: 'idle' },
  ]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [pendingCount, setPendingCount] = useState(0);
  const [failures, setFailures] = useState<Failure[]>([]);
  const [budget, setBudget] = useState<BudgetStatus | null>(null);
  const seenActivityIds = useRef(new Set<string>());

  const dismissFailure = useCallback((id: string) => {
    setFailures((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const addActivity = useCallback((event: string, payload: unknown, at?: string) => {
    const id = activityId(event, payload);
    if (seenActivityIds.current.has(id)) return;
    seenActivityIds.current.add(id);

    const { description, role } = describeEvent(event, payload);
    setActivity((prev) =>
      [
        {
          id,
          time: at ? new Date(at) : new Date(),
          event,
          description,
          role,
          payload,
        },
        ...prev,
      ].slice(0, 50)
    );
  }, []);

  // Poll pending approvals count
  useEffect(() => {
    const poll = async () => {
      const res = await fetch('/api/approvals');
      const data = await res.json();
      setPendingCount(data.length);
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, []);

  // Live agent status
  useEffect(() => {
    const fetchStatus = async () => {
      const res = await fetch('/api/agent/status');
      const data = await res.json();
      setAgents(Object.values(data).filter(Boolean) as AgentCard[]);
    };
    fetchStatus();
    const t = setInterval(fetchStatus, 3000);
    return () => clearInterval(t);
  }, []);

  // Poll budget status
  useEffect(() => {
    const poll = async () => {
      const res = await fetch('/api/budget');
      if (!res.ok) return;
      const data = await res.json();
      setBudget(data);
    };
    poll();
    const t = setInterval(poll, 60000);
    return () => clearInterval(t);
  }, []);

  // Live clock
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Upcoming calendar events — raw data, no LLM involved, cheap to poll
  const [calendarEvents, setCalendarEvents] = useState<UpcomingEvent[]>([]);
  const [calendarReady, setCalendarReady] = useState<boolean | null>(null);
  useEffect(() => {
    const poll = async () => {
      const res = await fetch('/api/calendar/upcoming');
      if (!res.ok) return;
      const data = await res.json();
      setCalendarReady(Boolean(data.ready));
      if (Array.isArray(data.events)) setCalendarEvents(data.events);
    };
    poll();
    const t = setInterval(poll, 5 * 60000);
    return () => clearInterval(t);
  }, []);

  // Weather — location is persisted server-side; geocoding and the forecast
  // itself are fetched directly from Open-Meteo client-side (public, no key).
  const [location, setLocationState] = useState<DashboardLocation | null | undefined>(undefined);
  const [locationInput, setLocationInput] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);
  const [weather, setWeather] = useState<Weather | null>(null);

  useEffect(() => {
    fetch('/api/dashboard/location')
      .then((r) => r.json())
      .then((d) => setLocationState(d.location ?? null))
      .catch(() => setLocationState(null));
  }, []);

  useEffect(() => {
    if (!location) return;
    const poll = async () => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`
        );
        const data = await res.json();
        if (typeof data.current?.temperature_2m === 'number') {
          setWeather({
            tempF: Math.round(data.current.temperature_2m),
            code: data.current.weather_code,
          });
        }
      } catch {
        // Weather is a nicety, not a requirement — fail silently.
      }
    };
    poll();
    const t = setInterval(poll, 15 * 60000);
    return () => clearInterval(t);
  }, [location]);

  const saveLocation = async () => {
    if (!locationInput.trim()) return;
    setSavingLocation(true);
    try {
      const geo = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationInput.trim())}&count=1`
      ).then((r) => r.json());
      const match = geo.results?.[0];
      if (!match) return;
      const loc: DashboardLocation = {
        lat: match.latitude,
        lon: match.longitude,
        label: [match.name, match.admin1].filter(Boolean).join(', '),
      };
      await fetch('/api/dashboard/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loc),
      });
      setLocationState(loc);
    } finally {
      setSavingLocation(false);
    }
  };

  // Quick-capture notes — zero-friction scratchpad, no agent/task required
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const loadNotes = useCallback(() => {
    fetch('/api/notes')
      .then((r) => r.json())
      .then((d) => Array.isArray(d.notes) && setNotes(d.notes))
      .catch(() => {});
  }, []);
  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const saveNote = async () => {
    if (!noteDraft.trim()) return;
    const text = noteDraft.trim();
    setNoteDraft('');
    await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    loadNotes();
  };

  const removeNote = async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/notes/${id}`, { method: 'DELETE' });
  };

  // Hydrate activity feed from API (covers page refresh and SSE connect race).
  // Recent task_failed records also seed the Needs Attention band — otherwise
  // a refresh silently drops a real failure down to "all clear."
  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/activity');
      if (!res.ok) return;
      const records = (await res.json()) as {
        event: string;
        payload: { taskId?: string; agentRole?: string; error?: string };
        at: string;
      }[];
      if (!Array.isArray(records)) return;
      const recentFailures: Failure[] = [];
      for (const record of [...records].reverse()) {
        if (record.event === 'connected' || record.event === 'approval_resolved') continue;
        addActivity(record.event, record.payload, record.at);
        if (record.event === 'task_failed') {
          recentFailures.unshift({
            id: `${record.payload.taskId}:${record.at}`,
            role: record.payload.agentRole ?? 'admin',
            message: record.payload.error ?? 'Task failed',
            at: new Date(record.at),
          });
        }
      }
      if (recentFailures.length > 0) setFailures(recentFailures.slice(0, 5));
    };
    load();
  }, [addActivity]);

  const handleAgentEvent = useCallback(
    (e: AgentEvent) => {
      switch (e.event) {
        case 'connected':
          return;
        case 'task_started':
          setAgents((prev) =>
            prev.map((a) => (a.role === e.payload.agentRole ? { ...a, status: 'running' } : a))
          );
          addActivity('task_started', e.payload);
          break;
        case 'task_complete':
          setAgents((prev) =>
            prev.map((a) => (a.role === e.payload.agentRole ? { ...a, status: 'idle' } : a))
          );
          addActivity('task_complete', e.payload);
          break;
        case 'task_failed':
          setAgents((prev) =>
            prev.map((a) => (a.role === e.payload.agentRole ? { ...a, status: 'error' } : a))
          );
          addActivity('task_failed', e.payload);
          setFailures((prev) =>
            [
              {
                id: `${e.payload.taskId}:${Date.now()}`,
                role: e.payload.agentRole,
                message: e.payload.error,
                at: new Date(),
              },
              ...prev,
            ].slice(0, 5)
          );
          break;
        case 'waiting_approval':
          setAgents((prev) =>
            prev.map((a) =>
              a.role === e.payload.agentRole ? { ...a, status: 'waiting_approval' } : a
            )
          );
          setPendingCount((c) => c + 1);
          addActivity('waiting_approval', e.payload);
          break;
        case 'approval_resolved':
          setPendingCount((c) => Math.max(0, c - 1));
          break;
        case 'triage_complete':
          addActivity('triage_complete', e.payload);
          break;
        case 'calendar_review_complete':
          addActivity('calendar_review_complete', e.payload);
          break;
        case 'content_generated':
        case 'content_approved':
        case 'content_plan_generated':
        case 'post_scheduled':
        case 'daily_briefing_complete':
        case 'follow_up_nudges_complete':
        case 'proactive_insights_complete':
          addActivity(e.event, e.payload);
          break;
      }
    },
    [addActivity]
  );

  useAgentEvents(handleAgentEvent);

  const queueTask = async (path: string, label: string) => {
    const queueId = `queue:${path}:${Date.now()}`;
    seenActivityIds.current.add(queueId);
    setActivity((prev) =>
      [
        {
          id: queueId,
          time: new Date(),
          event: 'queued',
          description: `${label} — queued…`,
          role: 'admin',
          payload: null,
        },
        ...prev,
      ].slice(0, 50)
    );

    const res = await fetch(path, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        typeof body.error === 'string' ? body.error : `Request failed (${res.status})`;
      addActivity('task_failed', { error: message, agentRole: 'admin' });
      setAgents((prev) => prev.map((a) => (a.role === 'admin' ? { ...a, status: 'error' } : a)));
      setFailures((prev) =>
        [{ id: `${queueId}:fail`, role: 'admin', message, at: new Date() }, ...prev].slice(0, 5)
      );
    }
  };

  const runTriage = () => queueTask('/api/tasks/triage-email', 'Inbox triage');
  const runCalendar = () => queueTask('/api/tasks/review-calendar', 'Calendar review');

  const statusColor = (s: string) =>
    ({
      idle: '#4fc3f7',
      running: '#00ff9d',
      waiting_approval: '#ffb347',
      error: '#ef4444',
    })[s] ?? '#4fc3f7';

  const statusLabel = (s: string) =>
    ({
      idle: 'IDLE',
      running: 'RUNNING',
      waiting_approval: 'NEEDS APPROVAL',
      error: 'ERROR',
    })[s] ?? s.toUpperCase();

  const attentionCount =
    pendingCount + failures.length + (budget && budget.percent >= BUDGET_WARN_PERCENT ? 1 : 0);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        {/* Hero — greeting, live clock, weather, date. Sets the tone: this is your
            assistant, not an ops console. Glass/depth accent used sparingly, only here. */}
        <div
          className="mb-8 flex flex-wrap items-end justify-between gap-6 rounded-3xl px-7 py-6"
          style={{
            background: 'linear-gradient(135deg, rgba(79,195,247,0.07), rgba(192,132,252,0.04))',
            border: '1px solid rgba(79,195,247,0.15)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div>
            <div className="font-mono text-[11px] tracking-[0.25em] text-accent/70 mb-2">
              WIREASSIST
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">
              {now ? greeting(now) : 'Hello'}, Jason
            </h1>
            <p className="text-gray-500 text-sm mt-2">
              {now
                ? now.toLocaleDateString([], {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })
                : ''}
            </p>
          </div>
          <div className="text-right">
            <div className="font-mono text-5xl font-light tracking-tight text-gray-100 tabular-nums">
              {now ? now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '--:--'}
            </div>
            {location === null ? (
              <div className="flex items-center gap-2 mt-2 justify-end">
                <input
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveLocation()}
                  placeholder="Set your city for weather"
                  className="text-xs rounded-full px-3 py-1.5 outline-none w-44"
                  style={{ background: '#0d0d1a', border: '1px solid #1e2040', color: '#e2e8f0' }}
                />
                <button
                  onClick={saveLocation}
                  disabled={savingLocation || !locationInput.trim()}
                  className="text-xs px-3 py-1.5 rounded-full text-accent border border-accent/30 hover:bg-accent/10 transition-colors disabled:opacity-40"
                >
                  {savingLocation ? '…' : 'Save'}
                </button>
              </div>
            ) : location && weather ? (
              <div className="text-sm text-gray-400 mt-1">
                {weatherIcon(weather.code)} {weather.tempF}°F · {location.label}
              </div>
            ) : location ? (
              <div className="text-sm text-gray-600 mt-1">{location.label}</div>
            ) : null}
          </div>
        </div>

        {/* Nav */}
        <div className="flex flex-wrap gap-2 mb-8">
          {[
            { href: '/', label: 'Dashboard' },
            {
              href: '/approvals',
              label: `Approvals${pendingCount > 0 ? ` (${pendingCount})` : ''}`,
              urgent: pendingCount > 0,
            },
            { href: '/content', label: 'Content' },
            { href: '/chat', label: 'Agent Chat' },
            { href: '/memory', label: 'Memory' },
            { href: '/onboarding', label: 'Setup' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-4 py-2 text-sm rounded-full border transition-colors"
              style={{
                borderColor: item.urgent ? '#ffb34760' : '#1e2040',
                background: item.urgent ? '#ffb34712' : 'transparent',
                color: item.urgent ? '#ffb347' : '#94a3b8',
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Needs Attention — everything that requires a decision, in one place */}
        <div className="mb-6">
          {attentionCount === 0 ? (
            <div
              className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm"
              style={{ color: '#00ff9d', background: '#00ff9d0a', border: '1px solid #00ff9d20' }}
            >
              <span>✓</span> All clear — nothing needs you right now
            </div>
          ) : (
            <div
              className="rounded-2xl border overflow-hidden backdrop-blur-sm"
              style={{ background: '#ffb34710', borderColor: '#ffb34740' }}
            >
              <div
                className="px-5 py-3 text-xs font-semibold tracking-wide text-amber border-b"
                style={{ borderColor: '#ffb34725' }}
              >
                NEEDS ATTENTION · {attentionCount}
              </div>
              <div className="divide-y" style={{ borderColor: '#ffb34718' }}>
                {pendingCount > 0 && (
                  <Link
                    href="/approvals"
                    className="flex items-center justify-between px-5 py-3 hover:bg-white/5 transition-colors"
                  >
                    <span className="text-sm text-gray-200">
                      {pendingCount} pending approval{pendingCount > 1 ? 's' : ''}
                    </span>
                    <span className="text-xs text-amber">Review →</span>
                  </Link>
                )}
                {budget && budget.percent >= BUDGET_WARN_PERCENT && (
                  <div className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm text-gray-200">
                      Budget at {Math.round(budget.percent)}% — ${budget.spent.toFixed(2)} of $
                      {budget.budget.toFixed(2)} spent this month
                    </span>
                    <span className="text-xs text-gray-600">
                      resets {new Date(budget.resetsAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {failures.map((f) => (
                  <div key={f.id} className="flex items-center justify-between px-5 py-3 gap-4">
                    <span className="text-sm text-gray-200 truncate">
                      <span className="text-red-400">{f.role.toUpperCase()}</span> — {f.message}
                    </span>
                    <button
                      onClick={() => dismissFailure(f.id)}
                      className="text-xs text-gray-600 hover:text-gray-400 flex-shrink-0"
                    >
                      dismiss
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bento grid — mixed tile sizes instead of uniform stacked columns:
            one dominant tile (portfolio), a small stat tile (budget), two
            medium tiles side by side (calendar/notes), then workforce/activity. */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6 items-start">
          <div className="md:col-span-3">
            <PortfolioZones />
          </div>

          {/* Budget — small stat tile, always visible (not just when near cap) */}
          <div
            className="rounded-2xl border p-5 flex flex-col justify-between"
            style={{ background: '#0d0d1a', borderColor: '#1e2040', minHeight: '160px' }}
          >
            <div className="text-sm font-semibold text-gray-300">Budget</div>
            {budget ? (
              <div>
                <div className="text-3xl font-semibold text-gray-100 tabular-nums">
                  ${budget.remaining.toFixed(2)}
                </div>
                {/* Whole-dollar rounding used to make small spend
                    (e.g. $0.03 of $30) round to the same number as the cap
                    and look like nothing was tracked — cents fix that, and
                    spend is now shown explicitly rather than only implied
                    by remaining vs. cap. */}
                <div className="text-xs text-gray-600 mb-2">
                  left of ${budget.budget.toFixed(0)} · ${budget.spent.toFixed(2)} spent
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: '#1e2040' }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, budget.percent)}%`,
                      background:
                        budget.percent >= BUDGET_WARN_PERCENT
                          ? '#ffb347'
                          : budget.percent >= 100
                            ? '#ef4444'
                            : '#00ff9d',
                    }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-600">Loading…</p>
            )}
          </div>

          {/* Upcoming + Quick Note — medium tiles side by side, not stacked */}
          <div
            className="md:col-span-2 rounded-2xl border p-5"
            style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-gray-300">Upcoming</div>
              <Link href="/onboarding" className="text-xs text-gray-600 hover:text-accent">
                {calendarReady === false ? 'connect calendar' : ''}
              </Link>
            </div>
            {calendarReady === null ? (
              <p className="text-sm text-gray-600">Loading…</p>
            ) : calendarReady === false ? (
              <p className="text-sm text-gray-600">
                Connect Google Calendar in Setup to see what&apos;s next here.
              </p>
            ) : calendarEvents.length === 0 ? (
              <p className="text-sm text-gray-600">Nothing on the calendar in the next 7 days.</p>
            ) : (
              <div className="space-y-3">
                {calendarEvents.map((e) => (
                  <div key={e.id} className="flex items-start gap-3">
                    <div className="text-xs text-accent font-mono w-16 flex-shrink-0 pt-0.5">
                      {formatEventWhen(e.start)}
                    </div>
                    <div className="text-sm text-gray-200 leading-snug">{e.summary}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            className="md:col-span-2 rounded-2xl border p-5"
            style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
          >
            <div className="text-sm font-semibold text-gray-300 mb-3">Quick note</div>
            <div className="flex gap-2 mb-3">
              <input
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveNote()}
                placeholder="Jot something down…"
                className="flex-1 text-sm rounded-lg px-3 py-2 outline-none"
                style={{ background: '#080810', border: '1px solid #1e2040', color: '#e2e8f0' }}
              />
              <button
                onClick={saveNote}
                disabled={!noteDraft.trim()}
                className="text-xs px-3 rounded-lg text-accent border border-accent/30 hover:bg-accent/10 transition-colors disabled:opacity-30"
              >
                Save
              </button>
            </div>
            {notes.length === 0 ? (
              <p className="text-xs text-gray-600">Nothing saved yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {notes.map((n) => (
                  <div key={n.id} className="flex items-start justify-between gap-2 group">
                    <span className="text-sm text-gray-300 leading-snug">{n.text}</span>
                    <button
                      onClick={() => removeNote(n.id)}
                      className="text-xs text-gray-700 hover:text-gray-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Workforce — status at a glance; click through for detail */}
          <div className="md:col-span-2">
            <div className="text-sm font-semibold text-gray-300 mb-4">Workforce</div>
            <div className="space-y-2">
              {agents.map((agent) => (
                <Link
                  key={agent.role}
                  href={agentLink(agent.role).href}
                  className="flex items-center justify-between rounded-xl px-4 py-3 border transition-colors hover:border-accent/40"
                  style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: statusColor(agent.status) }}
                    />
                    <div>
                      <div className="font-medium text-sm text-gray-200">{agent.name}</div>
                      <div className="text-xs text-gray-600">{agent.role}</div>
                    </div>
                  </div>
                  <div
                    className="text-[11px] font-medium px-2 py-1 rounded-full flex-shrink-0"
                    style={{
                      color: statusColor(agent.status),
                      background: `${statusColor(agent.status)}15`,
                    }}
                  >
                    {statusLabel(agent.status)}
                  </div>
                </Link>
              ))}
            </div>

            {/* Admin's one-shot actions — the only agent triggerable straight from the video wall */}
            <div className="flex gap-2 mt-2">
              <button
                onClick={runTriage}
                className="flex-1 text-xs py-2 px-3 rounded-lg border border-border text-gray-500 hover:border-accent hover:text-accent transition-colors"
              >
                Triage inbox
              </button>
              <button
                onClick={runCalendar}
                className="flex-1 text-xs py-2 px-3 rounded-lg border border-border text-gray-500 hover:border-accent hover:text-accent transition-colors"
              >
                Review calendar
              </button>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="md:col-span-2">
            <div className="text-sm font-semibold text-gray-300 mb-4">Activity</div>
            <div
              className="rounded-2xl border overflow-hidden"
              style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
            >
              {activity.length === 0 ? (
                <div className="p-8 text-center text-gray-600 text-sm">
                  No activity yet. Run a task to get started.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {activity.map((item) => {
                    const expandable = hasExpandableDetail(item.event);
                    const expanded = expandable && expandedIds.has(item.id);
                    return (
                      <div key={item.id}>
                        <div
                          className={`px-5 py-3 flex items-start gap-4 ${expandable ? 'cursor-pointer hover:bg-white/5' : ''}`}
                          onClick={expandable ? () => toggleExpanded(item.id) : undefined}
                        >
                          <div className="text-xs text-gray-600 mt-0.5 whitespace-nowrap">
                            {item.time.toLocaleTimeString()}
                          </div>
                          <div
                            className="text-xs tracking-widest mt-0.5 whitespace-nowrap"
                            style={{
                              color:
                                {
                                  queued: '#94a3b8',
                                  task_started: '#4fc3f7',
                                  task_complete: '#00ff9d',
                                  task_failed: '#ef4444',
                                  waiting_approval: '#ffb347',
                                  triage_complete: '#4fc3f7',
                                  calendar_review_complete: '#c084fc',
                                  content_generated: '#ffb347',
                                  content_approved: '#00ff9d',
                                  content_plan_generated: '#ffb347',
                                  post_scheduled: '#00ff9d',
                                }[item.event] ?? '#475569',
                            }}
                          >
                            {item.event.toUpperCase()}
                          </div>
                          <div className="text-sm text-gray-300 flex-1">
                            {item.description}
                            {expandable && (
                              <span className="ml-2 text-xs opacity-40">
                                {expanded ? '▾ hide details' : '▸ show details'}
                              </span>
                            )}
                          </div>
                        </div>
                        {expanded && (
                          <div className="px-5 pb-4 pl-24">
                            <ActivityDetail event={item.event} payload={item.payload} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
