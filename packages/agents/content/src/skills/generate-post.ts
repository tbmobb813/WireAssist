import type { Skill } from '@wireassist/core';
import type { Platform } from '@wireassist/trendpost-mcp';

export interface GeneratePostInput {
  topic: string;
  platform: Platform;
  tone?: string;
  extraContext?: string;
}

export const generatePostSkill: Skill<GeneratePostInput, void> = {
  name: 'generate_post',
  role: 'content',
  description: 'Generate a single post for one platform, gated by approval.',
  requiresApproval: true,

  async execute({ agent, task, input }) {
    const { topic, platform, tone, extraContext } = input;

    const memoryContext = await agent.loadContext(
      'business description products services audience'
    );
    // extraContext carries a handoff from another agent (e.g. a research finding) —
    // it takes precedence in the prompt since it's more specific to this post than
    // the agent's general business-context memory.
    const context = [extraContext, memoryContext].filter(Boolean).join('\n\n');

    const result = (await agent.useTool('content_generate', {
      topic,
      platform,
      tone,
      context,
    })) as { content: string; platform: string; topic: string };

    agent.emit('agent:content_generated', {
      taskId: task.id,
      ...result,
    });

    const analysis = (await agent.useTool('content_analyze', {
      content: result.content,
      platform,
    })) as { score: number; estimatedEngagement: string; suggestion: string };

    const approved = await agent.proposeAction(
      task,
      `Post to ${platform}: "${result.content.slice(0, 80)}..."`,
      { content: result.content, platform, analysis }
    );

    if (approved) {
      agent.remember(`Generated approved ${platform} post about: ${topic}`, [
        'content',
        'approved',
        platform,
      ]);
      agent.emit('agent:content_approved', {
        taskId: task.id,
        content: result.content,
        platform,
      });
    } else {
      agent.remember(`User rejected ${platform} post about: ${topic}. May need different angle.`, [
        'content',
        'rejected',
        platform,
      ]);
    }
  },
};
