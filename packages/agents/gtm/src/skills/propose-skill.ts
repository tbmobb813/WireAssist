import { createProposeSkillSkill } from '@wireassist/core';
import { buildDelegatedFreeformTask } from '@wireassist/agent-admin';

// GTM's real skills (generate_gtm, generate_psych) import shared prompt
// builders and JSON-extraction helpers that wouldn't resolve as a
// standalone literal string, so this is a simplified, self-contained
// example in the same spirit — generates strategy output via think(), no
// approval gate (note below, since not every skill needs one — GTM never
// takes a real-world action, see its system prompt).
const FEW_SHOT_EXAMPLE = `import type { Skill } from '@wireassist/core';

export interface CompetitorScanInput {
  productName: string;
  competitors: string[];
}

export const competitorScanSkill: Skill<CompetitorScanInput, void> = {
  name: 'competitor_scan',
  role: 'gtm',
  description: 'Compare a product against named competitors on positioning and pricing.',
  // No proposeAction() here — this only generates strategy text, it never
  // takes a real-world action, so there is nothing to gate.

  async execute({ agent, task, input }) {
    const { productName, competitors } = input;
    const analysis = await agent.think(
      \`Compare "\${productName}" against these competitors on positioning and pricing: \${competitors.join(', ')}. Return a short, specific comparison — no generic advice.\`
    );
    agent.emit('agent:gtm_competitor_scan_complete', { taskId: task.id, analysis });
  },
};`;

export const proposeSkillSkill = createProposeSkillSkill({
  role: 'gtm',
  roleLabel: 'GTM',
  pathPrefix: 'packages/agents/gtm/src/skills/proposed/',
  fewShotExample: FEW_SHOT_EXAMPLE,
  buildHandoffTask: (task, prompt) => buildDelegatedFreeformTask(task, 'github', prompt),
});
