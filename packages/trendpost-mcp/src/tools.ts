import Anthropic from '@anthropic-ai/sdk';
import { TrendPostStorage, Platform, PostStatus } from './storage';
import type { MCPClient } from '@wireassist/core';

const MODEL = process.env.WIREASSIST_MODEL ?? 'claude-sonnet-5';

function parseJson<T>(raw: string, context: string): T {
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
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
Write like a smart human, not a marketing bot.

When business context is given, the post must be specific to that business — not
content that could have been written for anyone in the same industry. When no business
context is given, don't invent fake specifics (numbers, customer stories, product
details) to fill the gap — write a solid, topic-focused post that stays honest about
what you actually know.`;

export function registerTrendPostTools(mcp: MCPClient, storage: TrendPostStorage): void {
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
      model: MODEL,
      max_tokens: 1024,
      system: CONTENT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return { content, platform, topic };
  });

  // ── GENERATE CONTENT PLAN ─────────────────────────────────────
  mcp.register('content_generate_plan', async (params) => {
    const {
      businessContext,
      platforms,
      weeksAhead = 1,
      postsPerWeek = 3,
    } = params as {
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

Distribute posts across ALL of the given platforms roughly evenly — don't default every
idea to the first one. Every idea must be specific to the business context above, not a
generic content-calendar filler topic that could apply to any business in the industry.

Return a JSON array of content ideas. Each item:
{
  "topic": "specific topic grounded in the business context",
  "angle": "unique angle or hook",
  "platform": "one of: ${platforms.join(', ')}",
  "suggestedDay": "Monday"
}

Return only valid JSON array. No markdown fences.`;

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: CONTENT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const ideas = parseJson<
      Array<{
        topic: string;
        angle: string;
        platform: Platform;
        suggestedDay?: string;
      }>
    >(raw, 'content_generate_plan');

    const saved = ideas.map((idea) =>
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
    const to = daysAhead ? new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000) : undefined;

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

Score against this rubric, not gut feel:
- 1-3: generic — could have been written for any business in this industry
- 4-6: solid but not distinctive — no reason someone stops scrolling for it
- 7-8: specific and platform-native — a real hook, a real detail, fits the platform's format
- 9-10: exceptional — the kind of post that gets screenshotted or replied to unprompted
"suggestion" must name the specific weak line/word and what to replace it with, not
generic advice like "make it more engaging."

POST:
${content}

Return only valid JSON. No markdown fences.`;

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: CONTENT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return parseJson(raw, 'content_analyze');
  });
}
