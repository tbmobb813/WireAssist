import Anthropic from '@anthropic-ai/sdk';
import { SynqPostStorage, Platform, PostStatus } from './storage';
import type { MCPClient } from '@synqworks/core';

function parseJson<T>(raw: string, context: string): T {
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    return JSON.parse(stripped) as T;
  } catch {
    throw new Error(`${context} returned unparseable JSON: ${stripped.slice(0, 200)}`);
  }
}

const client = new Anthropic();

const CONTENT_SYSTEM_PROMPT = `You are a professional content writer for solo business operators.
You write content that is:
- Authentic and direct — no corporate fluff
- Platform-appropriate in length and tone
- Focused on one clear idea per post
- Written in first person, active voice

PLATFORM GUIDELINES:
- twitter/threads: 280 chars max, punchy, no hashtag spam (1-2 max)
- linkedin: 150-300 words, professional but human, end with a question or insight
- instagram: visual-first, 100-150 words, 3-5 relevant hashtags at the end

Never use phrases like "Excited to share" or "Thrilled to announce".
Never use excessive emojis.
Write like a smart human, not a marketing bot.`;

export function registerSynqPostTools(mcp: MCPClient, storage: SynqPostStorage): void {

  // ── GENERATE CONTENT ──────────────────────────────────────────
  mcp.register('content_generate', async (params) => {
    const { topic, platform, tone, context } = params as {
      topic: string;
      platform: Platform;
      tone?: string;
      context?: string;
    };

    const prompt = `Write a ${platform} post about: ${topic}
${tone ? `Tone: ${tone}` : ''}
${context ? `Business context: ${context}` : ''}

Return ONLY the post content. No labels, no explanations, no quotes around it.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: CONTENT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('');

    return { content, platform, topic };
  });

  // ── GENERATE CONTENT PLAN ─────────────────────────────────────
  mcp.register('content_generate_plan', async (params) => {
    const { businessContext, platforms, weeksAhead = 1, postsPerWeek = 3 } = params as {
      businessContext: string;
      platforms: Platform[];
      weeksAhead?: number;
      postsPerWeek?: number;
    };

    const totalPosts = weeksAhead * postsPerWeek;
    const prompt = `Create a content plan for a solo business operator.

Business context: ${businessContext}
Platforms: ${platforms.join(', ')}
Posts needed: ${totalPosts} posts over ${weeksAhead} week(s)

Return a JSON array of content ideas. Each item:
{
  "topic": "specific topic",
  "angle": "unique angle or hook",
  "platform": "${platforms[0]}",
  "suggestedDay": "Monday"
}

Return only valid JSON array. No markdown fences.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: CONTENT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('');

    const ideas = parseJson<Array<{
      topic: string;
      angle: string;
      platform: Platform;
      suggestedDay?: string;
    }>>(raw, 'content_generate_plan');

    const saved = ideas.map(idea =>
      storage.createIdea({
        topic: idea.topic,
        angle: idea.angle,
        platform: idea.platform,
      })
    );

    return { ideas: saved, totalGenerated: saved.length };
  });

  // ── SCHEDULE POST ─────────────────────────────────────────────
  mcp.register('content_schedule_post', async (params) => {
    const { content, platform, scheduledAt, tags, campaignId } = params as {
      content: string;
      platform: Platform;
      scheduledAt: string;
      tags?: string[];
      campaignId?: string;
    };

    return storage.createPost({
      content,
      platform,
      scheduledAt: new Date(scheduledAt),
      tags,
      campaignId,
    });
  });

  // ── LIST SCHEDULED POSTS ──────────────────────────────────────
  mcp.register('content_list_posts', async (params) => {
    const { status, platform, daysAhead } = params as {
      status?: string;
      platform?: Platform;
      daysAhead?: number;
    };

    const now = new Date();
    const to = daysAhead
      ? new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)
      : undefined;

    return storage.listPosts({ status: status as PostStatus | undefined, platform, from: now, to });
  });

  // ── DELETE POST ───────────────────────────────────────────────
  mcp.register('content_delete_post', async (params) => {
    storage.deletePost(params.postId as string);
    return { deleted: true };
  });

  // ── LIST IDEAS ────────────────────────────────────────────────
  mcp.register('content_list_ideas', async (params) => {
    return storage.listIdeas(params.status as string | undefined);
  });

  // ── ANALYZE CONTENT ───────────────────────────────────────────
  mcp.register('content_analyze', async (params) => {
    const { content, platform } = params as { content: string; platform: Platform };

    const prompt = `Analyze this ${platform} post and return JSON:
{
  "score": 1-10,
  "strengths": ["..."],
  "improvements": ["..."],
  "estimatedEngagement": "low",
  "suggestion": "one specific rewrite suggestion"
}

POST:
${content}

Return only valid JSON. No markdown fences.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: CONTENT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('');

    return parseJson(raw, 'content_analyze');
  });
}
