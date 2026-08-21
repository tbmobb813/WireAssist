import { createProposeSkillSkill } from '@wireassist/core';
import { buildDelegatedFreeformTask } from '@wireassist/agent-admin';

// A real existing Content skill, simplified to a small, self-contained
// literal string (not an import) so the example in the drafting prompt can
// never silently drift from what's actually being requested, and so this
// file has zero runtime dependency on that skill's internals.
const FEW_SHOT_EXAMPLE = `import type { Skill } from '@wireassist/core';
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
    agent.emit('agent:content_analyzed', { taskId: task.id, content, platform, analysis });
  },
};`;

export const proposeSkillSkill = createProposeSkillSkill({
  role: 'content',
  roleLabel: 'Content',
  pathPrefix: 'packages/agents/content/src/skills/proposed/',
  fewShotExample: FEW_SHOT_EXAMPLE,
  buildHandoffTask: (task, prompt) => buildDelegatedFreeformTask(task, 'github', prompt),
});
