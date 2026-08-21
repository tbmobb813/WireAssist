import { createProposeSkillSkill } from '@wireassist/core';
import { buildDelegatedFreeformTask } from '@wireassist/agent-admin';

// A real existing Research skill, simplified to a small, self-contained
// literal string (not an import) so the example in the drafting prompt can
// never silently drift from what's actually being requested, and so this
// file has zero runtime dependency on that skill's internals. Chosen for
// its shape — a proposeAction-gated remember(), the closest structural
// match to Admin's own few-shot example.
const FEW_SHOT_EXAMPLE = `import type { Skill } from '@wireassist/core';

export interface SynthesizeFindingsInput {
  topic: string;
}

export const synthesizeFindingsSkill: Skill<SynthesizeFindingsInput, void> = {
  name: 'synthesize_findings',
  role: 'research',
  description: 'Synthesize all previously-stored research findings on a topic.',
  requiresApproval: true,

  async execute({ agent, task, input }) {
    const { topic } = input;
    const context = await agent.loadContext(topic);
    if (!context) {
      agent.emit('agent:research_complete', { taskId: task.id, summary: \`No existing research found for: \${topic}\` });
      return;
    }
    const synthesis = await agent.think(\`Synthesize all available research on: "\${topic}"\`, context);
    agent.emit('agent:research_complete', { taskId: task.id, summary: synthesis });
    const approved = await agent.proposeAction(task, \`Store synthesis for: \${topic}\`, { synthesis });
    if (approved) {
      agent.remember(\`Synthesis on "\${topic}":\\n\\n\${synthesis}\`, ['research', 'synthesis']);
    }
  },
};`;

export const proposeSkillSkill = createProposeSkillSkill({
  role: 'research',
  roleLabel: 'Research',
  pathPrefix: 'packages/agents/research/src/skills/proposed/',
  fewShotExample: FEW_SHOT_EXAMPLE,
  buildHandoffTask: (task, prompt) => buildDelegatedFreeformTask(task, 'github', prompt),
});
