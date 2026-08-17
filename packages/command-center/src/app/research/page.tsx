'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAgentEvents } from '@/hooks/useAgentEvents';
import { setContentHandoff } from '@/lib/content-handoff';
import { setOpsHandoff } from '@/lib/ops-handoff';
import { ObjectivePicker, useActiveObjectives } from '../objective-picker';

const CONTENT_PLATFORMS = ['twitter', 'linkedin', 'instagram', 'threads'] as const;
type ContentPlatform = (typeof CONTENT_PLATFORMS)[number];

interface ResearchResult {
  summary: string;
  sources?: string[];
}

interface PastResearch {
  id: string;
  content: string;
  tags: string[];
  createdAt: string;
}

interface ResearchApproval {
  id: string;
  taskId: string;
  agentRole: string;
  action: string;
  payload: {
    summary?: string;
    sources?: string[];
    synthesis?: string;
  };
  status: string;
  createdAt: string;
}

// Research/synthesis entries are stored as `Research on "<query>":\n\n<summary>` —
// pull the quoted topic back out for a sensible pre-filled Content topic field.
function extractTopic(content: string): string {
  const match = content.match(/^(?:Research on|Synthesis on) "(.+)":/);
  return match ? match[1] : content.split('\n')[0].slice(0, 80);
}

export default function ResearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [depth, setDepth] = useState<'quick' | 'deep'>('quick');
  const [draftContent, setDraftContent] = useState(false);
  const [draftPlatform, setDraftPlatform] = useState<ContentPlatform>('linkedin');
  const [synthesizeTopic, setSynthesizeTopic] = useState('');
  const [freeformPrompt, setFreeformPrompt] = useState('');
  const [freeformResponse, setFreeformResponse] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pastResearch, setPastResearch] = useState<PastResearch[]>([]);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [pending, setPending] = useState<ResearchApproval[]>([]);
  const [acting, setActing] = useState<string | null>(null);
  const [objectiveId, setObjectiveId] = useState('');
  const activeObjectives = useActiveObjectives();

  const pendingTaskId = useRef<string | null>(null);

  const loadPastResearch = useCallback(() => {
    fetch('/api/memory?agentRole=research')
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setPastResearch(d))
      .catch(() => {});
  }, []);

  const fetchPending = useCallback(async () => {
    const res = await fetch('/api/approvals');
    if (!res.ok) return;
    const all = (await res.json()) as ResearchApproval[];
    setPending(all.filter((a) => a.agentRole === 'research'));
  }, []);

  useEffect(() => {
    loadPastResearch();
    fetchPending();
  }, [loadPastResearch, fetchPending]);

  useAgentEvents(
    useCallback(
      (e) => {
        if (e.event === 'research_complete') {
          if (e.payload.taskId !== pendingTaskId.current) return;
          setResult({ summary: e.payload.summary, sources: e.payload.sources });
          setGenerating(false);
          pendingTaskId.current = null;
        }
        if (e.event === 'freeform_response') {
          if (e.payload.taskId !== pendingTaskId.current) return;
          setFreeformResponse(e.payload.response);
          setGenerating(false);
          pendingTaskId.current = null;
        }
        if (e.event === 'task_failed' && e.payload.agentRole === 'research') {
          if (e.payload.taskId !== pendingTaskId.current) return;
          setError(e.payload.error);
          setGenerating(false);
          pendingTaskId.current = null;
        }
        if (e.event === 'waiting_approval' || e.event === 'approval_resolved') {
          fetchPending();
        }
        // Findings are only remembered once approved (see /approvals) —
        // refresh so a newly-stored finding shows up here without a reload.
        if (e.event === 'approval_resolved' && e.payload.approved) {
          loadPastResearch();
        }
      },
      [loadPastResearch, fetchPending]
    )
  );

  async function fire(path: string, body: Record<string, unknown>) {
    setError(null);
    setResult(null);
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

  const runResearch = () =>
    query.trim() &&
    fire('/api/tasks/research-topic', {
      query: query.trim(),
      depth,
      ...(draftContent ? { contentDraftPlatform: draftPlatform } : {}),
      objectiveId: objectiveId || undefined,
    });
  const runSynthesize = () =>
    synthesizeTopic.trim() &&
    fire('/api/tasks/synthesize', {
      topic: synthesizeTopic.trim(),
      objectiveId: objectiveId || undefined,
    });
  const runFreeform = () =>
    freeformPrompt.trim() &&
    fire('/api/tasks/research-freeform', {
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
    <div className="min-h-screen p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/" className="text-xs text-gray-600 hover:text-accent tracking-widest">
          ← COMMAND CENTER
        </Link>
      </div>

      <div className="mb-8">
        <div className="text-xs tracking-widest text-accent mb-2">WIREASSIST // RESEARCH</div>
        <h1 className="text-3xl font-black">RESEARCH AGENT</h1>
        <p className="text-gray-500 text-sm mt-2">
          Web research on a topic, or synthesize what&apos;s already been found before.
        </p>
      </div>

      <div
        className="rounded-lg border p-5 mb-5"
        style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
      >
        <div className="text-xs tracking-widest text-gray-500 mb-3">RESEARCH A TOPIC</div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runResearch()}
          placeholder="e.g. competitor pricing for AI agent platforms"
          className="w-full rounded px-3 py-2 text-sm mb-3 outline-none"
          style={{ background: '#080810', border: '1px solid #1e2040', color: '#e2e8f0' }}
        />
        <ObjectivePicker
          objectives={activeObjectives}
          value={objectiveId}
          onChange={setObjectiveId}
        />
        <div className="flex gap-2 mb-3">
          {(['quick', 'deep'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDepth(d)}
              className="text-xs px-3 py-1 rounded transition-colors capitalize"
              style={{
                background: depth === d ? '#4fc3f720' : 'transparent',
                border: `1px solid ${depth === d ? '#4fc3f7' : '#1e2040'}`,
                color: depth === d ? '#4fc3f7' : '#475569',
              }}
            >
              {d}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 mb-3 text-xs text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={draftContent}
            onChange={(e) => setDraftContent(e.target.checked)}
          />
          Also draft content from this research (asks for approval separately)
        </label>
        {draftContent && (
          <div className="flex gap-2 mb-3">
            {CONTENT_PLATFORMS.map((p) => (
              <button
                key={p}
                onClick={() => setDraftPlatform(p)}
                className="text-xs px-3 py-1 rounded transition-colors capitalize"
                style={{
                  background: draftPlatform === p ? '#4fc3f720' : 'transparent',
                  border: `1px solid ${draftPlatform === p ? '#4fc3f7' : '#1e2040'}`,
                  color: draftPlatform === p ? '#4fc3f7' : '#475569',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={runResearch}
          disabled={generating || !query.trim()}
          className="w-full py-2 rounded text-xs font-bold tracking-widest transition-colors"
          style={{
            background: generating || !query.trim() ? '#1e2040' : '#4fc3f720',
            border: `1px solid ${generating || !query.trim() ? '#1e2040' : '#4fc3f740'}`,
            color: generating || !query.trim() ? '#475569' : '#4fc3f7',
            cursor: generating || !query.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {generating ? 'RESEARCHING...' : '→ RESEARCH'}
        </button>
      </div>

      <div
        className="rounded-lg border p-5 mb-5"
        style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
      >
        <div className="text-xs tracking-widest text-gray-500 mb-3">
          SYNTHESIZE EXISTING RESEARCH
        </div>
        <p className="text-xs text-gray-600 mb-3">
          Pulls from prior research already stored in memory — won&apos;t search the web again.
        </p>
        <input
          type="text"
          value={synthesizeTopic}
          onChange={(e) => setSynthesizeTopic(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSynthesize()}
          placeholder="Topic to synthesize"
          className="w-full rounded px-3 py-2 text-sm mb-3 outline-none"
          style={{ background: '#080810', border: '1px solid #1e2040', color: '#e2e8f0' }}
        />
        <button
          onClick={runSynthesize}
          disabled={generating || !synthesizeTopic.trim()}
          className="w-full py-2 rounded text-xs font-bold tracking-widest transition-colors"
          style={{
            background: generating || !synthesizeTopic.trim() ? '#1e2040' : '#ffb34720',
            border: `1px solid ${generating || !synthesizeTopic.trim() ? '#1e2040' : '#ffb34740'}`,
            color: generating || !synthesizeTopic.trim() ? '#475569' : '#ffb347',
            cursor: generating || !synthesizeTopic.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {generating ? 'SYNTHESIZING...' : '→ SYNTHESIZE'}
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
          placeholder="e.g. what did we find about competitor pricing last time?"
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

      {result && (
        <div
          className="rounded-lg border p-5 mb-5"
          style={{ background: '#0d0d1a', borderColor: '#00ff9d30' }}
        >
          <div className="text-xs tracking-widest mb-3" style={{ color: '#00ff9d' }}>
            JUST COMPLETED
          </div>
          <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed mb-4">
            {result.summary}
          </p>
          {result.sources && result.sources.length > 0 && (
            <>
              <div className="text-xs tracking-widest text-gray-500 mb-2">SOURCES</div>
              <div className="space-y-1">
                {result.sources.map((s, i) => (
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
            </>
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
        className="rounded-lg border p-5 mb-5"
        style={{ background: '#0d0d1a', borderColor: '#ffb34740' }}
      >
        <div className="text-xs tracking-widest mb-3" style={{ color: '#ffb347' }}>
          PENDING REVIEW {pending.length > 0 ? `— ${pending.length}` : ''}
        </div>
        {pending.length === 0 ? (
          <p className="text-xs text-gray-600">
            Nothing awaiting review. Findings land here once a search or synthesis completes.
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
                <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed mb-3">
                  {p.payload.summary ?? p.payload.synthesis}
                </p>
                {p.payload.sources && p.payload.sources.length > 0 && (
                  <div className="space-y-1 mb-3">
                    {p.payload.sources.map((s, i) => (
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

      <div
        className="rounded-lg border p-5"
        style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
      >
        <div className="text-xs tracking-widest text-gray-500 mb-3">PAST RESEARCH</div>
        <p className="text-xs text-gray-600 mb-3">
          Findings that have been approved and stored to memory — synthesize pulls from these.
        </p>
        {pastResearch.length === 0 ? (
          <p className="text-xs text-gray-600">No approved findings yet.</p>
        ) : (
          <div className="space-y-2">
            {pastResearch.map((entry) => {
              const open = expandedEntry === entry.id;
              const firstLine = entry.content.split('\n')[0];
              return (
                <div
                  key={entry.id}
                  className="rounded"
                  style={{ background: '#080810', border: '1px solid #1e2040' }}
                >
                  <button
                    onClick={() => setExpandedEntry(open ? null : entry.id)}
                    className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:text-accent"
                  >
                    {open ? '▾' : '▸'} {firstLine}
                    <span className="text-gray-600 ml-2">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </button>
                  {open && (
                    <div className="px-3 pb-3">
                      <div className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto mb-3">
                        {entry.content}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setContentHandoff({
                              kind: 'research',
                              topic: extractTopic(entry.content),
                              context: entry.content,
                            });
                            router.push('/content');
                          }}
                          className="text-xs px-3 py-1.5 rounded font-bold tracking-wide"
                          style={{
                            background: '#4fc3f720',
                            border: '1px solid #4fc3f740',
                            color: '#4fc3f7',
                          }}
                        >
                          → Use in Content
                        </button>
                        <button
                          onClick={() => {
                            setOpsHandoff({
                              topic: extractTopic(entry.content),
                              context: entry.content,
                            });
                            router.push('/ops');
                          }}
                          className="text-xs px-3 py-1.5 rounded font-bold tracking-wide"
                          style={{
                            background: '#ffb34720',
                            border: '1px solid #ffb34740',
                            color: '#ffb347',
                          }}
                        >
                          → Use in NixOps
                        </button>
                      </div>
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
