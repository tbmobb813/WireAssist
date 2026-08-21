'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useAgentEvents } from '@/hooks/useAgentEvents';
import { ObjectivePicker, useActiveObjectives } from '../objective-picker';

interface TriageCategories {
  urgent: { threadId: string; from: string; subject: string; reason: string }[];
  replyNeeded: { threadId: string; from: string; subject: string; draftReply: string }[];
  fyi: { threadId: string; from: string; subject: string }[];
  ignore: { threadId: string; from: string; reason: string }[];
}

interface TriageResult {
  summary: string;
  categories: TriageCategories;
}

interface CalendarReviewResult {
  summary: string;
  conflicts: { event1: string; event2: string; overlap: string }[];
  overloadedDays: { date: string; eventCount: number; recommendation: string }[];
}

interface DailyBriefingResult {
  summary: string;
}

interface DigestResult {
  label: string;
  summary: string;
}

interface AdminApproval {
  id: string;
  taskId: string;
  agentRole: string;
  action: string;
  payload: {
    summary?: string;
    body?: string;
    to?: string;
    subject?: string;
  };
  status: string;
  createdAt: string;
}

// One-click "run now" nudges/digests — no form, sensible server-side
// defaults. Each already has a working route from prior work in this
// project; this page is their first UI surface.
const DIGEST_BUTTONS: { path: string; label: string; event: string }[] = [
  { path: '/api/tasks/meeting-prep', label: 'Meeting Prep', event: 'meeting_prep_complete' },
  {
    path: '/api/tasks/meeting-followup',
    label: 'Meeting Follow-up',
    event: 'meeting_followup_complete',
  },
  {
    path: '/api/tasks/objective-health-check',
    label: 'Objective Health Check',
    event: 'objective_health_check_complete',
  },
  {
    path: '/api/tasks/travel-itinerary',
    label: 'Travel Itinerary',
    event: 'travel_itinerary_digest_complete',
  },
  { path: '/api/tasks/expense-digest', label: 'Expense Digest', event: 'expense_digest_complete' },
];

export default function AdminPage() {
  const [maxEmails, setMaxEmails] = useState(20);
  const [daysAhead, setDaysAhead] = useState(7);
  const [freeformPrompt, setFreeformPrompt] = useState('');
  const [freeformResponse, setFreeformResponse] = useState<string | null>(null);
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [calendarResult, setCalendarResult] = useState<CalendarReviewResult | null>(null);
  const [briefingResult, setBriefingResult] = useState<DailyBriefingResult | null>(null);
  const [digestResult, setDigestResult] = useState<DigestResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [digestRunning, setDigestRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<AdminApproval[]>([]);
  const [acting, setActing] = useState<string | null>(null);
  const [objectiveId, setObjectiveId] = useState('');
  const activeObjectives = useActiveObjectives();

  const pendingTaskId = useRef<string | null>(null);
  const pendingDigestTaskId = useRef<string | null>(null);

  const fetchPending = useCallback(async () => {
    const res = await fetch('/api/approvals');
    if (!res.ok) return;
    const all = (await res.json()) as AdminApproval[];
    setPending(all.filter((a) => a.agentRole === 'admin'));
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  useAgentEvents(
    useCallback(
      (e) => {
        if (e.event === 'triage_complete' && e.payload.taskId === pendingTaskId.current) {
          setTriageResult({ summary: e.payload.summary, categories: e.payload.categories });
          setGenerating(false);
          pendingTaskId.current = null;
        }
        if (e.event === 'calendar_review_complete' && e.payload.taskId === pendingTaskId.current) {
          setCalendarResult({
            summary: e.payload.review.summary,
            conflicts: e.payload.review.conflicts,
            overloadedDays: e.payload.review.overloadedDays,
          });
          setGenerating(false);
          pendingTaskId.current = null;
        }
        if (e.event === 'daily_briefing_complete' && e.payload.taskId === pendingTaskId.current) {
          setBriefingResult({ summary: e.payload.summary });
          setGenerating(false);
          pendingTaskId.current = null;
        }
        if (e.event === 'freeform_response' && e.payload.taskId === pendingTaskId.current) {
          setFreeformResponse(e.payload.response);
          setGenerating(false);
          pendingTaskId.current = null;
        }
        if (e.event === 'task_failed' && e.payload.agentRole === 'admin') {
          if (e.payload.taskId === pendingTaskId.current) {
            setError(e.payload.error);
            setGenerating(false);
            pendingTaskId.current = null;
          }
          if (e.payload.taskId === pendingDigestTaskId.current) {
            setError(e.payload.error);
            setDigestRunning(null);
            pendingDigestTaskId.current = null;
          }
        }
        if (
          (e.event === 'meeting_prep_complete' ||
            e.event === 'meeting_followup_complete' ||
            e.event === 'objective_health_check_complete' ||
            e.event === 'travel_itinerary_digest_complete' ||
            e.event === 'expense_digest_complete') &&
          e.payload.taskId === pendingDigestTaskId.current
        ) {
          const digest = DIGEST_BUTTONS.find((d) => d.event === e.event);
          setDigestResult({ label: digest?.label ?? e.event, summary: e.payload.summary });
          setDigestRunning(null);
          pendingDigestTaskId.current = null;
        }
        if (e.event === 'waiting_approval' || e.event === 'approval_resolved') {
          fetchPending();
        }
      },
      [fetchPending]
    )
  );

  async function fire(path: string, body: Record<string, unknown>) {
    setError(null);
    setTriageResult(null);
    setCalendarResult(null);
    setBriefingResult(null);
    setFreeformResponse(null);
    setGenerating(true);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        setGenerating(false);
        return;
      }
      pendingTaskId.current = data.taskId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the API');
      setGenerating(false);
    }
  }

  async function runDigest(path: string, label: string) {
    setError(null);
    setDigestResult(null);
    setDigestRunning(label);
    try {
      const res = await fetch(path, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        setDigestRunning(null);
        return;
      }
      pendingDigestTaskId.current = data.taskId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the API');
      setDigestRunning(null);
    }
  }

  const runTriage = () =>
    fire('/api/tasks/triage-email', { objectiveId: objectiveId || undefined });
  const runCalendarReview = () =>
    fire('/api/tasks/review-calendar', { daysAhead, objectiveId: objectiveId || undefined });
  const runDailyBriefing = () =>
    fire('/api/tasks/daily-briefing', {
      maxEmails,
      daysAhead,
      objectiveId: objectiveId || undefined,
    });
  const runFreeform = () =>
    freeformPrompt.trim() &&
    fire('/api/tasks/admin-freeform', {
      prompt: freeformPrompt.trim(),
      objectiveId: objectiveId || undefined,
    });

  const resolveApproval = async (id: string, approved: boolean) => {
    setActing(id);
    await fetch(`/api/approvals/${id}/${approved ? 'approve' : 'reject'}`, { method: 'POST' });
    setPending((prev) => prev.filter((a) => a.id !== id));
    setActing(null);
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="text-xs tracking-widest text-accent mb-2">WIREASSIST // ADMINISTRATION</div>
        <h1 className="text-3xl font-black">ADMIN AGENT</h1>
        <p className="text-gray-500 text-sm mt-2">
          Inbox, calendar, and the digests/nudges that keep everything else from going stale.
        </p>
      </div>

      <div className="mb-5">
        <label className="block text-xs text-gray-500 mb-1">
          Tie this to an objective (optional) — applies to every action below.
        </label>
        <ObjectivePicker
          objectives={activeObjectives}
          value={objectiveId}
          onChange={setObjectiveId}
        />
      </div>

      <div
        className="rounded-lg border p-5 mb-5"
        style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
      >
        <div className="text-xs tracking-widest text-gray-500 mb-3">TRIAGE INBOX</div>
        <label className="block text-xs text-gray-600 mb-3">
          Max emails
          <input
            type="number"
            value={maxEmails}
            onChange={(e) => setMaxEmails(Number(e.target.value) || 20)}
            className="ml-2 w-20 rounded px-2 py-1 text-sm outline-none"
            style={{ background: '#080810', border: '1px solid #1e2040', color: '#e2e8f0' }}
          />
        </label>
        <button
          onClick={runTriage}
          disabled={generating}
          className="w-full py-2 rounded text-xs font-bold tracking-widest transition-colors"
          style={{
            background: generating ? '#1e2040' : '#4fc3f720',
            border: `1px solid ${generating ? '#1e2040' : '#4fc3f740'}`,
            color: generating ? '#475569' : '#4fc3f7',
            cursor: generating ? 'not-allowed' : 'pointer',
          }}
        >
          {generating ? 'WORKING...' : '→ TRIAGE INBOX'}
        </button>
      </div>

      <div
        className="rounded-lg border p-5 mb-5"
        style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
      >
        <div className="text-xs tracking-widest text-gray-500 mb-3">REVIEW CALENDAR</div>
        <label className="block text-xs text-gray-600 mb-3">
          Days ahead
          <input
            type="number"
            value={daysAhead}
            onChange={(e) => setDaysAhead(Number(e.target.value) || 7)}
            className="ml-2 w-20 rounded px-2 py-1 text-sm outline-none"
            style={{ background: '#080810', border: '1px solid #1e2040', color: '#e2e8f0' }}
          />
        </label>
        <button
          onClick={runCalendarReview}
          disabled={generating}
          className="w-full py-2 rounded text-xs font-bold tracking-widest transition-colors"
          style={{
            background: generating ? '#1e2040' : '#4fc3f720',
            border: `1px solid ${generating ? '#1e2040' : '#4fc3f740'}`,
            color: generating ? '#475569' : '#4fc3f7',
            cursor: generating ? 'not-allowed' : 'pointer',
          }}
        >
          {generating ? 'WORKING...' : '→ REVIEW CALENDAR'}
        </button>
      </div>

      <div
        className="rounded-lg border p-5 mb-5"
        style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
      >
        <div className="text-xs tracking-widest text-gray-500 mb-3">DAILY BRIEFING</div>
        <p className="text-xs text-gray-600 mb-3">
          Combined inbox triage + calendar review digest.
        </p>
        <button
          onClick={runDailyBriefing}
          disabled={generating}
          className="w-full py-2 rounded text-xs font-bold tracking-widest transition-colors"
          style={{
            background: generating ? '#1e2040' : '#ffb34720',
            border: `1px solid ${generating ? '#1e2040' : '#ffb34740'}`,
            color: generating ? '#475569' : '#ffb347',
            cursor: generating ? 'not-allowed' : 'pointer',
          }}
        >
          {generating ? 'WORKING...' : '→ RUN BRIEFING'}
        </button>
      </div>

      <div
        className="rounded-lg border p-5 mb-5"
        style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
      >
        <div className="text-xs tracking-widest text-gray-500 mb-3">ASK A QUESTION</div>
        <input
          type="text"
          value={freeformPrompt}
          onChange={(e) => setFreeformPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runFreeform()}
          placeholder="e.g. what's on my plate today?"
          className="w-full rounded px-3 py-2 text-sm mb-3 outline-none"
          style={{ background: '#080810', border: '1px solid #1e2040', color: '#e2e8f0' }}
        />
        <button
          onClick={runFreeform}
          disabled={generating || !freeformPrompt.trim()}
          className="w-full py-2 rounded text-xs font-bold tracking-widest transition-colors"
          style={{
            background: generating || !freeformPrompt.trim() ? '#1e2040' : '#ffb34720',
            border: `1px solid ${generating || !freeformPrompt.trim() ? '#1e2040' : '#ffb34740'}`,
            color: generating || !freeformPrompt.trim() ? '#475569' : '#ffb347',
            cursor: generating || !freeformPrompt.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {generating ? 'ASKING...' : '→ ASK'}
        </button>
      </div>

      <div
        className="rounded-lg border p-5 mb-5"
        style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
      >
        <div className="text-xs tracking-widest text-gray-500 mb-3">DIGESTS &amp; NUDGES</div>
        <p className="text-xs text-gray-600 mb-3">
          Run any of these on demand — each also runs on its own cron schedule (see
          docs/DEPLOYMENT.md).
        </p>
        <div className="flex flex-wrap gap-2">
          {DIGEST_BUTTONS.map((d) => (
            <button
              key={d.path}
              onClick={() => runDigest(d.path, d.label)}
              disabled={digestRunning !== null}
              className="text-xs px-3 py-2 rounded font-bold tracking-wide transition-colors"
              style={{
                background: digestRunning === d.label ? '#1e2040' : '#4fc3f715',
                border: `1px solid ${digestRunning === d.label ? '#1e2040' : '#4fc3f740'}`,
                color: digestRunning !== null && digestRunning !== d.label ? '#475569' : '#4fc3f7',
                cursor: digestRunning !== null ? 'not-allowed' : 'pointer',
              }}
            >
              {digestRunning === d.label ? '...' : d.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div
          className="rounded-lg border p-4 mb-5 text-sm"
          style={{ background: '#2a0f0f', borderColor: '#f0525240', color: '#f87171' }}
        >
          {error}
        </div>
      )}

      {triageResult && (
        <div
          className="rounded-lg border p-5 mb-5"
          style={{ background: '#0d0d1a', borderColor: '#00ff9d30' }}
        >
          <div className="text-xs tracking-widest mb-3" style={{ color: '#00ff9d' }}>
            TRIAGE COMPLETE
          </div>
          <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed mb-3">
            {triageResult.summary}
          </p>
          <p className="text-xs text-gray-500">
            Urgent: {triageResult.categories.urgent.length} · Reply needed:{' '}
            {triageResult.categories.replyNeeded.length} · FYI: {triageResult.categories.fyi.length}{' '}
            · Ignored: {triageResult.categories.ignore.length}
          </p>
        </div>
      )}

      {calendarResult && (
        <div
          className="rounded-lg border p-5 mb-5"
          style={{ background: '#0d0d1a', borderColor: '#00ff9d30' }}
        >
          <div className="text-xs tracking-widest mb-3" style={{ color: '#00ff9d' }}>
            CALENDAR REVIEW COMPLETE
          </div>
          <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed mb-3">
            {calendarResult.summary}
          </p>
          <p className="text-xs text-gray-500">
            Conflicts: {calendarResult.conflicts.length} · Overloaded days:{' '}
            {calendarResult.overloadedDays.length}
          </p>
        </div>
      )}

      {briefingResult && (
        <div
          className="rounded-lg border p-5 mb-5"
          style={{ background: '#0d0d1a', borderColor: '#00ff9d30' }}
        >
          <div className="text-xs tracking-widest mb-3" style={{ color: '#00ff9d' }}>
            BRIEFING
          </div>
          <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
            {briefingResult.summary}
          </p>
        </div>
      )}

      {freeformResponse && (
        <div
          className="rounded-lg border p-5 mb-5"
          style={{ background: '#0d0d1a', borderColor: '#00ff9d30' }}
        >
          <div className="text-xs tracking-widest mb-3" style={{ color: '#00ff9d' }}>
            RESPONSE
          </div>
          <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
            {freeformResponse}
          </p>
        </div>
      )}

      {digestResult && (
        <div
          className="rounded-lg border p-5 mb-5"
          style={{ background: '#0d0d1a', borderColor: '#00ff9d30' }}
        >
          <div className="text-xs tracking-widest mb-3" style={{ color: '#00ff9d' }}>
            {digestResult.label.toUpperCase()}
          </div>
          <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
            {digestResult.summary}
          </p>
        </div>
      )}

      <div
        className="rounded-lg border p-5"
        style={{ background: '#0d0d1a', borderColor: '#ffb34740' }}
      >
        <div className="text-xs tracking-widest mb-3" style={{ color: '#ffb347' }}>
          PENDING REVIEW {pending.length > 0 ? `— ${pending.length}` : ''}
        </div>
        {pending.length === 0 ? (
          <p className="text-xs text-gray-600">
            Nothing awaiting review. Triage/calendar suggestions and other admin actions land here.
          </p>
        ) : (
          <div className="space-y-4">
            {pending.map((p) => (
              <div
                key={p.id}
                className="rounded p-4"
                style={{ background: '#080810', border: '1px solid #1e2040' }}
              >
                <div className="text-xs text-gray-500 mb-2">{p.action}</div>
                {(p.payload.summary || p.payload.body) && (
                  <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed mb-3">
                    {p.payload.summary ?? p.payload.body}
                  </p>
                )}
                {p.payload.to && (
                  <p className="text-xs text-gray-500 mb-3">
                    To: {p.payload.to}
                    {p.payload.subject ? ` — ${p.payload.subject}` : ''}
                  </p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => resolveApproval(p.id, true)}
                    disabled={acting === p.id}
                    className="flex-1 py-2 rounded text-xs font-bold tracking-widest transition-colors"
                    style={{
                      background: '#00ff9d20',
                      border: '1px solid #00ff9d40',
                      color: '#00ff9d',
                    }}
                  >
                    {acting === p.id ? '...' : '✓ APPROVE'}
                  </button>
                  <button
                    onClick={() => resolveApproval(p.id, false)}
                    disabled={acting === p.id}
                    className="flex-1 py-2 rounded text-xs font-bold tracking-widest transition-colors"
                    style={{
                      background: '#ef444420',
                      border: '1px solid #ef444440',
                      color: '#ef4444',
                    }}
                  >
                    {acting === p.id ? '...' : '✕ REJECT'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
