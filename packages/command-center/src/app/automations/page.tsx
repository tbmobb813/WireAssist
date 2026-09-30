'use client';
import { useState, useEffect, useCallback } from 'react';

interface AutomationRow {
  job: string;
  label: string;
  agentRole: string;
  schedule: string;
  script: string;
  lastRunAt: string | null;
  lastStatus: 'ok' | 'error' | null;
  lastDetail: string | null;
  nextRunAt: string | null;
}

// Plain-English summary of the handful of cron shapes AUTOMATION_REGISTRY
// actually uses (see automation-log.ts) — nobody should need to parse
// "0 8 * * 1" by hand to know this runs Monday mornings.
function describeSchedule(cron: string): string {
  const [min, hour, dom, , dow] = cron.trim().split(/\s+/);
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (min.startsWith('*/') && hour === '*') return `Every ${min.slice(2)} min`;
  if (min === '0' && hour === '*') return 'Hourly';
  if (min === '0' && dom !== '*' && dow === '*')
    return `Monthly on the ${dom}${daySuffix(Number(dom))}`;
  if (min === '0' && dow !== '*') return `Weekly, ${DAYS[Number(dow)]} ${formatHour(hour)}`;
  if (min === '0' && hour !== '*') return `Daily at ${formatHour(hour)}`;
  return cron;
}

function daySuffix(n: number): string {
  if (n >= 11 && n <= 13) return 'th';
  switch (n % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

function formatHour(hour: string): string {
  const h = Number(hour);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${period}`;
}

function formatRelative(iso: string | null, now: Date): string {
  if (!iso) return 'Never run yet';
  const elapsedMs = now.getTime() - new Date(iso).getTime();
  const elapsedMin = Math.floor(elapsedMs / 60000);
  if (elapsedMin < 1) return 'just now';
  if (elapsedMin < 60) return `${elapsedMin} min ago`;
  const elapsedHr = Math.floor(elapsedMin / 60);
  if (elapsedHr < 24) return `${elapsedHr} hr ago`;
  return `${Math.floor(elapsedHr / 24)} day(s) ago`;
}

function formatFuture(iso: string | null, now: Date): string {
  if (!iso) return 'unknown';
  const remainingMin = Math.round((new Date(iso).getTime() - now.getTime()) / 60000);
  if (remainingMin < 1) return 'due now';
  if (remainingMin < 60) return `in ${remainingMin} min`;
  const remainingHr = Math.floor(remainingMin / 60);
  if (remainingHr < 24) return `in ${remainingHr} hr`;
  return `in ${Math.floor(remainingHr / 24)} day(s)`;
}

export default function AutomationsPage() {
  const [rows, setRows] = useState<AutomationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());

  const fetchRows = useCallback(async () => {
    const res = await fetch('/api/automations');
    const data = await res.json();
    setRows(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRows();
    // No SSE event fires when a cron-triggered ping lands (pings come from
    // outside the browser entirely) — a 30s poll is the only way this
    // screen can reflect a run that just happened, unlike Approvals/Ops
    // which react to in-app agent events.
    const poll = setInterval(fetchRows, 30000);
    return () => clearInterval(poll);
  }, [fetchRows]);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(tick);
  }, []);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black">Automations</h1>
        <p className="text-gray-500 text-sm mt-2">
          {rows.length === 0
            ? loading
              ? 'Loading...'
              : 'No automations configured.'
            : `${rows.length} cron-driven job${rows.length > 1 ? 's' : ''}.`}
        </p>
      </div>

      {!loading && rows.length > 0 && (
        <div className="space-y-3 max-w-3xl">
          {rows.map((row) => (
            <div
              key={row.job}
              className="rounded-lg border overflow-hidden"
              style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
            >
              <div className="px-5 py-4 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold">{row.label}</span>
                    <span
                      className="text-xs tracking-widest px-2 py-0.5 rounded"
                      style={{
                        color: '#4fc3f7',
                        background: '#4fc3f720',
                        border: '1px solid #4fc3f740',
                      }}
                    >
                      {row.agentRole.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">{describeSchedule(row.schedule)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className="text-xs"
                    style={{
                      color:
                        row.lastStatus === 'error'
                          ? '#ef4444'
                          : row.lastStatus === 'ok'
                            ? '#00ff9d'
                            : '#64748b',
                    }}
                  >
                    {row.lastStatus === 'error' ? '✕ ' : row.lastStatus === 'ok' ? '✓ ' : ''}
                    {formatRelative(row.lastRunAt, now)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Next: {formatFuture(row.nextRunAt, now)}
                  </div>
                </div>
              </div>
              {row.lastStatus === 'error' && row.lastDetail && (
                <div
                  className="px-5 py-2 text-xs"
                  style={{
                    background: '#2a0f0f',
                    color: '#f87171',
                    borderTop: '1px solid #1e2040',
                  }}
                >
                  {row.lastDetail}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
