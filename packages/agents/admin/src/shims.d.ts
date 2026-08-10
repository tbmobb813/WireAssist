declare module 'readline';
declare module 'crypto';

declare module '@anthropic-ai/sdk' {
  export interface TextBlock {
    type: 'text';
    text: string;
  }

  export default class Anthropic {
    messages: {
      // Minimal surface used by BaseAgent.think
      create(args: {
        model: string;
        max_tokens: number;
        system: string;
        messages: { role: 'user'; content: string }[];
      }): Promise<{
        content: TextBlock[];
        usage?: { input_tokens: number; output_tokens: number };
      }>;
    };
  }
}

// Minimal Node globals needed for the demo.
// These are intentionally very loose types.
declare const process: {
  exitCode?: number;
};
