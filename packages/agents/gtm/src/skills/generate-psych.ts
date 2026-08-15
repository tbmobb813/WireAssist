import type { Skill } from '@wireassist/core';
import { buildPsychPrompt } from '../prompts';
import type { GtmProductInput, GtmPsychPrinciple } from '../types';
import { extractJson } from './extract-json';

export interface GeneratePsychInput {
  product: GtmProductInput;
}

export const generatePsychSkill: Skill<GeneratePsychInput, void> = {
  name: 'generate_psych',
  role: 'gtm',
  description: 'Generate behavioral-psychology marketing tactics for a product.',

  async execute({ agent, task, input }) {
    const { product } = input;

    const raw = await agent.think(buildPsychPrompt(product));
    const psych = extractJson<GtmPsychPrinciple[]>(raw);

    agent.emit('agent:gtm_psych_generated', { taskId: task.id, psych });
    agent.remember(JSON.stringify({ product: product.name, psych }), [
      'gtm',
      'psych',
      product.name,
    ]);
  },
};
