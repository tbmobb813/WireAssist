import type { Skill } from '@wireassist/core';
import type { Platform } from '@wireassist/trendpost-mcp';

export interface GeneratePlanInput {
  platforms: Platform[];
  weeksAhead?: number;
  postsPerWeek?: number;
  businessContext?: string;
}

export const generatePlanSkill: Skill<GeneratePlanInput, void> = {
  name: 'generate_plan',
  role: 'content',
  description: 'Generate a multi-week content plan across platforms, gated by approval.',
  requiresApproval: true,

  async execute({ agent, task, input }) {
    const { platforms, weeksAhead = 1, postsPerWeek = 3, businessContext: providedContext } = input;

    const memoryContext = await agent.loadContext(
      'business description products services recent news'
    );
    // providedContext carries a handoff from another agent (e.g. a GTM strategy) —
    // it takes precedence since it's a more specific, current business description
    // than whatever's accumulated in memory.
    const businessContext =
      [providedContext, memoryContext].filter(Boolean).join('\n\n') || 'Solo business operator';

    const result = (await agent.useTool('content_generate_plan', {
      businessContext,
      platforms,
      weeksAhead,
      postsPerWeek,
    })) as { ideas: unknown[]; totalGenerated: number };

    agent.emit('agent:content_plan_generated', {
      taskId: task.id,
      ideas: result.ideas,
      totalGenerated: result.totalGenerated,
    });

    const approved = await agent.proposeAction(
      task,
      `Approve content plan: ${result.totalGenerated} posts across ${platforms.join(', ')}`,
      { ideas: result.ideas }
    );

    if (approved) {
      agent.remember(
        `Approved content plan: ${result.totalGenerated} posts for ${platforms.join(', ')}`,
        ['content', 'plan', 'approved']
      );
    }
  },
};
