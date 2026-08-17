import type { MCPClient } from '@wireassist/core';
import { WordPressClient, type DraftPostInput, type UploadMediaInput } from './wordpress-client';

// Registered unconditionally at bootstrap, same as registerTrendPostTools —
// most workflows never call this tool, and credentials are only resolved
// (and can only fail) lazily, inside the handler, on the run that actually
// needs it.
export function registerWordPressTools(mcp: MCPClient): void {
  mcp.register('wordpress_publish_draft', async (params) => {
    const client = new WordPressClient();
    return client.createDraftPost(params as unknown as DraftPostInput);
  });

  mcp.register('wordpress_upload_media', async (params) => {
    const client = new WordPressClient();
    const { imageBase64, mimeType, filename, altText } = params as {
      imageBase64: string;
      mimeType: string;
      filename: string;
      altText?: string;
    };
    return client.uploadMedia({
      imageBuffer: Buffer.from(imageBase64, 'base64'),
      mimeType,
      filename,
      altText,
    } as UploadMediaInput);
  });

  mcp.register('wordpress_list_posts', async (params) => {
    const client = new WordPressClient();
    const { limit } = params as { limit?: number };
    return client.listRecentPosts(limit);
  });
}
