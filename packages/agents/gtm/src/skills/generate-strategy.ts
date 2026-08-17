import type { Skill } from '@wireassist/core';
import { ContentTasks } from '@wireassist/agent-content';
import type { Platform } from '@wireassist/trendpost-mcp';
import { buildGtmPrompt } from '../prompts';
import type { GtmProductInput, GtmStrategy } from '../types';
import { extractJson } from './extract-json';

export interface GenerateStrategyInput {
  product: GtmProductInput;
  offerContentDraft?: { platform: Platform; tone?: string };
  offerContentCalendar?: { platforms: Platform[] };
}

export const generateStrategySkill: Skill<GenerateStrategyInput, void> = {
  name: 'generate_gtm',
  role: 'gtm',
  description: 'Generate a concrete go-to-market strategy for a product.',

  async execute({ agent, task, input }) {
    const { product, offerContentDraft, offerContentCalendar } = input;

    const raw = await agent.think(buildGtmPrompt(product));
    const gtm = extractJson<GtmStrategy>(raw);

    agent.emit('agent:gtm_generated', { taskId: task.id, gtm });
    agent.remember(JSON.stringify({ product: product.name, gtm }), [
      'gtm',
      'strategy',
      product.name,
    ]);

    // Optional, independent second approval: hand this strategy's
    // positioning straight to a Content task, same pattern as Research's
    // offerContentDraft handoff to Content. Still gated — the handoff
    // itself requires approval here, and the resulting Content task goes
    // through its own approval before anything is ever posted.
    if (offerContentDraft) {
      const { platform, tone } = offerContentDraft;
      const draftApproved = await agent.proposeAction(
        task,
        `Draft ${platform} content announcing ${product.name}'s launch based on this GTM strategy?`,
        { product: product.name, platform, tone }
      );
      if (draftApproved) {
        const topic = `${product.name}: ${gtm.positioning.headline}`;
        const extraContext = [
          `Positioning: ${gtm.positioning.headline}`,
          `North star: ${gtm.north_star}`,
          `Founder advantage: ${gtm.founder_advantage}`,
        ].join('\n');
        const handoffTask = ContentTasks.generatePost(
          topic,
          platform,
          tone,
          extraContext,
          task.objectiveId
        );
        agent.emit('agent:handoff_requested', { task: handoffTask });
      }
    }

    // A second, independent handoff option — turns the whole launch_timeline
    // into a dated content calendar under a campaign, instead of just one
    // announcement post. Both options can be requested together; they serve
    // different needs and neither depends on the other's outcome.
    if (offerContentCalendar) {
      const { platforms } = offerContentCalendar;
      const calendarApproved = await agent.proposeAction(
        task,
        `Generate a full content calendar for ${product.name} from this launch timeline?`,
        { product: product.name, platforms }
      );
      if (calendarApproved) {
        const handoffTask = ContentTasks.generatePlanFromTimeline(
          product.name,
          gtm.launch_timeline,
          platforms,
          task.objectiveId
        );
        agent.emit('agent:handoff_requested', { task: handoffTask });
      }
    }
  },
};
