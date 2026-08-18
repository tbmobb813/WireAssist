'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAgentEvents } from '@/hooks/useAgentEvents';
import { setContentHandoff } from '@/lib/content-handoff';
import { ObjectivePicker, useActiveObjectives } from '../objective-picker';
import type { GtmProductInput, GtmStrategy, GtmPsychPrinciple } from '@wireassist/agent-gtm';

const EMPTY_PRODUCT: GtmProductInput = {
  name: '',
  cat: '',
  problem: '',
  benefit: '',
  diff: '',
  buyer: '',
  segment: '',
  comp: '',
  channels: '',
  pain: '',
  price: '',
  model: '',
  free: '',
  goal: '',
  current: '',
  budget: '',
};

const STEPS = ['Product', 'Market', 'Business', 'GTM Strategy', 'Psych Tactics'] as const;

const CONTENT_PLATFORMS = ['twitter', 'linkedin', 'instagram', 'threads'] as const;
type ContentPlatform = (typeof CONTENT_PLATFORMS)[number];

interface PastGtmEntry {
  id: string;
  content: string;
  tags: string[];
  createdAt: string;
}

type ParsedPastEntry =
  | { kind: 'strategy'; product: string; gtm: GtmStrategy }
  | { kind: 'psych'; product: string; psych: GtmPsychPrinciple[] };

// Pre-fix entries stored a one-line note instead of the real content — those
// fail to parse as JSON here and are simply skipped, not shown as broken.
function parsePastEntry(entry: PastGtmEntry): ParsedPastEntry | null {
  try {
    const parsed = JSON.parse(entry.content);
    if (entry.tags.includes('strategy') && parsed.gtm) {
      return { kind: 'strategy', product: parsed.product, gtm: parsed.gtm };
    }
    if (entry.tags.includes('psych') && parsed.psych) {
      return { kind: 'psych', product: parsed.product, psych: parsed.psych };
    }
  } catch {
    return null;
  }
  return null;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold tracking-widest text-gray-500 uppercase">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full rounded px-3 py-2 text-sm outline-none resize-none"
          style={{ background: '#080810', border: '1px solid #1e2040', color: '#e2e8f0' }}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded px-3 py-2 text-sm outline-none"
          style={{ background: '#080810', border: '1px solid #1e2040', color: '#e2e8f0' }}
        />
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg border p-6 mb-5"
      style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
    >
      <div
        className="text-xs font-bold tracking-widest uppercase mb-5"
        style={{ color: '#ffb347' }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

export default function GtmPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [product, setProduct] = useState<GtmProductInput>(EMPTY_PRODUCT);
  const [draftContent, setDraftContent] = useState(false);
  const [draftPlatform, setDraftPlatform] = useState<ContentPlatform>('linkedin');
  const [draftCalendar, setDraftCalendar] = useState(false);
  const [calendarPlatforms, setCalendarPlatforms] = useState<ContentPlatform[]>(['linkedin']);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gtm, setGtm] = useState<GtmStrategy | null>(null);
  const [psych, setPsych] = useState<GtmPsychPrinciple[] | null>(null);
  const [openPsychCard, setOpenPsychCard] = useState<number | null>(0);
  const [prefilledFrom, setPrefilledFrom] = useState<string | null>(null);
  const [pastGtm, setPastGtm] = useState<PastGtmEntry[]>([]);
  const [objectiveId, setObjectiveId] = useState('');
  const activeObjectives = useActiveObjectives();
  const [freeformPrompt, setFreeformPrompt] = useState('');
  const [freeformGenerating, setFreeformGenerating] = useState(false);
  const [freeformResponse, setFreeformResponse] = useState<string | null>(null);
  const freeformTaskId = useRef<string | null>(null);

  const pendingTaskIds = useRef<Set<string>>(new Set());

  const loadPastGtm = useCallback(() => {
    fetch('/api/memory?agentRole=gtm')
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setPastGtm(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadPastGtm();
  }, [loadPastGtm]);

  function loadPastEntry(entry: PastGtmEntry) {
    const parsed = parsePastEntry(entry);
    if (!parsed) return;
    setProduct((p) => ({ ...p, name: parsed.product }));
    if (parsed.kind === 'strategy') {
      setGtm(parsed.gtm);
      setStep(3);
    } else {
      setPsych(parsed.psych);
      setStep(4);
    }
  }

  function set<K extends keyof GtmProductInput>(field: K, value: string) {
    setProduct((p) => ({ ...p, [field]: value }));
  }

  // Best-effort pre-fill from the focused project's repo doc, once, only into a
  // still-blank wizard — never overwrites anything the founder has already typed.
  useEffect(() => {
    if (product.name.trim()) return;
    (async () => {
      try {
        const res = await fetch('/api/tasks/gtm/prefill');
        if (!res.ok) return;
        const { prefill } = await res.json();
        if (!prefill?.name) return;
        setProduct((p) => ({
          ...p,
          name: p.name || prefill.name || '',
          cat: p.cat || prefill.cat || '',
          problem: p.problem || prefill.problem || '',
          benefit: p.benefit || prefill.benefit || '',
          diff: p.diff || prefill.diff || '',
        }));
        if (prefill.docFound) setPrefilledFrom(prefill.name);
      } catch {
        // Silent — pre-fill is a nicety, not a requirement.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function useStrategyInContentPlan() {
    if (!gtm) return;
    const context = [
      `Product: ${product.name}${product.cat ? ` (${product.cat})` : ''}`,
      `Positioning: "${gtm.positioning?.headline ?? ''}" — ${gtm.positioning?.subheadline ?? ''}`,
      `ICP: ${gtm.positioning?.icp ?? ''}`,
      product.benefit ? `Core benefit: ${product.benefit}` : '',
      product.diff ? `Differentiator: ${product.diff}` : '',
      (gtm.positioning?.message_hierarchy ?? []).length
        ? `Key messages: ${(gtm.positioning?.message_hierarchy ?? []).join(' / ')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
    setContentHandoff({ kind: 'gtm', product: product.name, context });
    router.push('/content');
  }

  const checkDone = useCallback((taskId: string) => {
    pendingTaskIds.current.delete(taskId);
    if (pendingTaskIds.current.size === 0) setGenerating(false);
  }, []);

  useAgentEvents(
    useCallback(
      (e) => {
        if (e.event === 'gtm_generated') {
          setGtm(e.payload.gtm as GtmStrategy);
          checkDone(e.payload.taskId);
          loadPastGtm();
        }
        if (e.event === 'gtm_psych_generated') {
          setPsych(e.payload.psych as GtmPsychPrinciple[]);
          checkDone(e.payload.taskId);
          loadPastGtm();
        }
        if (e.event === 'task_failed' && e.payload.agentRole === 'gtm') {
          if (e.payload.taskId === freeformTaskId.current) {
            setError('Question failed — try again.');
            setFreeformGenerating(false);
            freeformTaskId.current = null;
            return;
          }
          setError(
            'Generation failed — the model response may not have parsed as valid JSON. Try again.'
          );
          checkDone(e.payload.taskId);
        }
        if (e.event === 'freeform_response') {
          // agent:freeform_response is shared with Admin/Research's own
          // freeform loops on the same event bus — only react to the one
          // this page actually fired.
          if (e.payload.taskId !== freeformTaskId.current) return;
          setFreeformResponse(e.payload.response as string);
          setFreeformGenerating(false);
          freeformTaskId.current = null;
        }
      },
      [checkDone, loadPastGtm]
    )
  );

  const runFreeform = async () => {
    if (!freeformPrompt.trim()) return;
    setError(null);
    setFreeformResponse(null);
    setFreeformGenerating(true);
    try {
      const res = await fetch('/api/tasks/gtm-freeform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: freeformPrompt.trim(),
          objectiveId: objectiveId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Failed to ask question');
        setFreeformGenerating(false);
        return;
      }
      freeformTaskId.current = data.taskId;
    } catch {
      setError('Command Center API unreachable.');
      setFreeformGenerating(false);
    }
  };

  async function generateAll() {
    if (!product.name.trim()) {
      setError('Product name is required.');
      return;
    }
    setError(null);
    setGtm(null);
    setPsych(null);
    setGenerating(true);
    pendingTaskIds.current = new Set();

    try {
      const [strategyRes, psychRes] = await Promise.all([
        fetch('/api/tasks/gtm/strategy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...product,
            ...(draftContent ? { contentDraftPlatform: draftPlatform } : {}),
            ...(draftCalendar && calendarPlatforms.length > 0
              ? { contentCalendarPlatforms: calendarPlatforms }
              : {}),
            objectiveId: objectiveId || undefined,
          }),
        }),
        fetch('/api/tasks/gtm/psych', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...product, objectiveId: objectiveId || undefined }),
        }),
      ]);

      if (!strategyRes.ok || !psychRes.ok) {
        const body = !strategyRes.ok ? await strategyRes.json() : await psychRes.json();
        setError(body.error ?? 'Failed to start generation');
        setGenerating(false);
        return;
      }

      const { taskId: strategyId } = await strategyRes.json();
      const { taskId: psychId } = await psychRes.json();
      pendingTaskIds.current.add(strategyId);
      pendingTaskIds.current.add(psychId);
      setStep(3);
    } catch {
      setError('Command Center API unreachable.');
      setGenerating(false);
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="text-xs tracking-widest mb-2" style={{ color: '#ffb347' }}>
          WIREASSIST // GTM ENGINE
        </div>
        <h1 className="text-3xl font-black">GO-TO-MARKET ENGINE</h1>
        <p className="text-gray-500 text-sm mt-2">
          Describe your product once. Get a full GTM strategy and 9 psychological marketing tactics.
        </p>
      </div>

      {/* Step nav */}
      <div
        className="flex rounded-lg p-1.5 mb-6 gap-1"
        style={{ background: '#0d0d1a', border: '1px solid #1e2040' }}
      >
        {STEPS.map((label, i) => (
          <button
            key={label}
            onClick={() => (i <= 2 || gtm || psych) && setStep(i)}
            className="flex-1 rounded py-2 px-2 text-xs font-bold tracking-wide transition-colors"
            style={{
              background: step === i ? '#181828' : 'transparent',
              color: step === i ? '#ffb347' : i < step ? '#4fc3f7' : '#475569',
              border: step === i ? '1px solid #ffb34740' : '1px solid transparent',
            }}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {error && (
        <div
          className="rounded-lg border p-3 mb-5 text-sm"
          style={{ background: '#2a0f0f', borderColor: '#f0525240', color: '#f87171' }}
        >
          {error}
        </div>
      )}

      {generating && (
        <div
          className="rounded-lg border p-8 mb-5 text-center"
          style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
        >
          <div className="text-sm font-bold text-gray-300">Building your GTM strategy…</div>
          <div className="text-xs text-gray-600 mt-1">
            Generating positioning, channels, timeline, and psych tactics — usually 15–30s.
          </div>
        </div>
      )}

      {/* Step 0: Product */}
      {step === 0 && (
        <Card title="Your Product">
          {prefilledFrom && (
            <div
              className="rounded p-3 mb-4 text-xs"
              style={{ background: '#ffb34715', border: '1px solid #ffb34730', color: '#d4b06a' }}
            >
              Pre-filled from {prefilledFrom}&apos;s README — review before generating.
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Product / Service Name"
              value={product.name}
              onChange={(v) => set('name', v)}
              placeholder="e.g. StatusWatch"
            />
            <Field
              label="Category"
              value={product.cat}
              onChange={(v) => set('cat', v)}
              placeholder="e.g. SaaS, Mobile App, Agency"
            />
            <div className="col-span-2">
              <Field
                label="What problem do you solve?"
                value={product.problem}
                onChange={(v) => set('problem', v)}
                placeholder="Be specific — who hurts, and why"
                multiline
              />
            </div>
            <div className="col-span-2">
              <Field
                label="What outcome do you deliver?"
                value={product.benefit}
                onChange={(v) => set('benefit', v)}
                placeholder="The result, not the feature"
                multiline
              />
            </div>
            <div className="col-span-2">
              <Field
                label="Your core differentiator"
                value={product.diff}
                onChange={(v) => set('diff', v)}
                placeholder="What makes you different from alternatives?"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setStep(1)}
              className="rounded px-6 py-3 text-sm font-bold"
              style={{ background: '#ffb347', color: '#000' }}
            >
              Next: Market & Buyer →
            </button>
          </div>
        </Card>
      )}

      {/* Step 1: Market */}
      {step === 1 && (
        <Card title="Market & Buyer">
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Primary buyer"
              value={product.buyer}
              onChange={(v) => set('buyer', v)}
              placeholder="e.g. DevOps engineers at Series A-B startups"
            />
            <Field
              label="Company size / segment"
              value={product.segment}
              onChange={(v) => set('segment', v)}
              placeholder="e.g. 10-100 person startups"
            />
            <div className="col-span-2">
              <Field
                label="Biggest competitor(s)"
                value={product.comp}
                onChange={(v) => set('comp', v)}
                placeholder="e.g. StatusGator ($89/mo)"
              />
            </div>
            <div className="col-span-2">
              <Field
                label="Where do buyers hang out?"
                value={product.channels}
                onChange={(v) => set('channels', v)}
                placeholder="e.g. r/devops, Hacker News, X/Twitter"
              />
            </div>
            <div className="col-span-2">
              <Field
                label="Buyer's biggest frustration with current options"
                value={product.pain}
                onChange={(v) => set('pain', v)}
                placeholder="What's broken about the alternatives?"
                multiline
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setStep(0)}
              className="rounded px-6 py-3 text-sm font-bold"
              style={{ background: '#181828', color: '#e2e8f0', border: '1px solid #1e2040' }}
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(2)}
              className="rounded px-6 py-3 text-sm font-bold"
              style={{ background: '#ffb347', color: '#000' }}
            >
              Next: Business Model →
            </button>
          </div>
        </Card>
      )}

      {/* Step 2: Business */}
      {step === 2 && (
        <Card title="Business Model & Goals">
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Starting price"
              value={product.price}
              onChange={(v) => set('price', v)}
              placeholder="e.g. $49/month"
            />
            <Field
              label="Business model"
              value={product.model}
              onChange={(v) => set('model', v)}
              placeholder="e.g. SaaS subscription"
            />
            <Field
              label="Free tier / trial"
              value={product.free}
              onChange={(v) => set('free', v)}
              placeholder="e.g. 14-day free trial"
            />
            <Field
              label="Phase 1 goal"
              value={product.goal}
              onChange={(v) => set('goal', v)}
              placeholder="e.g. 10 paying customers in 30 days"
            />
            <div className="col-span-2">
              <Field
                label="Current marketing (honest assessment)"
                value={product.current}
                onChange={(v) => set('current', v)}
                placeholder="What's actually happening today?"
                multiline
              />
            </div>
            <Field
              label="Marketing budget right now"
              value={product.budget}
              onChange={(v) => set('budget', v)}
              placeholder="e.g. $0 for now"
            />
          </div>
          <div className="mt-6">
            <ObjectivePicker
              objectives={activeObjectives}
              value={objectiveId}
              onChange={setObjectiveId}
            />
          </div>
          <label className="flex items-center gap-2 mb-3 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={draftContent}
              onChange={(e) => setDraftContent(e.target.checked)}
            />
            Also draft content from this GTM strategy (asks for approval separately)
          </label>
          {draftContent && (
            <div className="flex gap-2 mb-3">
              {CONTENT_PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => setDraftPlatform(p)}
                  className="text-xs px-3 py-1 rounded transition-colors capitalize"
                  style={{
                    background: draftPlatform === p ? '#ffb34720' : 'transparent',
                    border: `1px solid ${draftPlatform === p ? '#ffb347' : '#1e2040'}`,
                    color: draftPlatform === p ? '#ffb347' : '#475569',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
          <label className="flex items-center gap-2 mb-3 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={draftCalendar}
              onChange={(e) => setDraftCalendar(e.target.checked)}
            />
            Also generate a full content calendar from this launch timeline (asks for approval
            separately)
          </label>
          {draftCalendar && (
            <div className="flex gap-2 mb-3">
              {CONTENT_PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() =>
                    setCalendarPlatforms((prev) =>
                      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
                    )
                  }
                  className="text-xs px-3 py-1 rounded transition-colors capitalize"
                  style={{
                    background: calendarPlatforms.includes(p) ? '#ffb34720' : 'transparent',
                    border: `1px solid ${calendarPlatforms.includes(p) ? '#ffb347' : '#1e2040'}`,
                    color: calendarPlatforms.includes(p) ? '#ffb347' : '#475569',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setStep(1)}
              className="rounded px-6 py-3 text-sm font-bold"
              style={{ background: '#181828', color: '#e2e8f0', border: '1px solid #1e2040' }}
            >
              ← Back
            </button>
            <button
              onClick={generateAll}
              disabled={generating}
              className="rounded px-6 py-3 text-sm font-bold"
              style={{
                background: generating ? '#1e2040' : '#ffb347',
                color: generating ? '#475569' : '#000',
              }}
            >
              {generating ? 'Generating…' : '⚡ Generate Full GTM Plan →'}
            </button>
          </div>
        </Card>
      )}

      {/* Step 3: GTM Strategy output */}
      {step === 3 && (
        <>
          {!gtm && !generating && (
            <Card title="GTM Strategy">
              <p className="text-sm text-gray-500">
                Nothing generated yet — go back and run the generator.
              </p>
            </Card>
          )}
          {gtm && (
            <>
              <Card title="Positioning & Messaging">
                <div className="text-2xl font-serif italic mb-2" style={{ color: '#e2e8f0' }}>
                  &ldquo;{gtm.positioning?.headline}&rdquo;
                </div>
                <p className="text-sm text-gray-400 mb-4">{gtm.positioning?.subheadline}</p>
                <div
                  className="rounded p-3 mb-4"
                  style={{ background: '#080810', border: '1px solid #1e2040' }}
                >
                  <div className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-1">
                    ICP
                  </div>
                  <div className="text-sm text-gray-300">{gtm.positioning?.icp}</div>
                </div>
                <div className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-2">
                  Message Hierarchy
                </div>
                {(gtm.positioning?.message_hierarchy ?? []).map((m, i) => (
                  <div key={i} className="text-sm text-gray-400 py-1">
                    <span style={{ color: '#ffb347' }}>P{i + 1}</span> — {m}
                  </div>
                ))}
              </Card>

              <Card title="Organic Channel Strategy">
                <div className="space-y-3">
                  {(gtm.organic_channels ?? []).map((c, i) => (
                    <div
                      key={i}
                      className="rounded p-4"
                      style={{ background: '#080810', border: '1px solid #1e2040' }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-gray-200">{c.channel}</span>
                        <span
                          className="text-xs px-2 py-0.5 rounded font-bold"
                          style={{
                            background: c.impact === 'HIGH' ? '#31c48d20' : '#f0b42920',
                            color: c.impact === 'HIGH' ? '#31c48d' : '#f0b429',
                          }}
                        >
                          {c.impact} IMPACT
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 mb-2">
                        Effort: {c.effort} · {c.timeframe}
                      </div>
                      {(c.tactics ?? []).map((t, j) => (
                        <div key={j} className="text-xs text-gray-400 py-0.5">
                          → {t}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Paid Channel Roadmap">
                <div
                  className="rounded p-3 mb-4 text-xs"
                  style={{
                    background: '#f0b42915',
                    border: '1px solid #f0b42930',
                    color: '#d4b06a',
                  }}
                >
                  ⚠ Don&apos;t invest in paid until you have 5+ paying customers.
                </div>
                {(gtm.paid_channels ?? []).map((c, i) => (
                  <div
                    key={i}
                    className="flex gap-3 py-3"
                    style={{ borderBottom: '1px solid #1e2040' }}
                  >
                    <div
                      className="w-7 h-7 flex items-center justify-center rounded text-xs font-bold flex-shrink-0"
                      style={{ background: '#181828', color: '#475569' }}
                    >
                      P{c.priority}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-200">{c.channel}</div>
                      <div className="text-xs text-gray-500">{c.key_tactic}</div>
                      <div className="text-xs mt-1" style={{ color: '#ffb347' }}>
                        {c.budget} · Start: {c.when_to_start}
                      </div>
                    </div>
                  </div>
                ))}
              </Card>

              <Card title="30-Day Launch Sprint">
                {(gtm.launch_timeline ?? []).map((t, i) => (
                  <div key={i} className="flex gap-4 pb-5">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{
                          background: '#f0b42920',
                          border: '2px solid #f0b42960',
                          color: '#f0b429',
                        }}
                      >
                        W{i + 1}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-bold mb-1" style={{ color: '#ffb347' }}>
                        {t.week} — {t.focus}
                      </div>
                      {(t.tasks ?? []).map((task, j) => (
                        <div key={j} className="text-sm text-gray-400">
                          • {task}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </Card>

              <Card title="Success Metrics">
                <div
                  className="rounded p-4 text-center mb-4"
                  style={{ background: '#181828', border: '1px solid #1e2040' }}
                >
                  <div className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-1">
                    North Star
                  </div>
                  <div className="text-xl font-serif italic" style={{ color: '#ffb347' }}>
                    {gtm.north_star}
                  </div>
                </div>
                <table className="w-full text-sm mb-4">
                  <thead>
                    <tr className="text-xs text-gray-600 text-left">
                      <th className="pb-2">Metric</th>
                      <th className="pb-2">Target</th>
                      <th className="pb-2">Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(gtm.kpis ?? []).map((k, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #1e2040' }}>
                        <td className="py-2 font-bold text-gray-300">{k.metric}</td>
                        <td className="py-2" style={{ color: '#ffb347' }}>
                          {k.target}
                        </td>
                        <td className="py-2 text-gray-500">{k.why}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    className="rounded p-3"
                    style={{ background: '#31c48d10', border: '1px solid #31c48d30' }}
                  >
                    <div className="text-xs font-bold uppercase mb-1" style={{ color: '#31c48d' }}>
                      Founder Advantage
                    </div>
                    <div className="text-xs text-gray-400">{gtm.founder_advantage}</div>
                  </div>
                  <div
                    className="rounded p-3"
                    style={{ background: '#f0525210', border: '1px solid #f0525230' }}
                  >
                    <div className="text-xs font-bold uppercase mb-1" style={{ color: '#f05252' }}>
                      Biggest Risk
                    </div>
                    <div className="text-xs text-gray-400">{gtm.biggest_risk}</div>
                  </div>
                </div>
              </Card>
            </>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="rounded px-6 py-3 text-sm font-bold"
              style={{ background: '#181828', color: '#e2e8f0', border: '1px solid #1e2040' }}
            >
              ← Edit Inputs
            </button>
            {psych && (
              <button
                onClick={() => setStep(4)}
                className="rounded px-6 py-3 text-sm font-bold"
                style={{ background: '#ffb347', color: '#000' }}
              >
                View Psych Tactics →
              </button>
            )}
            {gtm && (
              <button
                onClick={useStrategyInContentPlan}
                className="rounded px-6 py-3 text-sm font-bold"
                style={{ background: '#4fc3f720', border: '1px solid #4fc3f740', color: '#4fc3f7' }}
              >
                → Use in Content Plan
              </button>
            )}
          </div>
        </>
      )}

      {/* Step 4: Psych tactics output */}
      {step === 4 && (
        <>
          <Card title={`9 Psychological Principles — Applied to ${product.name || 'Your Product'}`}>
            <p className="text-sm text-gray-500">
              Every tactic below is tailored to your specific product, price, buyer, and
              competitors. Click a card to expand.
            </p>
          </Card>
          {(psych ?? []).map((p, i) => {
            const open = openPsychCard === i;
            return (
              <div
                key={i}
                className="rounded-lg border mb-3 overflow-hidden"
                style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
              >
                <button
                  onClick={() => setOpenPsychCard(open ? null : i)}
                  className="w-full flex items-center gap-3 p-4 text-left"
                >
                  <div
                    className="w-8 h-8 flex items-center justify-center rounded-full text-sm font-serif italic flex-shrink-0"
                    style={{ background: '#ffb34720', color: '#ffb347' }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-gray-200">{p.principle}</div>
                    <div className="text-xs text-gray-600">{p.tagline}</div>
                  </div>
                  <span className="text-gray-600 text-xs">{open ? '▴' : '▾'}</span>
                </button>
                {open && (
                  <div className="px-4 pb-4">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div
                        className="rounded p-3 text-xs"
                        style={{ background: '#f0525210', border: '1px solid #f0525225' }}
                      >
                        <div className="font-bold mb-1" style={{ color: '#f05252' }}>
                          ✗ WITHOUT THIS
                        </div>
                        <div className="text-gray-400">{p.generic_bad}</div>
                      </div>
                      <div
                        className="rounded p-3 text-xs"
                        style={{ background: '#31c48d10', border: '1px solid #31c48d25' }}
                      >
                        <div className="font-bold mb-1" style={{ color: '#31c48d' }}>
                          ✓ WITH THIS
                        </div>
                        <div className="text-gray-300">{p.generic_good}</div>
                      </div>
                    </div>
                    <div
                      className="rounded p-3"
                      style={{ background: '#080810', border: '1px solid #1e2040' }}
                    >
                      <div className="text-xs font-bold text-gray-500 uppercase mb-2">
                        Tactics for {product.name || 'your product'}
                      </div>
                      <div className="text-sm font-bold text-gray-200 mb-2">{p.headline}</div>
                      {(p.tactics ?? []).map((t, j) => (
                        <div key={j} className="text-xs text-gray-400 py-0.5">
                          → {t}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-1.5 flex-wrap mt-3">
                      {(p.tags ?? []).map((tag, j) => (
                        <span
                          key={j}
                          className="text-xs px-2 py-0.5 rounded-full font-bold"
                          style={{
                            background: '#ffb34715',
                            color: '#ffb347',
                            border: '1px solid #ffb34730',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex gap-3 mt-3">
            <button
              onClick={() => setStep(3)}
              className="rounded px-6 py-3 text-sm font-bold"
              style={{ background: '#181828', color: '#e2e8f0', border: '1px solid #1e2040' }}
            >
              ← GTM Strategy
            </button>
          </div>
        </>
      )}

      <Card title="Ask a Question">
        <p className="text-xs text-gray-600 mb-3">
          Quick GTM questions, or ask it to generate a strategy or psych tactics conversationally —
          the wizard is still the primary path for a full structured plan.
        </p>
        <input
          type="text"
          value={freeformPrompt}
          onChange={(e) => setFreeformPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runFreeform()}
          placeholder="e.g. what channel should I launch on with a $0 budget?"
          className="w-full rounded px-3 py-2 text-sm mb-3 outline-none"
          style={{ background: '#080810', border: '1px solid #1e2040', color: '#e2e8f0' }}
        />
        <button
          onClick={runFreeform}
          disabled={freeformGenerating || !freeformPrompt.trim()}
          className="w-full py-2 rounded text-xs font-bold tracking-widest transition-colors"
          style={{
            background: freeformGenerating || !freeformPrompt.trim() ? '#1e2040' : '#ffb34720',
            border: `1px solid ${freeformGenerating || !freeformPrompt.trim() ? '#1e2040' : '#ffb34740'}`,
            color: freeformGenerating || !freeformPrompt.trim() ? '#475569' : '#ffb347',
            cursor: freeformGenerating || !freeformPrompt.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {freeformGenerating ? 'ASKING...' : '→ ASK'}
        </button>
        {freeformResponse && (
          <div
            className="rounded p-3 mt-3 text-sm text-gray-300 whitespace-pre-wrap leading-relaxed"
            style={{ background: '#080810', border: '1px solid #1e2040' }}
          >
            {freeformResponse}
          </div>
        )}
      </Card>

      <Card title="Past Generations">
        <p className="text-xs text-gray-600 mb-3">
          Strategies and psych tactics from earlier runs — click to reload one without regenerating.
          Entries from before this list existed can&apos;t be recovered.
        </p>
        {pastGtm.filter((e) => parsePastEntry(e)).length === 0 ? (
          <p className="text-xs text-gray-600">Nothing generated yet.</p>
        ) : (
          <div className="space-y-2">
            {pastGtm.map((entry) => {
              const parsed = parsePastEntry(entry);
              if (!parsed) return null;
              return (
                <button
                  key={entry.id}
                  onClick={() => loadPastEntry(entry)}
                  className="w-full text-left rounded px-3 py-2 text-xs text-gray-400 hover:text-accent"
                  style={{ background: '#080810', border: '1px solid #1e2040' }}
                >
                  <span style={{ color: '#ffb347' }}>
                    {parsed.kind === 'strategy' ? 'Strategy' : 'Psych tactics'}
                  </span>{' '}
                  — {parsed.product || 'Untitled product'}
                  <span className="text-gray-600 ml-2">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
