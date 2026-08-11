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
  const seenActivityIds = useRef(new Set<string>());

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

  // Hydrate activity feed from API (covers page refresh and SSE connect race)
  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/activity');
      if (!res.ok) return;
      const records = (await res.json()) as { event: string; payload: unknown; at: string }[];
      if (!Array.isArray(records)) return;
      for (const record of [...records].reverse()) {
        if (record.event === 'connected' || record.event === 'approval_resolved') continue;
        addActivity(record.event, record.payload, record.at);
      }
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

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="mb-10">
        <div className="text-xs tracking-widest text-accent mb-2">WIREASSIST // COMMAND CENTER</div>
        <h1 className="text-4xl font-black tracking-tight">RUN A BUSINESS. SOLO.</h1>
        <p className="text-gray-500 text-sm mt-2 tracking-widest">
          AI WORKFORCE OPERATIONS DASHBOARD
        </p>
      </div>

      {/* Nav */}
      <div className="flex gap-2 mb-10">
        {[
          { href: '/', label: 'DASHBOARD' },
          {
            href: '/approvals',
            label: `APPROVALS${pendingCount > 0 ? ` (${pendingCount})` : ''}`,
            urgent: pendingCount > 0,
          },
          { href: '/content', label: 'CONTENT' },
          { href: '/chat', label: 'AGENT CHAT' },
          { href: '/memory', label: 'MEMORY' },
          { href: '/onboarding', label: 'SETUP' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="px-4 py-2 text-xs tracking-widest border rounded transition-colors"
            style={{
              borderColor: item.urgent ? '#ffb347' : '#1e2040',
              color: item.urgent ? '#ffb347' : '#475569',
            }}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="mb-10">
        <PortfolioZones />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Agent Cards */}
        <div className="col-span-1 space-y-4">
          <div className="text-xs tracking-widest text-gray-500 mb-4">WORKFORCE</div>

          {agents.map((agent) => (
            <div
              key={agent.role}
              className="rounded-lg p-5 border"
              style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="font-bold text-sm">{agent.name}</div>
                  <div className="text-xs text-gray-500 mt-1 tracking-widest">
                    {agent.role.toUpperCase()}
                  </div>
                </div>
                <div
                  className="text-xs tracking-widest px-2 py-1 rounded"
                  style={{
                    color: statusColor(agent.status),
                    background: `${statusColor(agent.status)}15`,
                    border: `1px solid ${statusColor(agent.status)}30`,
                  }}
                >
                  {statusLabel(agent.status)}
                </div>
              </div>

              <div className="space-y-2">
                {agent.role === 'admin' ? (
                  <>
                    <button
                      onClick={runTriage}
                      className="w-full text-left text-xs py-2 px-3 rounded border border-border text-gray-400 hover:border-accent hover:text-accent transition-colors"
                    >
                      → Triage inbox
                    </button>
                    <button
                      onClick={runCalendar}
                      className="w-full text-left text-xs py-2 px-3 rounded border border-border text-gray-400 hover:border-accent hover:text-accent transition-colors"
                    >
                      → Review calendar
                    </button>
                    <Link
                      href="/chat"
                      className="block text-xs py-2 px-3 rounded border border-border text-gray-400 hover:border-accent hover:text-accent transition-colors"
                    >
                      → Open chat
                    </Link>
                  </>
                ) : (
                  <Link
                    href={agentLink(agent.role).href}
                    className="block text-xs py-2 px-3 rounded border border-border text-gray-400 hover:border-accent hover:text-accent transition-colors"
                  >
                    → {agentLink(agent.role).label}
                  </Link>
                )}
              </div>
            </div>
          ))}

          {pendingCount > 0 && (
            <Link
              href="/approvals"
              className="block rounded-lg p-4 border transition-colors"
              style={{ background: '#1a1200', borderColor: '#ffb34750' }}
            >
              <div className="text-xs tracking-widest text-amber mb-1">ACTION REQUIRED</div>
              <div className="text-sm font-bold">
                {pendingCount} pending approval{pendingCount > 1 ? 's' : ''}
              </div>
            </Link>
          )}

          <Link
            href="/gtm"
            className="block rounded-lg p-4 border transition-colors"
            style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
          >
            <div className="text-xs tracking-widest text-gray-500 mb-1">GTM ENGINE</div>
            <div className="text-sm font-bold text-gray-300">
              Go-to-market strategy + psych tactics
            </div>
          </Link>
        </div>

        {/* Activity Feed */}
        <div className="col-span-2">
          <div className="text-xs tracking-widest text-gray-500 mb-4">ACTIVITY FEED</div>
          <div
            className="rounded-lg border overflow-hidden"
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
  );
}
