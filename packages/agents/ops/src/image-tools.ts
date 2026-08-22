import type { MCPClient } from '@wireassist/core';
import { generateImage } from './image-client';

export function registerImageTools(mcp: MCPClient): void {
  mcp.register('image_generate', async (params) => {
    const { prompt } = params as { prompt: string };
    const { buffer, mimeType } = await generateImage(prompt);
    return { imageBase64: buffer.toString('base64'), mimeType };
  });
}
