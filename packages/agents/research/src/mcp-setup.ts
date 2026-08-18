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
    // Brave's own API default and max are both 20 (Web Search API docs) —
    // this used to override that down to 5, which just meant every search
    // saw a quarter of what Brave would return by default.
    const count = (params.count as number | undefined) ?? 20;
    const apiKey = process.env.BRAVE_API_KEY;

    if (!apiKey) {
      throw new Error(
        'BRAVE_API_KEY is not set. Add it to .env (docker compose) or .env.local (local dev), ' +
          'then restart with `docker compose up -d command-center` — a plain `restart` will not ' +
          'pick up the change.'
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
