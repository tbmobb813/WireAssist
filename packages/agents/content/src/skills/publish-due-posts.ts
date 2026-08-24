import type { Skill } from '@wireassist/core';
import type { ScheduledPost } from '@wireassist/trendpost-mcp';

export interface PublishDuePostsInput {}

export const publishDuePostsSkill: Skill<PublishDuePostsInput, void> = {
  name: 'publish_due_posts',
  role: 'content',
  description: 'Publish every scheduled post whose scheduledAt time has arrived.',

  // No agent.think() — same reasoning as budget_warning_nudge: this is a
  // mechanical sweep over already-approved, already-scheduled posts (the
  // approval gate was schedulePostSkill, at schedule time, not now), so
  // there is no new content decision here for an LLM to make. A
  // deterministic per-post summary is more trustworthy for debugging
  // publish failures than an LLM paraphrase of them would be, and it keeps
  // this 5-minute cron free of any LLM cost on ticks where posts publish.
  async execute({ agent, task }) {
    const due = (await agent.useTool('content_list_posts', {
      status: 'scheduled',
      dueOnly: true,
    })) as ScheduledPost[];

    if (due.length === 0) {
      agent.emit('agent:publish_due_posts_complete', {
        taskId: task.id,
        summary: 'No posts were due to publish.',
        published: [],
        failed: [],
      });
      return;
    }

    const published: ScheduledPost[] = [];
    const failed: ScheduledPost[] = [];

    for (const post of due) {
      let result: ScheduledPost;
      try {
        result = (await agent.useTool('content_publish_post', {
          postId: post.id,
        })) as ScheduledPost;
      } catch (err) {
        // content_publish_post only swallows a *publisher* failure into the
        // post's own errorMessage (see its own comment) — it still throws
        // for a genuinely missing post (e.g. deleted between the listing
        // above and this loop reaching it, a real race in a multi-post
        // sweep with real network time between iterations). An uncaught
        // throw here used to abort the whole loop mid-sweep: no completion
        // event fired at all, silently losing the outcome for every post
        // already published earlier in that same run. Record it as a
        // failure for this post specifically and keep going instead.
        result = {
          ...post,
          status: 'failed',
          errorMessage: err instanceof Error ? err.message : String(err),
        };
      }
      (result.status === 'published' ? published : failed).push(result);

      // The task that actually publishes a post (this cron sweep) is never
      // the task the user tagged with an objectiveId (that was
      // schedulePostSkill, back at schedule time) — this batch task
      // deliberately carries no objectiveId of its own, since one sweep
      // spans posts from many objectives. Emit per-post so each post's
      // publish outcome still reaches its own objective's Kanban board.
      if (result.objectiveId) {
        agent.emit('agent:post_published', {
          objectiveId: result.objectiveId,
          postId: result.id,
          platform: result.platform,
          status: result.status,
          errorMessage: result.errorMessage,
        });
      }
    }

    const summary =
      `Published ${published.length}/${due.length} due post(s)` +
      (failed.length > 0
        ? `; failed: ${failed.map((f) => `${f.platform} (${f.errorMessage})`).join(', ')}`
        : '.');

    agent.emit('agent:publish_due_posts_complete', {
      taskId: task.id,
      summary,
      published,
      failed,
    });
  },
};
