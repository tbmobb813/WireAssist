import type { Skill, SkillChain } from '@wireassist/core';
import { researchTopicSkill } from './research-topic';
import { synthesizeFindingsSkill } from './synthesize-findings';
import { freeformSkill } from './freeform';

export const RESEARCH_SKILLS: Skill[] = [
  researchTopicSkill,
  synthesizeFindingsSkill,
  freeformSkill,
];

// Same-agent SkillChain example: research a topic, then synthesize it
// together with whatever else is already in memory on that topic. Chains
// are scoped to one agent role (unlike the Research -> Content handoff,
// which spans two different agent instances and goes through the
// agent:handoff_requested event instead — see research-topic.ts).
export const RESEARCH_AND_SYNTHESIZE_CHAIN: SkillChain = {
  name: 'research_and_synthesize',
  role: 'research',
  description: 'Research a topic, then synthesize it together with any prior findings.',
  steps: [
    { skill: 'research_topic' },
    {
      skill: 'synthesize_findings',
      mapInput: (_previousOutput, task) => ({
        topic: (task.input as { query?: string }).query,
      }),
    },
  ],
};
