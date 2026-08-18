'use client';

interface ActivityItem {
  id: string;
  time: Date;
  event: string;
  description: string;
  role: string;
  payload: unknown;
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

export default function DashboardActivityTile({
  activity,
  expandedIds,
  onToggleExpanded,
}: {
  activity: ActivityItem[];
  expandedIds: Set<string>;
  onToggleExpanded: (id: string) => void;
}) {
  return (
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
                    onClick={expandable ? () => onToggleExpanded(item.id) : undefined}
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
  );
}
