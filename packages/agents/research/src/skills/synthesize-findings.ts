import type { Skill } from '@wireassist/core';

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
      agent.emit('agent:research_complete', {
        agentRole: task.agentRole,
        taskId: task.id,
        summary: `No existing research found for: ${topic}`,
      });
      return;
    }

    const synthesis = await agent.think(
      `Synthesize all available research on the topic: "${topic}"`,
      `Memory context:\n${context}`
    );

    agent.emit('agent:research_complete', {
      agentRole: task.agentRole,
      taskId: task.id,
      summary: synthesis,
    });

    const approved = await agent.proposeAction(task, `Store synthesis for: ${topic}`, {
      synthesis,
    });
    if (approved) {
      agent.remember(`Synthesis on "${topic}":\n\n${synthesis}`, ['research', 'synthesis']);
    }
  },
};
