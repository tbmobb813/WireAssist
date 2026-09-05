import type { Skill } from '@wireassist/core';
import type { Platform } from '@wireassist/trendpost-mcp';

export interface GeneratePlanInput {
  platforms: Platform[];
  // Which specific brand/account this plan is for (e.g. "techtrendwire",
  // "mindtype_studio", "nixlevel") — required in practice, not just
  // optional metadata: without it, ideas get generated against the
  // blended business-context memory spanning every venture at once, which
  // is exactly what produced an unlabeled, cross-venture-mixed batch live
  // on 2026-09-05. Left optional in the type only for backward
  // compatibility with any caller that hasn't been updated yet.
  account?: string;
  weeksAhead?: number;
  postsPerWeek?: number;
  businessContext?: string;
}

export const generatePlanSkill: Skill<GeneratePlanInput, void> = {
  name: 'generate_plan',
  role: 'content',
  // Not approval-gated, same reasoning as generate_post_skill — generating
  // and remembering ideas has no real-world effect. Scheduling each idea
  // individually (schedule_post_skill) is the real "will this go live"
  // checkpoint.
  description: 'Generate a multi-week content plan across platforms.',

  async execute({ agent, task, input }) {
    const {
      platforms,
      account,
      weeksAhead = 1,
      postsPerWeek = 3,
      businessContext: providedContext,
    } = input;

    // Exact per-account onboarding answers (if any exist) take priority
    // over the general blended business-context search — mixing the two
    // is exactly what put NixLevel/controller-repair/blog content into a
    // batch labeled for a single specific account (confirmed live
    // 2026-09-05). Falls back to the blended search when no account-
    // specific answers have been onboarded yet, so behavior is unchanged
    // for any account without dedicated context.
    const accountContext = account
      ? agent
          .listMemories({ tags: [`account:${account}`] })
          .map((m) => m.content)
          .join('\n\n')
      : '';
    const memoryContext =
      accountContext ||
      (await agent.loadContext('business description products services recent news'));
    // providedContext carries a handoff from another agent (e.g. a GTM strategy) —
    // it takes precedence since it's a more specific, current business description
    // than whatever's accumulated in memory.
    const businessContext =
      [providedContext, memoryContext].filter(Boolean).join('\n\n') || 'Solo business operator';

    const result = (await agent.useTool('content_generate_plan', {
      businessContext,
      platforms,
      account,
      weeksAhead,
      postsPerWeek,
    })) as { ideas: unknown[]; totalGenerated: number };

    agent.emit('agent:content_plan_generated', {
      taskId: task.id,
      ideas: result.ideas,
      totalGenerated: result.totalGenerated,
    });

    // No approval gate here (see the skill's own comment on why) — this
    // only saves the plan's ideas to memory, it doesn't schedule any of
    // them; scheduling is a separate, later, approval-gated step per idea.
    agent.remember(
      `Generated content plan: ${result.totalGenerated} posts for ${platforms.join(', ')}`,
      ['content', 'plan', 'generated']
    );
  },
};
