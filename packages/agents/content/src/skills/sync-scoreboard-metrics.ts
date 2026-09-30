import type { Skill } from '@wireassist/core';
import type { ScheduledPost } from '@wireassist/trendpost-mcp';

export interface SyncScoreboardMetricsInput {}

// Full re-sum of every published post's current engagement, not an
// incremental add — this runs daily and posts trickle new engagement
// numbers in at various times via check_post_metrics (hourly), so
// re-summing the whole known total each time is what keeps "today's
// content metrics" correct without a separate delta-tracking mechanism
// that could double-count or drift.
export const syncScoreboardMetricsSkill: Skill<SyncScoreboardMetricsInput, void> = {
  name: 'sync_scoreboard_metrics',
  role: 'content',
  description: "Roll up every published post's known engagement into today's scoreboard totals.",

  // No agent.think() — mechanical aggregation, same reasoning as
  // publish_due_posts/check_post_metrics.
  async execute({ agent, task }) {
    // content_list_posts with no daysAgo/daysAhead defaults to "scheduled
    // at or after now" — a forward-looking window that would silently
    // exclude every already-published post (scheduled_at is in the past
    // for those). daysAgo is the only way to ask this tool for "all
    // published posts, regardless of when"; ~50 years is effectively
    // unbounded without relying on undocumented tool behavior around 0/
    // undefined.
    const posts = (await agent.useTool('content_list_posts', {
      status: 'published',
      daysAgo: 365 * 50,
    })) as ScheduledPost[];

    const totals = { likes: 0, views: 0, comments: 0, shares: 0 };
    for (const post of posts) {
      totals.likes += post.likesCount ?? 0;
      totals.views += post.viewsCount ?? 0;
      totals.comments += post.commentsCount ?? 0;
      totals.shares += post.sharesCount ?? 0;
    }

    const date = new Date().toISOString().slice(0, 10);
    await agent.useTool('record_metric', {
      date,
      source: 'content',
      metric: 'likes',
      value: totals.likes,
    });
    await agent.useTool('record_metric', {
      date,
      source: 'content',
      metric: 'views',
      value: totals.views,
    });
    await agent.useTool('record_metric', {
      date,
      source: 'content',
      metric: 'comments',
      value: totals.comments,
    });
    await agent.useTool('record_metric', {
      date,
      source: 'content',
      metric: 'shares',
      value: totals.shares,
    });
    await agent.useTool('record_metric', {
      date,
      source: 'content',
      metric: 'published_count',
      value: posts.length,
    });

    agent.emit('agent:sync_scoreboard_metrics_complete', {
      taskId: task.id,
      summary:
        `Synced today's content totals: ${totals.likes} likes, ${totals.views} views, ` +
        `${totals.comments} comments, ${totals.shares} shares across ${posts.length} published post(s).`,
      totals,
    });
  },
};
