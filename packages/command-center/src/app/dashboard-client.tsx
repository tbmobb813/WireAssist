'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAgentEvents, type AgentEvent } from '@/hooks/useAgentEvents';
import Link from 'next/link';
import PortfolioZones from './portfolio-zones';
import DashboardHero from './dashboard-hero';
import DashboardBudgetTile from './dashboard-budget-tile';
import DashboardUpcomingTile from './dashboard-upcoming-tile';
import DashboardQuickNoteTile from './dashboard-quicknote-tile';
import DashboardWorkforceTile from './dashboard-workforce-tile';
import DashboardActivityTile from './dashboard-activity-tile';

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

interface DashboardLocation {
  lat: number;
  lon: number;
  label: string;
}

interface Weather {
  tempF: number;
  code: number;
}

interface QuickNote {
  id: string;
  text: string;
  createdAt: string;
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
    case 'budget_warning_complete': {
      const summary = p.summary ? String(p.summary) : '';
      return { description: `Budget check: ${summary}`.trim(), role: 'admin' };
    }
    case 'stale_approvals_complete': {
      const count = Array.isArray(p.stale) ? p.stale.length : 0;
      return {
        description: `Stale-approval check: ${count} approval${count !== 1 ? 's' : ''} sitting unresolved`,
        role: 'admin',
      };
    }
    case 'trust_graduation_nudges_complete': {
      const candidates = Array.isArray(p.candidates) ? p.candidates.length : 0;
      return {
        description:
          candidates > 0
            ? `Trust-graduation check: ${candidates} workflow${candidates !== 1 ? 's' : ''} ready to graduate`
            : 'Trust-graduation check: nothing ready yet',
        role: 'strategy',
      };
    }
    case 'research_complete': {
      const summary = typeof p.summary === 'string' ? p.summary.slice(0, 100) : '';
      return { description: `Research complete: ${summary}`.trim(), role: 'research' };
    }
    // Every agent's freeform-chat reply carries the same { response: string }
    // shape under a different event name — the one-line preview here is
    // truncated the same way research_complete's summary is; the full text
    // is available by expanding the row (see dashboard-activity-tile.tsx's
    // isFreeformResponseEvent/FreeformResponseDetail).
    case 'freeform_response': {
      const response = typeof p.response === 'string' ? p.response.slice(0, 100) : '';
      return { description: response || 'Freeform reply received', role: 'admin' };
    }
    case 'ops_freeform_response': {
      const response = typeof p.response === 'string' ? p.response.slice(0, 100) : '';
      return { description: response || 'Freeform reply received', role: 'strategy' };
    }
    case 'github_freeform_response': {
      const response = typeof p.response === 'string' ? p.response.slice(0, 100) : '';
      return { description: response || 'Freeform reply received', role: 'github' };
    }
    case 'gtm_generated':
      return { description: 'GTM strategy generated — awaiting approval', role: 'gtm' };
    case 'gtm_psych_generated':
      return { description: 'GTM psych tactics generated — awaiting approval', role: 'gtm' };
    case 'ops_stage_complete': {
      const stage = typeof p.stage === 'string' ? p.stage : '';
      return { description: `Ops workflow stage complete: ${stage}`, role: 'strategy' };
    }
    case 'ops_blocked': {
      const diagnosis = typeof p.diagnosis === 'string' ? p.diagnosis.slice(0, 100) : '';
      return { description: `Ops workflow blocked: ${diagnosis}`.trim(), role: 'strategy' };
    }
    case 'ops_run_complete': {
      const workflow = typeof p.workflow === 'string' ? p.workflow : '';
      const status = p.autoApproved ? 'auto-delivered' : p.approved ? 'delivered' : 'not delivered';
      return { description: `Ops workflow "${workflow}" ${status}`, role: 'strategy' };
    }
    case 'publish_due_posts_complete': {
      const publishedCount = Array.isArray(p.published) ? p.published.length : 0;
      const failedCount = Array.isArray(p.failed) ? p.failed.length : 0;
      return {
        description: `Auto-publish: ${publishedCount} published${failedCount ? `, ${failedCount} failed` : ''}`,
        role: 'content',
      };
    }
    case 'auto_approved':
      return {
        description: typeof p.action === 'string' ? `Auto-approved: ${p.action}` : 'Auto-approved',
        role,
      };
    case 'handoff_queued': {
      const task = p.task as { agentRole?: string; description?: string } | undefined;
      return {
        description: task?.description ? `Handed off: ${task.description}` : 'Task handed off',
        role: task?.agentRole ?? 'admin',
      };
    }
    default:
      return { description: event, role: typeof p.agentRole === 'string' ? p.agentRole : 'admin' };
  }
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
        case 'content_analyzed':
        case 'scheduled_posts':
        case 'daily_briefing_complete':
        case 'follow_up_nudges_complete':
        case 'proactive_insights_complete':
        case 'budget_warning_complete':
        case 'stale_approvals_complete':
        case 'trust_graduation_nudges_complete':
        case 'research_complete':
        case 'gtm_generated':
        case 'gtm_psych_generated':
        case 'ops_stage_complete':
        case 'ops_blocked':
        case 'ops_run_complete':
        case 'publish_due_posts_complete':
        case 'auto_approved':
        case 'handoff_queued':
          addActivity(e.event, e.payload);
          break;
      }
    },
    [addActivity]
  );

  useAgentEvents(handleAgentEvent);

  const queueTask = async (path: string, label: string, requestBody?: Record<string, unknown>) => {
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

    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody ?? {}),
    });
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

  const runTriage = (objectiveId: string) =>
    queueTask('/api/tasks/triage-email', 'Inbox triage', {
      objectiveId: objectiveId || undefined,
    });
  const runCalendar = (objectiveId: string) =>
    queueTask('/api/tasks/review-calendar', 'Calendar review', {
      objectiveId: objectiveId || undefined,
    });

  const attentionCount =
    pendingCount + failures.length + (budget && budget.percent >= BUDGET_WARN_PERCENT ? 1 : 0);

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <DashboardHero
          now={now}
          location={location}
          weather={weather}
          locationInput={locationInput}
          onLocationInputChange={setLocationInput}
          savingLocation={savingLocation}
          onSaveLocation={saveLocation}
        />

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

          <DashboardBudgetTile budget={budget} />

          <DashboardUpcomingTile calendarReady={calendarReady} calendarEvents={calendarEvents} />

          <DashboardQuickNoteTile
            notes={notes}
            noteDraft={noteDraft}
            onNoteDraftChange={setNoteDraft}
            onSaveNote={saveNote}
            onRemoveNote={removeNote}
          />

          <DashboardWorkforceTile
            agents={agents}
            onRunTriage={runTriage}
            onRunCalendar={runCalendar}
          />

          <DashboardActivityTile
            activity={activity}
            expandedIds={expandedIds}
            onToggleExpanded={toggleExpanded}
          />
        </div>
      </div>
    </div>
  );
}
