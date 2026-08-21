import { createProposeSkillSkill } from '@wireassist/core';
import { buildDelegatedFreeformTask } from '../delegate';

// One real existing skill, shown as a few-shot example of the exact shape
// the drafted code must follow — small and self-contained, no chain
// complexity. Kept as a literal string (not an import) so the example in
// the prompt can never silently drift from what's actually being requested
// here, and so this file has zero runtime dependency on that skill's
// internals.
const FEW_SHOT_EXAMPLE = `import type { Skill } from '@wireassist/core';

export interface FollowUpNudgesInput {
  daysStale?: number;
}

export const followUpNudgesSkill: Skill<FollowUpNudgesInput, void> = {
  name: 'follow_up_nudges',
  role: 'admin',
  description: 'Find sent threads where nobody has replied in N days, and propose a follow-up nudge for each.',

  async execute({ agent, task, input }) {
    const daysStale = input.daysStale ?? 3;
    // ... read data via agent.useTool(...), reason about it via agent.think(...) ...
    const approved = await agent.proposeAction(task, 'Follow-up nudge: ...', { threadId: 'x', body: 'drafted text' });
    if (approved) {
      await agent.useTool('gmail_create_draft', { threadId: 'x', body: 'drafted text' });
    }
  },
};`;

export const proposeSkillSkill = createProposeSkillSkill({
  role: 'admin',
  roleLabel: 'Admin',
  pathPrefix: 'packages/agents/admin/src/skills/proposed/',
  fewShotExample: FEW_SHOT_EXAMPLE,
  buildHandoffTask: (task, prompt) => buildDelegatedFreeformTask(task, 'github', prompt),
});
