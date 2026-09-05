import type { Skill } from '@wireassist/core';
import type { Platform } from '@wireassist/trendpost-mcp';

export interface GenerateAndScheduleCampaignInput {
  platforms: Platform[];
  // See generate-plan.ts's GeneratePlanInput.account for why this matters —
  // without it, a batch gets generated against every venture's blended
  // context at once with no record of which post was meant for which
  // account (confirmed live 2026-09-05).
  account?: string;
  weeksAhead?: number;
  postsPerWeek?: number;
  businessContext?: string;
}

interface GeneratedIdea {
  topic: string;
  angle: string;
  platform: Platform;
  scheduledFor: string;
}

interface ContentAnalysis {
  score: number;
  strengths: string[];
  improvements: string[];
  estimatedEngagement: string;
  suggestion: string;
}

// A passing score good enough to auto-schedule without a human reading
// every post — matches content_analyze's own rubric where 7+ means
// "specific and platform-native," not just "not generic."
const PASS_THRESHOLD = 7;

// generate_plan_skill stops at ideas (topic/angle/platform/date) — this
// skill takes that same idea-generation step and carries it all the way to
// scheduled posts: draft each idea, self-score it via content_analyze
// (cheap, same-agent — see AGENTS.md's note on why this isn't the more
// expensive independent Research-style cold review), retry once with the
// score's own feedback if it's weak, then propose ONE batch approval to
// schedule everything that passed. Posts that fail even after a retry are
// left unscheduled and reported, not silently shipped or silently dropped.
export const generateAndScheduleCampaignSkill: Skill<GenerateAndScheduleCampaignInput, void> = {
  name: 'generate_and_schedule_campaign',
  role: 'content',
  description:
    'Generate a full content campaign, draft and self-score every post, and schedule the ones that pass.',
  requiresApproval: true,

  async execute({ agent, task, input }) {
    const {
      platforms,
      account,
      weeksAhead = 1,
      postsPerWeek = 3,
      businessContext: providedContext,
    } = input;

    const memoryContext = await agent.loadContext(
      'business description products services recent news audience'
    );
    const businessContext =
      [providedContext, memoryContext].filter(Boolean).join('\n\n') || 'Solo business operator';

    const planResult = (await agent.useTool('content_generate_plan', {
      businessContext,
      platforms,
      account,
      weeksAhead,
      postsPerWeek,
    })) as { ideas: GeneratedIdea[]; totalGenerated: number };

    const ready: Array<{
      content: string;
      platform: Platform;
      account?: string;
      scheduledAt: string;
    }> = [];
    const flagged: Array<{ topic: string; platform: Platform; reason: string }> = [];

    for (const idea of planResult.ideas) {
      let draft = (await agent.useTool('content_generate', {
        topic: idea.topic,
        platform: idea.platform,
        account,
        context: `${businessContext}\n\nAngle: ${idea.angle}`,
      })) as { content: string };

      let analysis = (await agent.useTool('content_analyze', {
        content: draft.content,
        platform: idea.platform,
      })) as ContentAnalysis;

      if (analysis.score < PASS_THRESHOLD) {
        draft = (await agent.useTool('content_generate', {
          topic: idea.topic,
          platform: idea.platform,
          account,
          context:
            `${businessContext}\n\nAngle: ${idea.angle}\n\n` +
            `A PRIOR DRAFT SCORED ${analysis.score}/10 — specific feedback to address:\n` +
            `${analysis.improvements.join('\n')}\nSuggestion: ${analysis.suggestion}`,
        })) as { content: string };

        analysis = (await agent.useTool('content_analyze', {
          content: draft.content,
          platform: idea.platform,
        })) as ContentAnalysis;
      }

      if (analysis.score >= PASS_THRESHOLD) {
        ready.push({
          content: draft.content,
          platform: idea.platform,
          account,
          scheduledAt: idea.scheduledFor,
        });
      } else {
        flagged.push({
          topic: idea.topic,
          platform: idea.platform,
          reason: `Scored ${analysis.score}/10 after a retry — ${analysis.suggestion}`,
        });
      }
    }

    agent.emit('agent:campaign_drafted', {
      taskId: task.id,
      totalGenerated: planResult.totalGenerated,
      readyCount: ready.length,
      flaggedCount: flagged.length,
      flagged,
    });

    if (ready.length === 0) {
      agent.remember(
        `Generated a ${platforms.join('/')} campaign — all ${flagged.length} draft(s) failed quality review, nothing scheduled.`,
        ['content', 'campaign', ...platforms]
      );
      return;
    }

    const accountLabel = account ? ` for ${account}` : '';
    const approved = await agent.proposeAction(
      task,
      ready.length === 1
        ? `Schedule this ${ready[0].platform} post${accountLabel} for ${new Date(ready[0].scheduledAt).toLocaleDateString()}?`
        : `Schedule ${ready.length} posts across ${platforms.join('/')}${accountLabel} for the week?`,
      { posts: ready }
    );

    if (!approved) {
      agent.remember(
        `Generated a ${platforms.join('/')} campaign (${ready.length} ready) — scheduling declined.`,
        ['content', 'campaign', ...platforms]
      );
      return;
    }

    const scheduled = [];
    for (const post of ready) {
      const result = await agent.useTool('content_schedule_post', {
        content: post.content,
        platform: post.platform,
        account: post.account,
        scheduledAt: post.scheduledAt,
        objectiveId: task.objectiveId,
      });
      scheduled.push(result);
    }

    agent.emit('agent:campaign_scheduled', { taskId: task.id, scheduled, flagged });
    agent.remember(
      `Generated and scheduled a ${platforms.join('/')} campaign: ${scheduled.length} post(s) scheduled` +
        (flagged.length > 0 ? `, ${flagged.length} flagged and left unscheduled.` : '.'),
      ['content', 'campaign', 'scheduled', ...platforms]
    );
  },
};
