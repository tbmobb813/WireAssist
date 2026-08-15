import type { Skill } from '@wireassist/core';
import { buildGtmPrompt } from '../prompts';
import type { GtmProductInput, GtmStrategy } from '../types';
import { extractJson } from './extract-json';

export interface GenerateStrategyInput {
  product: GtmProductInput;
}

export const generateStrategySkill: Skill<GenerateStrategyInput, void> = {
  name: 'generate_gtm',
  role: 'gtm',
  description: 'Generate a concrete go-to-market strategy for a product.',

  async execute({ agent, task, input }) {
    const { product } = input;

    const raw = await agent.think(buildGtmPrompt(product));
    const gtm = extractJson<GtmStrategy>(raw);

    agent.emit('agent:gtm_generated', { taskId: task.id, gtm });
    agent.remember(JSON.stringify({ product: product.name, gtm }), [
      'gtm',
      'strategy',
      product.name,
    ]);
  },
};
