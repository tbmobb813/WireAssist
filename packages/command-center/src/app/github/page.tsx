'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useAgentEvents } from '@/hooks/useAgentEvents';
import { ObjectivePicker, useActiveObjectives } from '../objective-picker';

interface GithubApproval {
  id: string;
  taskId: string;
  agentRole: string;
  action: string;
  payload: Record<string, unknown>;
  status: string;
  createdAt: string;
}

export default function GithubPage() {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<GithubApproval[]>([]);
  const [acting, setActing] = useState<string | null>(null);
  const [objectiveId, setObjectiveId] = useState('');
  const activeObjectives = useActiveObjectives();

  const pendingTaskId = useRef<string | null>(null);

  const fetchPending = useCallback(async () => {
    const res = await fetch('/api/approvals');
    if (!res.ok) return;
    const all = (await res.json()) as GithubApproval[];
    setPending(all.filter((a) => a.agentRole === 'github'));
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  useAgentEvents(
    useCallback(
      (e) => {
        if (e.event === 'github_freeform_response') {
          if (e.payload.taskId !== pendingTaskId.current) return;
          setResponse(e.payload.response);
          setAsking(false);
          pendingTaskId.current = null;
        }
        if (e.event === 'task_failed' && e.payload.agentRole === 'github') {
          if (e.payload.taskId !== pendingTaskId.current) return;
          setError(e.payload.error);
          setAsking(false);
          pendingTaskId.current = null;
        }
        if (e.event === 'waiting_approval' || e.event === 'approval_resolved') {
          fetchPending();
        }
      },
      [fetchPending]
    )
  );

  const runFreeform = async () => {
    if (!prompt.trim()) return;
    setError(null);
    setResponse(null);
    setAsking(true);
    try {
      const res = await fetch('/api/tasks/github-freeform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), objectiveId: objectiveId || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        setAsking(false);
        return;
      }
      pendingTaskId.current = data.taskId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the API');
      setAsking(false);
    }
  };

  const resolveApproval = async (id: string, approved: boolean) => {
    setActing(id);
    await fetch(`/api/approvals/${id}/${approved ? 'approve' : 'reject'}`, { method: 'POST' });
    setPending((prev) => prev.filter((a) => a.id !== id));
    setActing(null);
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="text-xs tracking-widest text-accent mb-2">WIREASSIST // GITHUB</div>
        <h1 className="text-3xl font-black">GITHUB DEV AGENT</h1>
        <p className="text-gray-500 text-sm mt-2">
          Reads issues, pull requests, and code from your repos directly — real MCP access, not a
          web search. Comments, labels, and draft-only pull requests always wait for your approval
          below; it never merges, closes, or pushes anything.
        </p>
      </div>

      <div
        className="rounded-lg border p-5 mb-5"
        style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
      >
        <div className="text-xs tracking-widest text-gray-500 mb-3">ASK ABOUT A REPO</div>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runFreeform()}
          placeholder="e.g. what are the open issues on owner/repo?"
          className="w-full rounded px-3 py-2 text-sm mb-3 outline-none"
          style={{ background: '#080810', border: '1px solid #1e2040', color: '#e2e8f0' }}
        />
        <ObjectivePicker
          objectives={activeObjectives}
          value={objectiveId}
          onChange={setObjectiveId}
        />
        <button
          onClick={runFreeform}
          disabled={asking || !prompt.trim()}
          className="w-full py-2 rounded text-xs font-bold tracking-widest transition-colors"
          style={{
            background: asking || !prompt.trim() ? '#1e2040' : '#ffb34720',
            border: `1px solid ${asking || !prompt.trim() ? '#1e2040' : '#ffb34740'}`,
            color: asking || !prompt.trim() ? '#475569' : '#ffb347',
            cursor: asking || !prompt.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {asking ? 'ASKING...' : '→ ASK'}
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

      {response && (
        <div
          className="rounded-lg border p-5 mb-5"
          style={{ background: '#0d0d1a', borderColor: '#00ff9d30' }}
        >
          <div className="text-xs tracking-widest mb-3" style={{ color: '#00ff9d' }}>
            RESPONSE
          </div>
          <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{response}</p>
        </div>
      )}

      <div
        className="rounded-lg border p-5 mb-5"
        style={{ background: '#0d0d1a', borderColor: '#ffb34740' }}
      >
        <div className="text-xs tracking-widest mb-3" style={{ color: '#ffb347' }}>
          PENDING REVIEW {pending.length > 0 ? `— ${pending.length}` : ''}
        </div>
        {pending.length === 0 ? (
          <p className="text-xs text-gray-600">
            Nothing awaiting review. A comment, label change, or draft PR lands here before it
            actually happens.
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
                <pre className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed mb-3 overflow-x-auto">
                  {JSON.stringify(p.payload, null, 2)}
                </pre>
                <div className="flex gap-3">
                  <button
                    onClick={() => resolveApproval(p.id, true)}
                    disabled={acting === p.id}
                    className="flex-1 py-2 rounded text-xs font-bold tracking-widest transition-colors"
                    style={{
                      background: '#00ff9d20',
                      border: '1px solid #00ff9d40',
                      color: '#00ff9d',
                      cursor: acting === p.id ? 'not-allowed' : 'pointer',
                    }}
                  >
                    APPROVE
                  </button>
                  <button
                    onClick={() => resolveApproval(p.id, false)}
                    disabled={acting === p.id}
                    className="flex-1 py-2 rounded text-xs font-bold tracking-widest transition-colors"
                    style={{
                      background: '#f0525220',
                      border: '1px solid #f0525240',
                      color: '#f87171',
                      cursor: acting === p.id ? 'not-allowed' : 'pointer',
                    }}
                  >
                    REJECT
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
