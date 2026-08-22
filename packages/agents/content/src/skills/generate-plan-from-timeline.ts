import type { Skill } from '@wireassist/core';
import type { Platform } from '@wireassist/trendpost-mcp';

// Deliberately duplicated rather than imported from @wireassist/agent-gtm —
// content shouldn't depend on gtm's package, and this is the minimal shape
// this skill actually needs from a GtmTimelineWeek.
export interface TimelineWeekInput {
  week: string;
  focus: string;
  tasks: string[];
}

export interface GeneratePlanFromTimelineInput {
  productName: string;
  timeline: TimelineWeekInput[];
  platforms: Platform[];
}

export const generatePlanFromTimelineSkill: Skill<GeneratePlanFromTimelineInput, void> = {
  name: 'generate_plan_from_timeline',
  role: 'content',
  description:
    'Turn a GTM launch timeline into a dated content calendar under a new campaign, gated by approval.',
  requiresApproval: true,

  async execute({ agent, task, input }) {
    const { productName, timeline, platforms } = input;

    const result = (await agent.useTool('content_generate_plan_from_timeline', {
      productName,
      timeline,
      platforms,
    })) as { ideas: unknown[]; totalGenerated: number; campaign: { id: string; name: string } };

    agent.emit('agent:content_plan_generated', {
      taskId: task.id,
      ideas: result.ideas,
      totalGenerated: result.totalGenerated,
    });

    const approved = await agent.proposeAction(
      task,
      `Approve content calendar for "${productName}": ${result.totalGenerated} posts under campaign "${result.campaign.name}"`,
      { ideas: result.ideas, campaign: result.campaign }
    );

    if (approved) {
      agent.remember(
        `Approved content calendar from GTM timeline for "${productName}": ${result.totalGenerated} posts under campaign "${result.campaign.name}"`,
        ['content', 'plan', 'gtm', 'approved']
      );
    }
  },
};
