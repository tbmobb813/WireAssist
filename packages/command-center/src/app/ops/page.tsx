'use client';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAgentEvents } from '@/hooks/useAgentEvents';

const STAGE_LABEL: Record<string, string> = {
  diagnose: 'Diagnose',
  assemble: 'Assemble',
  take_action: 'Take Action',
  assess: 'Assess',
};

interface WorkflowTodo {
  label: string;
  instruction: string;
}

// Workflow files mark unfilled inputs as `- Label: _TODO: instruction_` (see
// packages/agents/ops/context/workflows/*.md) — parse those into dedicated
// fields instead of making JNix guess what to paste into one big brief box.
function parseWorkflowTodos(markdown: string | null): WorkflowTodo[] {
  if (!markdown) return [];
  const todos: WorkflowTodo[] = [];
  const re = /^-\s*(.+?):\s*_TODO:\s*(.+?)_\s*$/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null) {
    todos.push({ label: match[1].trim(), instruction: match[2].trim() });
  }
  return todos;
}

interface PastRun {
  id: string;
  content: string;
  tags: string[];
  createdAt: string;
}

interface OpsApproval {
  id: string;
  taskId: string;
  agentRole: string;
  action: string;
  payload: {
    workflow?: string;
    brief?: string;
    assessment?: string;
  };
  status: string;
  createdAt: string;
}

export default function OpsPage() {
  const [workflows, setWorkflows] = useState<string[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState('');
  const [workflowPreview, setWorkflowPreview] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [trustStage, setTrustStageState] = useState(2);
  const [savingTrustStage, setSavingTrustStage] = useState(false);
  const [brief, setBrief] = useState('');
  const [todoValues, setTodoValues] = useState<Record<string, string>>({});
  const [freeformPrompt, setFreeformPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [stages, setStages] = useState<string[]>([]);
  const [runResult, setRunResult] = useState<{
    workflow: string;
    approved: boolean;
    autoApproved: boolean;
    transcript: string;
  } | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [blockedDiagnosis, setBlockedDiagnosis] = useState<string | null>(null);
  const [freeformResponse, setFreeformResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pastRuns, setPastRuns] = useState<PastRun[]>([]);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [pending, setPending] = useState<OpsApproval[]>([]);
  const [acting, setActing] = useState<string | null>(null);

  const pendingTaskId = useRef<string | null>(null);

  const loadPastRuns = useCallback(() => {
    fetch('/api/memory?agentRole=strategy')
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setPastRuns(d))
      .catch(() => {});
  }, []);

  const fetchPending = useCallback(async () => {
    const res = await fetch('/api/approvals');
    if (!res.ok) return;
    const all = (await res.json()) as OpsApproval[];
    setPending(all.filter((a) => a.agentRole === 'strategy'));
  }, []);

  useEffect(() => {
    fetch('/api/ops/workflows')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.workflows)) {
          setWorkflows(d.workflows);
          if (d.workflows.length > 0) setSelectedWorkflow(d.workflows[0]);
        }
      })
      .catch(() => {});
    loadPastRuns();
    fetchPending();
  }, [loadPastRuns, fetchPending]);

  // Preview what a workflow actually requires, so the brief can be written to
  // satisfy it instead of guessing and hitting VERDICT: BLOCKED.
  useEffect(() => {
    if (!selectedWorkflow) return;
    setWorkflowPreview(null);
    setTodoValues({});
    fetch(`/api/ops/workflows/${encodeURIComponent(selectedWorkflow)}`)
      .then((r) => r.json())
      .then((d) => setWorkflowPreview(typeof d.content === 'string' ? d.content : null))
      .catch(() => setWorkflowPreview(null));
  }, [selectedWorkflow]);

  const workflowTodos = useMemo(() => parseWorkflowTodos(workflowPreview), [workflowPreview]);

  useEffect(() => {
    if (!selectedWorkflow) return;
    fetch(`/api/ops/trust/${encodeURIComponent(selectedWorkflow)}`)
      .then((r) => r.json())
      .then((d) => typeof d.stage === 'number' && setTrustStageState(d.stage))
      .catch(() => {});
  }, [selectedWorkflow]);

  async function updateTrustStage(stage: number) {
    if (!selectedWorkflow) return;
    setSavingTrustStage(true);
    try {
      const res = await fetch(`/api/ops/trust/${encodeURIComponent(selectedWorkflow)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
      const data = await res.json().catch(() => ({}));
      if (typeof data.stage === 'number') setTrustStageState(data.stage);
    } finally {
      setSavingTrustStage(false);
    }
  }

  useAgentEvents(
    useCallback(
      (e) => {
        if (e.event === 'ops_stage_complete') {
          if (e.payload.taskId !== pendingTaskId.current) return;
          setStages((prev) => [...prev, e.payload.stage]);
          return; // not terminal — keep listening
        }
        if (e.event === 'ops_blocked') {
          if (e.payload.taskId !== pendingTaskId.current) return;
          setBlockedDiagnosis(e.payload.diagnosis);
          setGenerating(false);
          pendingTaskId.current = null;
        }
        if (e.event === 'ops_run_complete') {
          if (e.payload.taskId !== pendingTaskId.current) return;
          setRunResult({
            workflow: e.payload.workflow,
            approved: e.payload.approved,
            autoApproved: e.payload.autoApproved,
            transcript: e.payload.transcript,
          });
          setGenerating(false);
          pendingTaskId.current = null;
          loadPastRuns();
        }
        if (e.event === 'ops_freeform_response') {
          if (e.payload.taskId !== pendingTaskId.current) return;
          setFreeformResponse(e.payload.response);
          setGenerating(false);
          pendingTaskId.current = null;
        }
        if (e.event === 'task_failed' && e.payload.agentRole === 'strategy') {
          if (e.payload.taskId !== pendingTaskId.current) return;
          setError(e.payload.error);
          setGenerating(false);
          pendingTaskId.current = null;
        }
        if (e.event === 'waiting_approval' || e.event === 'approval_resolved') {
          fetchPending();
        }
      },
      [loadPastRuns, fetchPending]
    )
  );

  const resolveApproval = async (id: string, approved: boolean) => {
    setActing(id);
    await fetch(`/api/approvals/${id}/${approved ? 'approve' : 'reject'}`, { method: 'POST' });
    setPending((prev) => prev.filter((a) => a.id !== id));
    setActing(null);
  };

  async function fire(path: string, body: Record<string, unknown>) {
    setError(null);
    setStages([]);
    setRunResult(null);
    setShowTranscript(false);
    setBlockedDiagnosis(null);
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

  const runWorkflow = () => {
    if (!selectedWorkflow || !brief.trim()) return;
    const filledTodos = workflowTodos
      .map((t) => ({ ...t, value: (todoValues[t.label] ?? '').trim() }))
      .filter((t) => t.value);
    const fullBrief =
      filledTodos.length === 0
        ? brief.trim()
        : [
            brief.trim(),
            [
              'ADDITIONAL INPUTS PROVIDED:',
              ...filledTodos.map((t) => `- ${t.label}: ${t.value}`),
            ].join('\n'),
          ].join('\n\n');
    fire('/api/tasks/ops-workflow', { workflow: selectedWorkflow, brief: fullBrief });
  };

  const runFreeform = () =>
    freeformPrompt.trim() && fire('/api/tasks/ops-freeform', { prompt: freeformPrompt.trim() });

  return (
    <div className="min-h-screen p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/" className="text-xs text-gray-600 hover:text-accent tracking-widest">
          ← COMMAND CENTER
        </Link>
      </div>

      <div className="mb-8">
        <div className="text-xs tracking-widest text-accent mb-2">WIREASSIST // OPS</div>
        <h1 className="text-3xl font-black">NIXOPS</h1>
        <p className="text-gray-500 text-sm mt-2">
          Run a named business workflow through the DATA loop (Diagnose → Assemble → Take Action →
          Assess), or ask a general ops question.
        </p>
      </div>

      <div
        className="rounded-lg border p-5 mb-5"
        style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
      >
        <div className="text-xs tracking-widest text-gray-500 mb-3">RUN A WORKFLOW</div>
        {workflows.length === 0 ? (
          <p className="text-xs text-gray-600 mb-3">No workflow files found.</p>
        ) : (
          <select
            value={selectedWorkflow}
            onChange={(e) => setSelectedWorkflow(e.target.value)}
            className="w-full rounded px-3 py-2 text-sm mb-3 outline-none"
            style={{ background: '#080810', border: '1px solid #1e2040', color: '#e2e8f0' }}
          >
            {workflows.map((w) => (
              <option key={w} value={w} style={{ background: '#080810' }}>
                {w}
              </option>
            ))}
          </select>
        )}
        {selectedWorkflow && (
          <div className="mb-3">
            <button
              onClick={() => setShowPreview((v) => !v)}
              className="text-xs text-gray-500 hover:text-accent"
            >
              {showPreview ? '▾' : '▸'} View workflow requirements
            </button>
            {showPreview && (
              <div
                className="mt-2 rounded p-3 text-xs text-gray-400 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto"
                style={{ background: '#080810', border: '1px solid #1e2040' }}
              >
                {workflowPreview ?? 'Loading...'}
              </div>
            )}
          </div>
        )}
        {workflowTodos.length > 0 && (
          <div
            className="rounded p-3 mb-3"
            style={{ background: '#080810', border: '1px solid #1e2040' }}
          >
            <div className="text-xs tracking-widest text-gray-500 mb-2">
              INPUTS THIS WORKFLOW NEEDS
            </div>
            <div className="space-y-2">
              {workflowTodos.map((t) => (
                <div key={t.label}>
                  <label className="text-xs text-gray-400 block mb-1">{t.label}</label>
                  <textarea
                    value={todoValues[t.label] ?? ''}
                    onChange={(e) =>
                      setTodoValues((prev) => ({ ...prev, [t.label]: e.target.value }))
                    }
                    placeholder={t.instruction}
                    rows={2}
                    className="w-full rounded px-3 py-2 text-xs outline-none resize-none"
                    style={{ background: '#0d0d1a', border: '1px solid #1e2040', color: '#e2e8f0' }}
                  />
                </div>
              ))}
            </div>
            <div className="text-xs text-gray-600 mt-2">
              Optional — leave blank and the run will escalate back to you for whatever&apos;s
              missing instead of guessing.
            </div>
          </div>
        )}
        {selectedWorkflow && (
          <div
            className="rounded p-3 mb-3 flex items-center justify-between gap-3"
            style={{ background: '#080810', border: '1px solid #1e2040' }}
          >
            <div>
              <div className="text-xs text-gray-400">
                Trust stage: <span style={{ color: '#4fc3f7' }}>{trustStage}</span>
                {trustStage >= 3 && (
                  <span className="text-gray-600"> — auto-delivers, no approval</span>
                )}
              </div>
              <div className="text-xs text-gray-600 mt-0.5">
                {trustStage === 2
                  ? 'Every run waits for your approval before delivering.'
                  : 'Runs deliver automatically. Safe to trigger via an external cron for unattended (heartbeat) runs.'}
              </div>
            </div>
            <select
              value={trustStage}
              disabled={savingTrustStage}
              onChange={(e) => updateTrustStage(Number(e.target.value))}
              className="rounded px-2 py-1 text-xs outline-none flex-shrink-0"
              style={{ background: '#0d0d1a', border: '1px solid #1e2040', color: '#e2e8f0' }}
            >
              <option value={2} style={{ background: '#0d0d1a' }}>
                Stage 2 — approve everything
              </option>
              <option value={3} style={{ background: '#0d0d1a' }}>
                Stage 3 — pre-approved
              </option>
              <option value={4} style={{ background: '#0d0d1a' }}>
                Stage 4 — heartbeat (unattended)
              </option>
            </select>
          </div>
        )}
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Brief — what should this run accomplish?"
          rows={3}
          className="w-full rounded px-3 py-2 text-sm mb-3 outline-none resize-none"
          style={{ background: '#080810', border: '1px solid #1e2040', color: '#e2e8f0' }}
        />
        <button
          onClick={runWorkflow}
          disabled={generating || !selectedWorkflow || !brief.trim()}
          className="w-full py-2 rounded text-xs font-bold tracking-widest transition-colors"
          style={{
            background: generating || !brief.trim() ? '#1e2040' : '#4fc3f720',
            border: `1px solid ${generating || !brief.trim() ? '#1e2040' : '#4fc3f740'}`,
            color: generating || !brief.trim() ? '#475569' : '#4fc3f7',
            cursor: generating || !brief.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {generating ? 'RUNNING...' : '→ RUN WORKFLOW'}
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
          placeholder="e.g. what's the status of the Q3 workflow doc?"
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

      {error && (
        <div
          className="rounded-lg border p-4 mb-5 text-sm"
          style={{ background: '#2a0f0f', borderColor: '#f0525240', color: '#f87171' }}
        >
          {error}
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
            Nothing awaiting review. A trust-stage-2 run stays here until you approve or reject it —
            the run itself is paused until you decide, whether from here, the Approvals tab, or
            Telegram.
          </p>
        ) : (
          <div className="space-y-4">
            {pending.map((p) => (
              <div
                key={p.id}
                className="rounded p-4"
                style={{ background: '#080810', border: '1px solid #1e2040' }}
              >
                <div className="text-xs text-gray-500 mb-2">
                  Workflow &quot;{p.payload.workflow}&quot;
                </div>
                {p.payload.brief && (
                  <div className="text-xs text-gray-600 mb-2">Brief: {p.payload.brief}</div>
                )}
                <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed mb-3 max-h-64 overflow-y-auto">
                  {p.payload.assessment}
                </p>
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

      {stages.length > 0 && (
        <div
          className="rounded-lg border p-5 mb-5"
          style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
        >
          <div className="text-xs tracking-widest text-gray-500 mb-3">DATA LOOP PROGRESS</div>
          <div className="flex gap-2 flex-wrap">
            {stages.map((s, i) => (
              <span
                key={i}
                className="text-xs px-3 py-1 rounded"
                style={{ background: '#4fc3f720', border: '1px solid #4fc3f740', color: '#4fc3f7' }}
              >
                ✓ {STAGE_LABEL[s] ?? s}
              </span>
            ))}
            {generating && (
              <span className="text-xs px-3 py-1 rounded text-gray-500">running next stage...</span>
            )}
          </div>
        </div>
      )}

      {blockedDiagnosis && (
        <div
          className="rounded-lg border p-5"
          style={{ background: '#2a1a0f', borderColor: '#ffb34740' }}
        >
          <div className="text-xs tracking-widest mb-3" style={{ color: '#ffb347' }}>
            BLOCKED
          </div>
          <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
            {blockedDiagnosis}
          </p>
        </div>
      )}

      {runResult && (
        <div
          className="rounded-lg border p-5"
          style={{ background: '#0d0d1a', borderColor: '#00ff9d30' }}
        >
          <div className="text-xs tracking-widest mb-2" style={{ color: '#00ff9d' }}>
            RUN COMPLETE
          </div>
          <p className="text-sm text-gray-300 mb-3">
            Workflow &quot;{runResult.workflow}&quot;{' '}
            {runResult.autoApproved
              ? 'completed and auto-delivered (trust stage 3+ — no approval needed).'
              : runResult.approved
                ? 'completed and approved.'
                : 'completed, not approved — check the Approvals tab.'}
          </p>
          <button
            onClick={() => setShowTranscript((v) => !v)}
            className="text-xs text-gray-500 hover:text-accent"
          >
            {showTranscript ? '▾' : '▸'} View full output
          </button>
          {showTranscript && (
            <div
              className="mt-2 rounded p-3 text-xs text-gray-300 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto"
              style={{ background: '#080810', border: '1px solid #1e2040' }}
            >
              {runResult.transcript}
            </div>
          )}
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

      <div
        className="rounded-lg border p-5"
        style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
      >
        <div className="text-xs tracking-widest text-gray-500 mb-3">PAST RUNS</div>
        {pastRuns.length === 0 ? (
          <p className="text-xs text-gray-600">No completed workflow runs yet.</p>
        ) : (
          <div className="space-y-2">
            {pastRuns.map((run) => {
              const open = expandedRun === run.id;
              const firstLine = run.content.split('\n')[0];
              return (
                <div
                  key={run.id}
                  className="rounded"
                  style={{ background: '#080810', border: '1px solid #1e2040' }}
                >
                  <button
                    onClick={() => setExpandedRun(open ? null : run.id)}
                    className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:text-accent"
                  >
                    {open ? '▾' : '▸'} {firstLine}
                    <span className="text-gray-600 ml-2">
                      {new Date(run.createdAt).toLocaleString()}
                    </span>
                  </button>
                  {open && (
                    <div className="px-3 pb-3 text-xs text-gray-300 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                      {run.content}
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
