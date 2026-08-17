'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAgentEvents } from '@/hooks/useAgentEvents';
import { consumeContentHandoff } from '@/lib/content-handoff';
import Link from 'next/link';

const PLATFORMS = ['twitter', 'linkedin', 'instagram', 'threads'] as const;
type Platform = (typeof PLATFORMS)[number];

interface ScheduledPost {
  id: string;
  content: string;
  platform: Platform;
  scheduledAt: string;
  status: string;
  tags: string[];
  campaignId?: string;
}

interface ContentIdea {
  id: string;
  topic: string;
  angle: string;
  platform: Platform;
  status: string;
  createdAt: string;
  scheduledFor?: string;
  campaignId?: string;
}

interface Campaign {
  id: string;
  name: string;
  source: 'manual' | 'gtm';
  createdAt: string;
}

interface ContentApproval {
  id: string;
  taskId: string;
  agentRole: string;
  action: string;
  payload: {
    content?: string;
    platform?: string;
    analysis?: { score: number; estimatedEngagement: string; suggestion: string };
    ideas?: { topic?: string; platform?: string; angle?: string }[];
  };
  status: string;
  createdAt: string;
}

const platformColor: Record<string, string> = {
  twitter: '#1da1f2',
  linkedin: '#0077b5',
  instagram: '#e1306c',
  threads: '#94a3b8',
};

export default function ContentPage() {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignFilter, setCampaignFilter] = useState<string | null>(null);
  const [pending, setPending] = useState<ContentApproval[]>([]);
  const [acting, setActing] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [topic, setTopic] = useState('');
  const [platform, setPlatform] = useState<Platform>('linkedin');
  const [tone, setTone] = useState('');
  const [extraContext, setExtraContext] = useState('');
  const [planPlatforms, setPlanPlatforms] = useState<Platform[]>(['linkedin', 'twitter']);
  const [weeksAhead, setWeeksAhead] = useState(1);
  const [postsPerWeek, setPostsPerWeek] = useState(3);
  const [businessContext, setBusinessContext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [handoffNotice, setHandoffNotice] = useState<string | null>(null);
  const [freeformPrompt, setFreeformPrompt] = useState('');
  const [freeformResponse, setFreeformResponse] = useState<string | null>(null);
  const freeformTaskId = useRef<string | null>(null);

  useEffect(() => {
    const handoff = consumeContentHandoff();
    if (!handoff) return;
    if (handoff.kind === 'research') {
      setTopic(handoff.topic);
      setExtraContext(handoff.context);
      setHandoffNotice(`Pulled in from Research: "${handoff.topic}"`);
    } else {
      setBusinessContext(handoff.context);
      setHandoffNotice(`Pulled in from GTM strategy: ${handoff.product || 'your product'}`);
    }
  }, []);

  const fetchPosts = useCallback(async () => {
    const res = await fetch('/api/content/posts?daysAhead=14');
    if (res.ok) setPosts(await res.json());
  }, []);

  const fetchIdeas = useCallback(async () => {
    const res = await fetch('/api/content/ideas');
    if (res.ok) setIdeas(await res.json());
  }, []);

  const fetchCampaigns = useCallback(async () => {
    const res = await fetch('/api/content/campaigns');
    if (res.ok) setCampaigns(await res.json());
  }, []);

  const fetchPending = useCallback(async () => {
    const res = await fetch('/api/approvals');
    if (!res.ok) return;
    const all = (await res.json()) as ContentApproval[];
    setPending(all.filter((a) => a.agentRole === 'content'));
  }, []);

  const markPublished = async (postId: string) => {
    setActing(postId);
    const res = await fetch(`/api/content/posts/${postId}/publish`, { method: 'POST' });
    if (res.ok) await fetchPosts();
    setActing(null);
  };

  useEffect(() => {
    fetchPosts();
    fetchIdeas();
    fetchCampaigns();
    fetchPending();
  }, [fetchPosts, fetchIdeas, fetchCampaigns, fetchPending]);

  useAgentEvents(
    useCallback(
      (e) => {
        if (e.event === 'content_generated' || e.event === 'content_plan_generated') {
          setGenerating(false);
        }
        if (e.event === 'content_plan_generated') {
          // Covers both the weekly-plan generator and a GTM-timeline handoff —
          // either way, new (possibly campaign-linked) ideas may now exist.
          fetchIdeas();
          fetchCampaigns();
        }
        if (e.event === 'waiting_approval' || e.event === 'approval_resolved') {
          fetchPending();
        }
        if (e.event === 'post_scheduled') {
          fetchPosts();
        }
        if (e.event === 'task_failed' && e.payload.agentRole === 'content') {
          setGenerating(false);
          setError(typeof e.payload.error === 'string' ? e.payload.error : 'Task failed');
        }
        if (e.event === 'freeform_response') {
          if (e.payload.taskId !== freeformTaskId.current) return;
          setFreeformResponse(e.payload.response);
          setGenerating(false);
          freeformTaskId.current = null;
        }
      },
      [fetchPosts, fetchIdeas, fetchCampaigns, fetchPending]
    )
  );

  const resolveApproval = async (id: string, approved: boolean) => {
    setActing(id);
    await fetch(`/api/approvals/${id}/${approved ? 'approve' : 'reject'}`, { method: 'POST' });
    setPending((prev) => prev.filter((a) => a.id !== id));
    setActing(null);
  };

  const togglePlanPlatform = (p: Platform) => {
    setPlanPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const generatePost = async () => {
    if (!topic.trim() || generating) return;
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch('/api/tasks/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          platform,
          tone: tone.trim() || undefined,
          context: extraContext.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Request failed (${res.status})`);
        setGenerating(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the API');
      setGenerating(false);
    }
  };

  const generatePlan = async () => {
    if (planPlatforms.length === 0 || generating) return;
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch('/api/tasks/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platforms: planPlatforms,
          weeksAhead,
          postsPerWeek,
          businessContext: businessContext.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Request failed (${res.status})`);
        setGenerating(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the API');
      setGenerating(false);
    }
  };

  const runFreeform = async () => {
    if (!freeformPrompt.trim() || generating) return;
    setError(null);
    setFreeformResponse(null);
    setGenerating(true);
    try {
      const res = await fetch('/api/tasks/content-freeform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: freeformPrompt.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        setGenerating(false);
        return;
      }
      freeformTaskId.current = data.taskId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the API');
      setGenerating(false);
    }
  };

  const campaignName = (id?: string) => campaigns.find((c) => c.id === id)?.name;

  const filteredPosts = campaignFilter
    ? posts.filter((p) => p.campaignId === campaignFilter)
    : posts;
  const filteredIdeas = campaignFilter
    ? ideas.filter((i) => i.campaignId === campaignFilter)
    : ideas;

  type CalendarItem =
    | { kind: 'post'; date: Date; post: ScheduledPost }
    | { kind: 'idea'; date: Date; idea: ContentIdea };

  const datedIdeas = filteredIdeas.filter((i) => i.scheduledFor);
  const unscheduledIdeas = filteredIdeas.filter((i) => !i.scheduledFor);

  const calendarItems: CalendarItem[] = [
    ...filteredPosts.map(
      (post): CalendarItem => ({ kind: 'post', date: new Date(post.scheduledAt), post })
    ),
    ...datedIdeas.map(
      (idea): CalendarItem => ({ kind: 'idea', date: new Date(idea.scheduledFor!), idea })
    ),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Group calendar items by real date for a date-headered list view.
  const itemsByDate = calendarItems.reduce(
    (acc, item) => {
      const date = item.date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      if (!acc[date]) acc[date] = [];
      acc[date].push(item);
      return acc;
    },
    {} as Record<string, CalendarItem[]>
  );

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6">
        <Link href="/" className="text-xs text-gray-600 hover:text-accent tracking-widest">
          ← COMMAND CENTER
        </Link>
      </div>

      <div className="mb-8">
        <div className="text-xs tracking-widest text-amber mb-2">WIREASSIST // CONTENT</div>
        <h1 className="text-3xl font-black">CONTENT AGENT</h1>
        <p className="text-gray-500 text-sm mt-2">
          Generate, schedule, and manage your content pipeline.
        </p>
      </div>

      {error && (
        <div
          className="rounded-lg border p-4 mb-5 text-sm"
          style={{ background: '#2a0f0f', borderColor: '#f0525240', color: '#f87171' }}
        >
          {error}
        </div>
      )}

      {handoffNotice && (
        <div
          className="rounded-lg border p-3 mb-5 text-xs flex items-center justify-between"
          style={{ background: '#4fc3f715', borderColor: '#4fc3f730', color: '#7dd3fc' }}
        >
          {handoffNotice}
          <button
            onClick={() => setHandoffNotice(null)}
            className="text-gray-500 hover:text-gray-300 ml-3"
          >
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Left — Generator */}
        <div className="col-span-1 space-y-4">
          <div className="text-xs tracking-widest text-gray-500 mb-2">GENERATE</div>

          {/* Single post */}
          <div
            className="rounded-lg border p-4"
            style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
          >
            <div className="text-xs tracking-widest text-gray-500 mb-3">SINGLE POST</div>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && generatePost()}
              placeholder="Topic or idea..."
              className="w-full rounded px-3 py-2 text-sm mb-3 outline-none"
              style={{ background: '#080810', border: '1px solid #1e2040', color: '#e2e8f0' }}
            />
            <input
              type="text"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && generatePost()}
              placeholder="Tone (optional) — e.g. casual, authoritative, funny"
              className="w-full rounded px-3 py-2 text-sm mb-3 outline-none"
              style={{ background: '#080810', border: '1px solid #1e2040', color: '#e2e8f0' }}
            />
            <textarea
              value={extraContext}
              onChange={(e) => setExtraContext(e.target.value)}
              placeholder="Context (optional) — a research finding or other grounding detail to write from"
              rows={2}
              className="w-full rounded px-3 py-2 text-sm mb-3 outline-none resize-none"
              style={{ background: '#080810', border: '1px solid #1e2040', color: '#e2e8f0' }}
            />
            <div className="flex gap-2 mb-3 flex-wrap">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className="text-xs px-3 py-1 rounded transition-colors"
                  style={{
                    background: platform === p ? `${platformColor[p]}20` : 'transparent',
                    border: `1px solid ${platform === p ? platformColor[p] : '#1e2040'}`,
                    color: platform === p ? platformColor[p] : '#475569',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              onClick={generatePost}
              disabled={generating || !topic.trim()}
              className="w-full py-2 rounded text-xs font-bold tracking-widest transition-colors"
              style={{
                background: generating || !topic.trim() ? '#1e2040' : '#4fc3f720',
                border: `1px solid ${generating || !topic.trim() ? '#1e2040' : '#4fc3f740'}`,
                color: generating || !topic.trim() ? '#475569' : '#4fc3f7',
                cursor: generating || !topic.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {generating ? 'GENERATING...' : '→ GENERATE'}
            </button>
          </div>

          {/* Weekly plan */}
          <div
            className="rounded-lg border p-4"
            style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
          >
            <div className="text-xs tracking-widest text-gray-500 mb-3">WEEKLY PLAN</div>
            <textarea
              value={businessContext}
              onChange={(e) => setBusinessContext(e.target.value)}
              placeholder="Business context (optional) — or pull one in from a GTM strategy"
              rows={2}
              className="w-full rounded px-3 py-2 text-sm mb-3 outline-none resize-none"
              style={{ background: '#080810', border: '1px solid #1e2040', color: '#e2e8f0' }}
            />
            <div className="flex gap-2 mb-3 flex-wrap">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => togglePlanPlatform(p)}
                  className="text-xs px-3 py-1 rounded transition-colors"
                  style={{
                    background: planPlatforms.includes(p) ? `${platformColor[p]}20` : 'transparent',
                    border: `1px solid ${planPlatforms.includes(p) ? platformColor[p] : '#1e2040'}`,
                    color: planPlatforms.includes(p) ? platformColor[p] : '#475569',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mb-3">
              <label className="flex-1 text-xs text-gray-500">
                Weeks ahead
                <input
                  type="number"
                  min={1}
                  max={4}
                  value={weeksAhead}
                  onChange={(e) => setWeeksAhead(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full mt-1 rounded px-3 py-2 text-sm outline-none"
                  style={{ background: '#080810', border: '1px solid #1e2040', color: '#e2e8f0' }}
                />
              </label>
              <label className="flex-1 text-xs text-gray-500">
                Posts/week
                <input
                  type="number"
                  min={1}
                  max={14}
                  value={postsPerWeek}
                  onChange={(e) => setPostsPerWeek(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full mt-1 rounded px-3 py-2 text-sm outline-none"
                  style={{ background: '#080810', border: '1px solid #1e2040', color: '#e2e8f0' }}
                />
              </label>
            </div>
            <button
              onClick={generatePlan}
              disabled={generating || planPlatforms.length === 0}
              className="w-full py-2 rounded text-xs font-bold tracking-widest transition-colors"
              style={{
                background: '#ffb34720',
                border: '1px solid #ffb34740',
                color: generating || planPlatforms.length === 0 ? '#475569' : '#ffb347',
                cursor: generating || planPlatforms.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {generating ? 'GENERATING...' : '→ GENERATE PLAN'}
            </button>
          </div>

          {/* Freeform */}
          <div
            className="rounded-lg border p-4"
            style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
          >
            <div className="text-xs tracking-widest text-gray-500 mb-3">ASK A QUESTION</div>
            <input
              type="text"
              value={freeformPrompt}
              onChange={(e) => setFreeformPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runFreeform()}
              placeholder="e.g. what's performed best on LinkedIn so far?"
              className="w-full rounded px-3 py-2 text-sm mb-3 outline-none"
              style={{ background: '#080810', border: '1px solid #1e2040', color: '#e2e8f0' }}
            />
            <button
              onClick={runFreeform}
              disabled={generating || !freeformPrompt.trim()}
              className="w-full py-2 rounded text-xs font-bold tracking-widest transition-colors"
              style={{
                background: generating || !freeformPrompt.trim() ? '#1e2040' : '#4fc3f720',
                border: `1px solid ${generating || !freeformPrompt.trim() ? '#1e2040' : '#4fc3f740'}`,
                color: generating || !freeformPrompt.trim() ? '#475569' : '#4fc3f7',
                cursor: generating || !freeformPrompt.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {generating ? 'ASKING...' : '→ ASK'}
            </button>
          </div>
        </div>

        {/* Middle — Pending review + Calendar */}
        <div className="col-span-2 space-y-6">
          {freeformResponse && (
            <div
              className="rounded-lg border p-5"
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
          {pending.length > 0 && (
            <div>
              <div className="text-xs tracking-widest text-gray-500 mb-4">
                PENDING REVIEW — {pending.length}
              </div>
              <div className="space-y-3">
                {pending.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-lg border overflow-hidden"
                    style={{ background: '#0d0d1a', borderColor: '#ffb34740' }}
                  >
                    <div className="px-4 py-3">
                      <div className="text-sm font-bold mb-2">{p.action}</div>
                      {p.payload.content && (
                        <p className="text-sm text-gray-400 whitespace-pre-wrap leading-relaxed mb-2">
                          {p.payload.content}
                        </p>
                      )}
                      {p.payload.analysis && (
                        <p className="text-xs text-gray-600">
                          Score: {p.payload.analysis.score} · Est. engagement:{' '}
                          {p.payload.analysis.estimatedEngagement}
                        </p>
                      )}
                      {p.payload.ideas && (
                        <ul className="text-xs text-gray-400 space-y-1 mt-1">
                          {p.payload.ideas.map((idea, i) => (
                            <li key={i}>
                              · {idea.platform ? `[${idea.platform}] ` : ''}
                              {idea.topic ?? idea.angle ?? JSON.stringify(idea)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div
                      className="px-4 py-3 flex gap-3"
                      style={{ borderTop: '1px solid #1e2040' }}
                    >
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
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs tracking-widest text-gray-500">CONTENT CALENDAR</div>
              {campaigns.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {campaigns.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCampaignFilter((prev) => (prev === c.id ? null : c.id))}
                      className="text-xs px-3 py-1 rounded transition-colors"
                      style={{
                        background: campaignFilter === c.id ? '#ffb34720' : 'transparent',
                        border: `1px solid ${campaignFilter === c.id ? '#ffb347' : '#1e2040'}`,
                        color: campaignFilter === c.id ? '#ffb347' : '#475569',
                      }}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {Object.keys(itemsByDate).length === 0 ? (
              <div
                className="rounded-lg border p-12 text-center"
                style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
              >
                <div className="text-gray-600 text-sm">
                  Nothing scheduled yet. Approve generated content above to populate the calendar.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(itemsByDate).map(([date, dateItems]) => (
                  <div
                    key={date}
                    className="rounded-lg border overflow-hidden"
                    style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
                  >
                    <div
                      className="px-4 py-2 text-xs tracking-widest text-gray-500"
                      style={{ borderBottom: '1px solid #1e2040', background: '#0f0e1a' }}
                    >
                      {date}
                    </div>
                    {dateItems.map((item) => {
                      const platform =
                        item.kind === 'post' ? item.post.platform : item.idea.platform;
                      const campaignId =
                        item.kind === 'post' ? item.post.campaignId : item.idea.campaignId;
                      const key = item.kind === 'post' ? item.post.id : item.idea.id;
                      return (
                        <div
                          key={key}
                          className="px-4 py-3 flex items-start gap-3"
                          style={{ borderBottom: '1px solid #0d0d1a' }}
                        >
                          <span
                            className="text-xs px-2 py-0.5 rounded mt-0.5 flex-shrink-0"
                            style={{
                              color: platformColor[platform],
                              background: `${platformColor[platform]}20`,
                              border: `1px solid ${platformColor[platform]}40`,
                            }}
                          >
                            {platform}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-300 truncate">
                              {item.kind === 'post' ? item.post.content : item.idea.topic}
                            </p>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              <span className="text-xs text-gray-600">
                                {item.date.toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              <span
                                className="text-xs tracking-widest"
                                style={{
                                  color:
                                    item.kind === 'post' && item.post.status === 'published'
                                      ? '#00ff9d'
                                      : '#4fc3f7',
                                }}
                              >
                                {item.kind === 'post' ? item.post.status.toUpperCase() : 'IDEA'}
                              </span>
                              {campaignName(campaignId) && (
                                <span className="text-xs text-gray-600">
                                  · {campaignName(campaignId)}
                                </span>
                              )}
                            </div>
                          </div>
                          {item.kind === 'post' && item.post.status !== 'published' && (
                            <button
                              onClick={() => markPublished(item.post.id)}
                              disabled={acting === item.post.id}
                              className="text-xs px-3 py-1 rounded flex-shrink-0 transition-colors"
                              style={{
                                background: '#00ff9d20',
                                border: '1px solid #00ff9d40',
                                color: '#00ff9d',
                              }}
                            >
                              {acting === item.post.id ? '...' : 'Mark as posted'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {unscheduledIdeas.length > 0 && (
              <div className="mt-6">
                <div className="text-xs tracking-widest text-gray-500 mb-4">UNSCHEDULED IDEAS</div>
                <div
                  className="rounded-lg border overflow-hidden"
                  style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
                >
                  {unscheduledIdeas.map((idea) => (
                    <div
                      key={idea.id}
                      className="px-4 py-3 flex items-start gap-3"
                      style={{ borderBottom: '1px solid #0d0d1a' }}
                    >
                      <span
                        className="text-xs px-2 py-0.5 rounded mt-0.5 flex-shrink-0"
                        style={{
                          color: platformColor[idea.platform],
                          background: `${platformColor[idea.platform]}20`,
                          border: `1px solid ${platformColor[idea.platform]}40`,
                        }}
                      >
                        {idea.platform}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-300 truncate">{idea.topic}</p>
                        <p className="text-xs text-gray-600 mt-1">{idea.angle}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
