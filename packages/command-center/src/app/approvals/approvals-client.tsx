'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAgentEvents } from '@/hooks/useAgentEvents';
import Link from 'next/link';

interface ApprovalRequest {
  id: string;
  taskId: string;
  agentRole: string;
  action: string;
  payload: Record<string, unknown>;
  status: string;
  createdAt: string;
}

// Renders the fields most payloads across agents already share as readable
// text (mirrors what /content and /research already do inline for their own
// pending-review lists) — anything not recognized still falls through to the
// raw JSON block below, so this never hides information, only surfaces the
// common case more clearly.
// The agent-side wait in ApprovalQueue.request() (wireassist/core) polls for
// up to 300 * 2000ms = exactly 10 minutes before giving up and treating the
// approval as rejected — but it never updates the DB row's status, so a
// pending card can keep offering Approve/Reject well past the point where
// tapping Approve actually does anything. This mirrors that same constant
// so the UI's staleness warning lines up with the real timeout, not a
// guessed number.
const APPROVAL_TIMEOUT_MS = 300 * 2000;
const STALE_WARNING_MS = APPROVAL_TIMEOUT_MS - 2 * 60 * 1000; // warn 2 min before timeout

function formatAge(
  createdAt: string,
  now: Date
): { text: string; stale: 'timedOut' | 'soon' | null } {
  const elapsedMs = now.getTime() - new Date(createdAt).getTime();
  const elapsedMin = Math.floor(elapsedMs / 60000);

  if (elapsedMs >= APPROVAL_TIMEOUT_MS) {
    return { text: `${elapsedMin} min ago — may have already timed out`, stale: 'timedOut' };
  }
  if (elapsedMs >= STALE_WARNING_MS) {
    return { text: `${elapsedMin} min ago — approve soon`, stale: 'soon' };
  }
  if (elapsedMin < 1) {
    return { text: 'just now', stale: null };
  }
  return { text: `${elapsedMin} min ago`, stale: null };
}

function PayloadPreview({ payload }: { payload: Record<string, unknown> }) {
  const text = typeof payload.content === 'string' ? payload.content : undefined;
  const summary =
    typeof payload.summary === 'string'
      ? payload.summary
      : typeof payload.synthesis === 'string'
        ? payload.synthesis
        : undefined;
  const sources = Array.isArray(payload.sources)
    ? payload.sources.filter((s): s is string => typeof s === 'string')
    : undefined;
  const analysis = payload.analysis as
    { score?: number; estimatedEngagement?: string; suggestion?: string } | undefined;
  const delegation =
    typeof payload.targetRole === 'string' && typeof payload.prompt === 'string'
      ? { targetRole: payload.targetRole, prompt: payload.prompt }
      : undefined;
  // proposeBatchOrAutoApprove's bundled batch shape (email-triage.ts) — one
  // approval covering several individually-labeled actions at once. Each
  // action's own `payload.body` (e.g. a drafted email reply's actual text)
  // is kept here too, not just the label — the label says *that* something
  // will happen ("Draft reply to: X"), not *what* it says, and approving a
  // batch without ever seeing the drafted content defeats the point of a
  // human-in-the-loop review.
  const batchActions = Array.isArray(payload.actions)
    ? (payload.actions as { id?: string; label?: string; payload?: Record<string, unknown> }[])
        .filter(
          (a): a is { id?: string; label: string; payload?: Record<string, unknown> } =>
            typeof a?.label === 'string'
        )
        .map((a) => ({
          id: a.id,
          label: a.label,
          body: typeof a.payload?.body === 'string' ? a.payload.body : undefined,
        }))
    : undefined;

  const recognized = text || summary || sources || analysis || delegation || batchActions;
  if (!recognized) return null;

  return (
    <div className="mb-4 space-y-3">
      {(text || summary) && (
        <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
          {text ?? summary}
        </p>
      )}
      {delegation && (
        <p className="text-sm text-gray-300">
          → <span className="font-bold">{delegation.targetRole}</span>: {delegation.prompt}
        </p>
      )}
      {analysis && (
        <p className="text-xs text-gray-500">
          {typeof analysis.score === 'number' && <>Score: {analysis.score} · </>}
          {analysis.estimatedEngagement && <>Est. engagement: {analysis.estimatedEngagement}</>}
        </p>
      )}
      {sources && sources.length > 0 && (
        <div className="space-y-1">
          {sources.map((s, i) => (
            <a
              key={i}
              href={s}
              target="_blank"
              rel="noreferrer"
              className="block text-xs text-gray-500 hover:text-accent truncate"
            >
              {s}
            </a>
          ))}
        </div>
      )}
      {batchActions && batchActions.length > 0 && (
        <ul className="space-y-2">
          {batchActions.map((a, i) => (
            <li
              key={a.id ?? i}
              className="text-sm text-gray-300 pl-3"
              style={{ borderLeft: '2px solid #1e2040' }}
            >
              <div>{a.label}</div>
              {a.body &&
                (a.body.length > 150 ? (
                  <details className="mt-1">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                      {a.body.slice(0, 150)}… <span className="text-accent">(show full text)</span>
                    </summary>
                    <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap leading-relaxed">
                      {a.body}
                    </p>
                  </details>
                ) : (
                  <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap leading-relaxed">
                    {a.body}
                  </p>
                ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ApprovalsClient() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Elapsed-time display needs to advance even when nothing else changes —
  // a card sitting untouched for 9 minutes should visibly age without
  // requiring a new fetch/event to trigger a re-render.
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(tick);
  }, []);

  const fetchApprovals = useCallback(async () => {
    const res = await fetch('/api/approvals');
    const data = await res.json();
    setApprovals(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  useAgentEvents(
    useCallback(
      (e) => {
        if (e.event === 'waiting_approval') {
          fetchApprovals();
        }
        if (e.event === 'approval_resolved') {
          fetchApprovals();
        }
      },
      [fetchApprovals]
    )
  );

  const resolve = async (id: string, approved: boolean) => {
    setActing(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/approvals/${id}/${approved ? 'approve' : 'reject'}`, {
        method: 'POST',
      });
      if (!res.ok) {
        setActionError({
          id,
          message: `Couldn't ${approved ? 'approve' : 'reject'} — server said no (${res.status}). Try again.`,
        });
        return;
      }
      // Only remove the card once the server has confirmed the action —
      // removing it unconditionally (the old behavior) made a failed
      // approve/reject look identical to a successful one.
      setApprovals((prev) => prev.filter((a) => a.id !== id));
    } catch {
      setActionError({
        id,
        message: "Couldn't reach the server — check your connection and try again.",
      });
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black">Approvals</h1>
        <p className="text-gray-500 text-sm mt-2">
          {approvals.length === 0
            ? 'Nothing needs your OK right now.'
            : `${approvals.length} thing${approvals.length > 1 ? 's' : ''} need${approvals.length > 1 ? '' : 's'} your OK.`}
        </p>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm">Loading...</div>
      ) : approvals.length === 0 ? (
        <div
          className="rounded-lg border p-12 text-center"
          style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
        >
          <div className="text-4xl mb-4">✓</div>
          <div className="text-gray-400 text-sm">All clear. No pending approvals.</div>
          <Link href="/" className="mt-4 inline-block text-xs text-accent hover:underline">
            Back to dashboard
          </Link>
        </div>
      ) : (
        <div className="space-y-4 max-w-3xl">
          {approvals.map((approval) => (
            <div
              key={approval.id}
              className="rounded-lg border overflow-hidden"
              style={{ background: '#0d0d1a', borderColor: '#ffb34740' }}
            >
              {/* Header */}
              <div
                className="px-5 py-3 flex items-center justify-between"
                style={{ borderBottom: '1px solid #1e2040', background: '#0f0e1a' }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="text-xs tracking-widest px-2 py-0.5 rounded"
                    style={{
                      color: '#ffb347',
                      background: '#ffb34720',
                      border: '1px solid #ffb34740',
                    }}
                  >
                    {approval.agentRole.toUpperCase()}
                  </span>
                  {(() => {
                    const age = formatAge(approval.createdAt, now);
                    return (
                      <span
                        className="text-xs"
                        style={{
                          color:
                            age.stale === 'timedOut'
                              ? '#ef4444'
                              : age.stale === 'soon'
                                ? '#ffb347'
                                : '#64748b',
                        }}
                      >
                        {age.text}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Action — the plain-English summary leads (what this
                  actually asks you to do), with the raw action string
                  demoted to a small secondary line beneath it, not the
                  first thing read. */}
              <div className="px-5 py-4">
                <PayloadPreview payload={approval.payload} />

                <div className="text-xs text-gray-400 mb-4">{approval.action}</div>

                <details>
                  <summary className="text-xs text-gray-500 mb-2 cursor-pointer hover:text-gray-400">
                    Show raw details
                  </summary>
                  <pre
                    className="text-xs text-gray-400 rounded p-3 mt-2 overflow-x-auto"
                    style={{ background: '#080810', border: '1px solid #1e2040' }}
                  >
                    {JSON.stringify(approval.payload, null, 2)}
                  </pre>
                </details>
              </div>

              {/* Actions */}
              {actionError?.id === approval.id && (
                <div
                  className="px-5 py-2 text-xs"
                  style={{
                    background: '#2a0f0f',
                    color: '#f87171',
                    borderTop: '1px solid #1e2040',
                  }}
                >
                  {actionError.message}
                </div>
              )}
              {/* py-4 + text-sm keeps both buttons comfortably above the
                  ~48px mobile tap-target minimum (the old py-2 text-xs was
                  ~32px tall); gap-4 (up from gap-3) adds separation so a
                  mis-tap on a moving bus is less likely to fire the wrong
                  one. */}
              <div className="px-5 py-3 flex gap-4" style={{ borderTop: '1px solid #1e2040' }}>
                <button
                  onClick={() => resolve(approval.id, true)}
                  disabled={acting === approval.id}
                  className="flex-1 py-4 rounded-lg text-sm font-bold tracking-wide transition-colors"
                  style={{
                    background: '#00ff9d20',
                    border: '1px solid #00ff9d40',
                    color: '#00ff9d',
                  }}
                >
                  {acting === approval.id ? '...' : '✓ Approve'}
                </button>
                <button
                  onClick={() => resolve(approval.id, false)}
                  disabled={acting === approval.id}
                  className="flex-1 py-4 rounded-lg text-sm font-bold tracking-wide transition-colors"
                  style={{
                    background: '#ef444420',
                    border: '1px solid #ef444440',
                    color: '#ef4444',
                  }}
                >
                  {acting === approval.id ? '...' : '✕ Reject'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
