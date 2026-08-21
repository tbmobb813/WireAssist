import { createProposeSkillSkill } from '@wireassist/core';
import { buildDelegatedFreeformTask } from '@wireassist/agent-admin';

// GitHub's only other skill (freeform.ts) is a thin tool-loop wrapper, not
// representative of a typical drafted skill's shape, so this is a short,
// synthetic, self-contained example instead — matching Admin's own
// few-shot precedent (a hand-written literal, not a verbatim copy of a
// real file).
const FEW_SHOT_EXAMPLE = `import type { Skill } from '@wireassist/core';

export interface StaleIssuesInput {
  daysStale?: number;
}

export const staleIssuesSkill: Skill<StaleIssuesInput, void> = {
  name: 'stale_issues_nudge',
  role: 'github',
  description: 'Flag open issues that have gone too long without an update.',

  async execute({ agent, task, input }) {
    const daysStale = input.daysStale ?? 5;
    const issues = await agent.useTool('list_issues', { state: 'open' });
    // ... filter issues by daysStale, build a summary ...
    agent.emit('agent:stale_issues_complete', { taskId: task.id, stale: [] });
  },
};`;

export const proposeSkillSkill = createProposeSkillSkill({
  role: 'github',
  roleLabel: 'GitHub Dev',
  pathPrefix: 'packages/agents/github/src/skills/proposed/',
  fewShotExample: FEW_SHOT_EXAMPLE,
  buildHandoffTask: (task, prompt) => buildDelegatedFreeformTask(task, 'github', prompt),
});
