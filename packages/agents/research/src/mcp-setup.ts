import type { MCPClient } from '@wireassist/core';

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
}

interface BraveSearchResponse {
  web?: { results?: Array<{ title: string; url: string; description: string }> };
}

export function setupResearchMCP(mcp: MCPClient): void {
  mcp.register('brave_search', async (params) => {
    const query = params.query as string;
    const count = (params.count as number | undefined) ?? 5;
    const apiKey = process.env.BRAVE_API_KEY;

    if (!apiKey) {
      throw new Error(
        'BRAVE_API_KEY is not set. Add it to .env.local to enable the Research Agent.'
      );
    }

    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', String(count));

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as BraveSearchResponse;
    const results: BraveSearchResult[] = (data.web?.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      description: r.description,
    }));

    return { results, query };
  });
}
