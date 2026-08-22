import type { MCPClient } from '@wireassist/core';
import { searchVideos } from './youtube-client';

export function registerYouTubeTools(mcp: MCPClient): void {
  mcp.register('youtube_search_videos', async (params) => {
    const { query, maxResults } = params as { query: string; maxResults?: number };
    return searchVideos(query, maxResults);
  });
}
