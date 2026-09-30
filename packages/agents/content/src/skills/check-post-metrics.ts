import type { Skill } from '@wireassist/core';
import type { ScheduledPost } from '@wireassist/trendpost-mcp';

export interface CheckPostMetricsInput {}

const WINDOWS = ['24h', '7d'] as const;

export const checkPostMetricsSkill: Skill<CheckPostMetricsInput, void> = {
  name: 'check_post_metrics',
  role: 'content',
  description:
    'Fetch real platform engagement (likes/views/comments/shares) for posts that hit their ' +
    '24h or 7d mark since publishing, so content_retro has real numbers instead of an LLM guess.',

  // No agent.think() — same reasoning as publish_due_posts: this is a
  // mechanical sweep with no content decision for an LLM to make, and it
  // keeps the hourly cron free of LLM cost on ticks where nothing's due.
  async execute({ agent, task }) {
    const checked: ScheduledPost[] = [];
    const failed: ScheduledPost[] = [];

    for (const window of WINDOWS) {
      const due = (await agent.useTool('content_list_posts_needing_metrics_check', {
        window,
      })) as ScheduledPost[];

      for (const post of due) {
        const result = (await agent.useTool('content_check_post_metrics', {
          postId: post.id,
          window,
        })) as ScheduledPost;
        // A fetch failure is recorded (not thrown) by content_check_post_metrics
        // itself — engagementRaw.error is how this loop tells "checked, no
        // data" apart from "checked, got real numbers" for the summary below.
        (result.engagementRaw && 'error' in result.engagementRaw ? failed : checked).push(result);
      }
    }

    const summary =
      checked.length === 0 && failed.length === 0
        ? 'No posts were due for a metrics check.'
        : `Checked metrics for ${checked.length} post(s)` +
          (failed.length > 0 ? `; ${failed.length} platform fetch(es) failed.` : '.');

    agent.emit('agent:check_post_metrics_complete', {
      taskId: task.id,
      summary,
      checked: checked.length,
      failed: failed.length,
    });
  },
};
