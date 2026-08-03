'use client';
import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useAgentEvents } from '@/hooks/useAgentEvents';

interface ResearchResult {
  summary: string;
  sources?: string[];
}

export default function ResearchPage() {
  const [query, setQuery] = useState('');
  const [depth, setDepth] = useState<'quick' | 'deep'>('quick');
  const [synthesizeTopic, setSynthesizeTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingTaskId = useRef<string | null>(null);

  useAgentEvents(
    useCallback((e) => {
      if (e.event === 'research_complete') {
        if (e.payload.taskId !== pendingTaskId.current) return;
        setResult({ summary: e.payload.summary, sources: e.payload.sources });
        setGenerating(false);
        pendingTaskId.current = null;
      }
      if (e.event === 'task_failed' && e.payload.agentRole === 'research') {
        if (e.payload.taskId !== pendingTaskId.current) return;
        setError(e.payload.error);
        setGenerating(false);
        pendingTaskId.current = null;
      }
    }, [])
  );

  async function fire(path: string, body: Record<string, unknown>) {
    setError(null);
    setResult(null);
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
    query.trim() && fire('/api/tasks/research-topic', { query: query.trim(), depth });
  const runSynthesize = () =>
    synthesizeTopic.trim() && fire('/api/tasks/synthesize', { topic: synthesizeTopic.trim() });

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
          className="rounded-lg border p-5"
          style={{ background: '#0d0d1a', borderColor: '#00ff9d30' }}
        >
          <div className="text-xs tracking-widest mb-3" style={{ color: '#00ff9d' }}>
            FINDINGS — CHECK APPROVALS TO STORE
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
    </div>
  );
}
