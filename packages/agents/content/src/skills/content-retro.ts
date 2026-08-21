import type { Skill } from '@wireassist/core';
import type { ScheduledPost } from '@wireassist/trendpost-mcp';

const DEFAULT_DAYS_AGO = 30;

// Shape of content_analyze's JSON response — see trendpost-mcp/src/tools.ts's
// own prompt for the contract this is analyzing against.
interface ContentAnalysis {
  score?: number;
  strengths?: string[];
  improvements?: string[];
  estimatedEngagement?: string;
  suggestion?: string;
}

export interface ContentRetroInput {
  daysAgo?: number;
}

export const contentRetroSkill: Skill<ContentRetroInput, void> = {
  name: 'content_retro',
  role: 'content',
  description:
    "Analyze recently published posts and synthesize what worked, what didn't, and what to try next.",

  // Unlike the nudge skills, this always calls think() — a retro over a
  // quiet period ("nothing published this month, here's what to do about
  // it") is still meaningful, unlike a stale-item nudge that has nothing to
  // say when its queue is empty.
  async execute({ agent, task, input }) {
    const daysAgo = input.daysAgo ?? DEFAULT_DAYS_AGO;

    const posts = (await agent.useTool('content_list_posts', {
      status: 'published',
      daysAgo,
    })) as ScheduledPost[];

    const analyzed: Array<{ post: ScheduledPost; analysis: ContentAnalysis }> = [];
    for (const post of posts) {
      const analysis = (await agent.useTool('content_analyze', {
        content: post.content,
        platform: post.platform,
      })) as ContentAnalysis;
      analyzed.push({ post, analysis });
    }

    const retro = await agent.think(
      analyzed.length === 0
        ? `No posts were published in the last ${daysAgo} days. Write a short, direct note ` +
            `for Jason about this quiet period — ask what's blocking publishing (no ideas queued? ` +
            `no time to review drafts?) rather than assuming, and suggest one concrete next step.`
        : `Write a short, direct performance retro for Jason covering the ${analyzed.length} post(s) ` +
            `published in the last ${daysAgo} days. Identify what's actually working (cite specific ` +
            `posts, not generic praise), what's falling flat, and one concrete thing to try next — ` +
            `no filler, no "consider experimenting with different content types."\n\n` +
            `PUBLISHED POSTS (with content_analyze's own quality assessment):\n` +
            analyzed
              .map(
                ({ post, analysis }) =>
                  `- [${post.platform}] score ${analysis.score ?? '?'}/10, ` +
                  `estimated engagement: ${analysis.estimatedEngagement ?? 'unknown'}\n` +
                  `  "${post.content.slice(0, 200)}"` +
                  (analysis.suggestion ? `\n  Suggestion at the time: ${analysis.suggestion}` : '')
              )
              .join('\n')
    );

    agent.emit('agent:content_retro_complete', {
      taskId: task.id,
      summary: retro,
      postsAnalyzed: analyzed.length,
    });

    agent.remember(`Content retro (${daysAgo}d, ${analyzed.length} posts):\n\n${retro}`, [
      'content',
      'retro',
    ]);
  },
};
