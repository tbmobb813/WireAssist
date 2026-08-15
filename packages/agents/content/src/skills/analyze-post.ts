import type { Skill } from '@wireassist/core';
import type { Platform } from '@wireassist/trendpost-mcp';

export interface AnalyzePostInput {
  content: string;
  platform: Platform;
}

export const analyzePostSkill: Skill<AnalyzePostInput, void> = {
  name: 'analyze_post',
  role: 'content',
  description: 'Analyze the quality of a piece of content.',

  async execute({ agent, task, input }) {
    const { content, platform } = input;

    const analysis = await agent.useTool('content_analyze', { content, platform });

    agent.emit('agent:content_analyzed', {
      taskId: task.id,
      content,
      platform,
      analysis,
    });
  },
};
