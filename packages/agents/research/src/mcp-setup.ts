import type { MCPClient } from '@wireassist/core';
import { extractProductFromJsonLd } from './product-extraction';

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
}

interface BraveSearchResponse {
  web?: { results?: Array<{ title: string; url: string; description: string }> };
}

// A normal-browser User-Agent — most retailers actively serve their own
// crawler-facing structured data (JSON-LD Product/Offer, meant for Google's
// rich-snippet pricing) to anything that looks like a standard browser or
// search-engine bot; a missing/suspicious UA is one of the cheapest signals
// bot-detection uses to block a request outright, before it ever gets to
// harder fingerprinting. Keeping this a plain server-side fetch (no headless
// browser/JS execution) is deliberate — it's much closer to how a search
// engine's own crawler behaves, and retailers want that traffic let through.
const PRODUCT_FETCH_USER_AGENT = 'Mozilla/5.0 (compatible; WireAssistResearchBot/1.0)';
const PRODUCT_FETCH_TIMEOUT_MS = 10_000;

export function setupResearchMCP(mcp: MCPClient): void {
  mcp.register('brave_search', async (params) => {
    const query = params.query as string;
    // Brave's own API default and max are both 20 (Web Search API docs) —
    // this used to override that down to 5, which just meant every search
    // saw a quarter of what Brave would return by default.
    const count = (params.count as number | undefined) ?? 20;
    // Brave's `freshness` param: pd/pw/pm/py (past day/week/month/year) or a
    // custom "YYYY-MM-DDtoYYYY-MM-DD" range. Omitted by default — Brave falls
    // back to pure relevance ranking with no recency filter, which is exactly
    // why time-sensitive queries (e.g. "current pricing") can surface
    // multi-year-old comparison/aggregator pages that still rank well.
    const freshness = params.freshness as string | undefined;
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
    if (freshness) url.searchParams.set('freshness', freshness);

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

  mcp.register('fetch_product_price', async (params) => {
    const targetUrl = params.url as string | undefined;
    if (!targetUrl) {
      throw new Error('fetch_product_price requires a url parameter.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PRODUCT_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': PRODUCT_FETCH_USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          found: false,
          url: targetUrl,
          note: `Page returned ${response.status} ${response.statusText} — could not fetch.`,
        };
      }

      const html = await response.text();
      const product = extractProductFromJsonLd(html);

      if (!product?.price) {
        return {
          found: false,
          url: targetUrl,
          note:
            'No structured product price data (Schema.org JSON-LD) found on this page. The ' +
            'price may only exist in JS-rendered content this fetch cannot see, or this ' +
            "isn't a product page.",
        };
      }

      return { found: true, url: targetUrl, ...product };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return {
          found: false,
          url: targetUrl,
          note: `Request timed out after ${PRODUCT_FETCH_TIMEOUT_MS}ms.`,
        };
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  });
}
