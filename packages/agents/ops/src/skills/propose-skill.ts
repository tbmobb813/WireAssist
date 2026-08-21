import { createProposeSkillSkill } from '@wireassist/core';
import { buildDelegatedFreeformTask } from '@wireassist/agent-admin';

// NixOps's real skills (run-workflow.ts, trust-graduation-nudges.ts) are
// meaningfully larger and pull in workflow-context loading that wouldn't
// resolve as a standalone literal string, so this is a short, synthetic,
// self-contained example in the same spirit instead — matching Admin's own
// few-shot precedent (a hand-written literal, not a verbatim copy of a
// real file).
const FEW_SHOT_EXAMPLE = `import type { Skill } from '@wireassist/core';

export interface WorkflowHealthCheckInput {
  workflow: string;
}

export const workflowHealthCheckSkill: Skill<WorkflowHealthCheckInput, void> = {
  name: 'workflow_health_check',
  role: 'strategy',
  description: 'Check a named workflow for missing settings before it runs unattended.',

  async execute({ agent, task, input }) {
    const { workflow } = input;
    const status = await agent.useTool('list_workflows', {});
    const summary = await agent.think(
      \`Given this workflow status, flag anything missing before "\${workflow}" can run unattended: \${JSON.stringify(status)}\`
    );
    agent.emit('agent:workflow_health_check_complete', { taskId: task.id, summary });
  },
};`;

export const proposeSkillSkill = createProposeSkillSkill({
  role: 'strategy',
  roleLabel: 'NixOps',
  pathPrefix: 'packages/agents/ops/src/skills/proposed/',
  fewShotExample: FEW_SHOT_EXAMPLE,
  buildHandoffTask: (task, prompt) => buildDelegatedFreeformTask(task, 'github', prompt),
});
