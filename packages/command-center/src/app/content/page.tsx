'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAgentEvents } from '@/hooks/useAgentEvents';
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
}

const platformColor: Record<string, string> = {
  twitter: '#1da1f2',
  linkedin: '#0077b5',
  instagram: '#e1306c',
  threads: '#94a3b8',
};

export default function ContentPage() {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [generating, setGenerating] = useState(false);
  const [topic, setTopic] = useState('');
  const [platform, setPlatform] = useState<Platform>('linkedin');
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    const res = await fetch('/api/content/posts?daysAhead=14');
    if (res.ok) setPosts(await res.json());
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useAgentEvents(
    useCallback(
      (e) => {
        if (e.event === 'content_generated') {
          const p = e.payload as { content: string };
          setLastGenerated(p.content);
          setGenerating(false);
        }
        if (e.event === 'post_scheduled') {
          fetchPosts();
        }
        if (e.event === 'task_failed' && e.payload.agentRole === 'content') {
          setGenerating(false);
        }
      },
      [fetchPosts]
    )
  );

  const generatePost = async () => {
    if (!topic.trim() || generating) return;
    setGenerating(true);
    setLastGenerated(null);
    const res = await fetch('/api/tasks/generate-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: topic.trim(), platform }),
    });
    if (!res.ok) setGenerating(false);
  };

  const generatePlan = async () => {
    setGenerating(true);
    const res = await fetch('/api/tasks/generate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platforms: ['linkedin', 'twitter'], weeksAhead: 1, postsPerWeek: 3 }),
    });
    if (!res.ok) setGenerating(false);
  };

  // Group posts by date for calendar view
  const postsByDate = posts.reduce(
    (acc, post) => {
      const date = new Date(post.scheduledAt).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      if (!acc[date]) acc[date] = [];
      acc[date].push(post);
      return acc;
    },
    {} as Record<string, ScheduledPost[]>
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
            <p className="text-xs text-gray-600 mb-3">
              Generate a full week of content ideas across LinkedIn and Twitter. 3 posts/week.
            </p>
            <button
              onClick={generatePlan}
              disabled={generating}
              className="w-full py-2 rounded text-xs font-bold tracking-widest transition-colors"
              style={{
                background: '#ffb34720',
                border: '1px solid #ffb34740',
                color: generating ? '#475569' : '#ffb347',
                cursor: generating ? 'not-allowed' : 'pointer',
              }}
            >
              → GENERATE PLAN
            </button>
          </div>

          {/* Last generated preview */}
          {lastGenerated && (
            <div
              className="rounded-lg border p-4"
              style={{ background: '#0d0d1a', borderColor: '#00ff9d30' }}
            >
              <div className="text-xs tracking-widest mb-2" style={{ color: '#00ff9d' }}>
                GENERATED — CHECK APPROVALS
              </div>
              <p className="text-sm text-gray-400 whitespace-pre-wrap leading-relaxed">
                {lastGenerated}
              </p>
            </div>
          )}
        </div>

        {/* Right — Calendar */}
        <div className="col-span-2">
          <div className="text-xs tracking-widest text-gray-500 mb-4">
            CONTENT CALENDAR — NEXT 14 DAYS
          </div>

          {Object.keys(postsByDate).length === 0 ? (
            <div
              className="rounded-lg border p-12 text-center"
              style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
            >
              <div className="text-gray-600 text-sm">
                No scheduled posts. Generate content to populate the calendar.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(postsByDate).map(([date, datePosts]) => (
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
                  {datePosts.map((post) => (
                    <div
                      key={post.id}
                      className="px-4 py-3 flex items-start gap-3"
                      style={{ borderBottom: '1px solid #0d0d1a' }}
                    >
                      <span
                        className="text-xs px-2 py-0.5 rounded mt-0.5 flex-shrink-0"
                        style={{
                          color: platformColor[post.platform],
                          background: `${platformColor[post.platform]}20`,
                          border: `1px solid ${platformColor[post.platform]}40`,
                        }}
                      >
                        {post.platform}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-300 truncate">{post.content}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-600">
                            {new Date(post.scheduledAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span
                            className="text-xs tracking-widest"
                            style={{ color: post.status === 'published' ? '#00ff9d' : '#4fc3f7' }}
                          >
                            {post.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
