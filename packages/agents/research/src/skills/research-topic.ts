import type { AgentTask, Skill } from '@wireassist/core';
import { ContentTasks } from '@wireassist/agent-content';
import { OpsTasks } from '@wireassist/agent-ops';
import type { Platform } from '@wireassist/trendpost-mcp';

interface BraveResult {
  title: string;
  url: string;
  description: string;
}

interface FetchedProduct {
  found: boolean;
  url: string;
  title?: string;
  price?: string;
  currency?: string;
  availability?: string;
  note?: string;
}

// Deterministic, not model-judgment-dependent — this skill runs directly
// off task.input.type (SkillExecutor, see BaseAgent.run()) whenever it's
// reached via dispatch_research_topic, which never goes through Research's
// own runToolLoop/SYSTEM_PROMPT at all (that only runs for the 'freeform'
// skill). The system-prompt instruction telling the model to "follow up
// yourself with fetch_product_price" is therefore dead code on this path —
// agent.think() below is a single non-agentic completion with no tool
// access, so a model narrating "fetching now, fetch_product_price(...)" in
// its synthesis text is the *only* thing that instruction could ever
// produce here, never a real call. Confirmed live 2026-09-05: exactly that
// happened on a real "current price of a 9800X3D" query. Fixed by having
// the skill itself detect and fetch, unconditionally, rather than relying
// on a model to act on an instruction it structurally cannot act on here.
const PRICE_QUERY_PATTERN = /\bprice\b|\bcost\b|how much (is|does|would|will)|\$\d/i;
const RETAILER_HOSTS = [
  'amazon.com',
  'newegg.com',
  'bestbuy.com',
  'walmart.com',
  'target.com',
  'bhphotovideo.com',
  'microcenter.com',
];

function isLivePriceQuery(query: string): boolean {
  return PRICE_QUERY_PATTERN.test(query);
}

// First search result on a known retailer domain — the search ranking's
// own relevance ordering is trusted here rather than re-scoring results,
// same as the model would eyeball "the first Amazon-looking result."
function findRetailerUrl(results: BraveResult[]): string | undefined {
  for (const r of results) {
    try {
      const host = new URL(r.url).hostname.replace(/^www\./, '');
      if (RETAILER_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
        return r.url;
      }
    } catch {
      // Malformed URL from search results — skip rather than throw.
    }
  }
  return undefined;
}

function describeLivePriceResult(product: FetchedProduct): string {
  if (!product.found) {
    return (
      `Live price check attempted on ${product.url} but failed: ` +
      `${product.note ?? 'no structured price data found'}. Fall back to snippet-based ` +
      `estimates below, clearly labeled as not confirmed live — do not state a snippet price ` +
      `as current.`
    );
  }
  const priceText = product.price
    ? `${product.currency ? `${product.currency} ` : ''}${product.price}`
    : 'no price found on the page';
  return (
    `Live price check on ${product.url}: ${product.title ?? 'product'} — ${priceText}` +
    (product.availability ? ` (availability: ${product.availability})` : '') +
    `. This is the actual current price — prefer it over any snippet-based estimate below.`
  );
}

export interface ResearchTopicInput {
  query: string;
  resultCount?: number;
  // Brave freshness filter: pd/pw/pm/py or "YYYY-MM-DDtoYYYY-MM-DD". Left
  // undefined by default (pure relevance ranking) — the model should set
  // this whenever the query is clearly time-sensitive (pricing, "current",
  // "latest", recent news), since old comparison/aggregator pages otherwise
  // rank well despite being stale.
  freshness?: string;
  offerContentDraft?: { platform: Platform; tone?: string };
  offerOpsHandoff?: { workflow: string };
}

export const researchTopicSkill: Skill<ResearchTopicInput, void> = {
  name: 'research_topic',
  role: 'research',
  description: 'Search the web for a topic and synthesize findings.',
  requiresApproval: true,

  async execute({ agent, task, input }) {
    // Brave's own API default and max are both 20 (Web Search API docs).
    const { query, resultCount = 20, freshness, offerContentDraft, offerOpsHandoff } = input;

    const context = await agent.loadContext(query);

    const searchResult = (await agent.useTool('brave_search', {
      query,
      count: resultCount,
      ...(freshness ? { freshness } : {}),
    })) as {
      results: BraveResult[];
    };
    const { results } = searchResult;

    if (results.length === 0) {
      agent.emit('agent:research_complete', {
        agentRole: task.agentRole,
        taskId: task.id,
        summary: 'No results found.',
      });
      return;
    }

    const resultsText = results
      .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.description}`)
      .join('\n\n');

    let livePriceContext: string | undefined;
    if (isLivePriceQuery(query)) {
      const candidateUrl = findRetailerUrl(results);
      if (candidateUrl) {
        const product = (await agent.useTool('fetch_product_price', {
          url: candidateUrl,
        })) as FetchedProduct;
        livePriceContext = describeLivePriceResult(product);
      }
    }

    const summary = await agent.think(
      `Research query: "${query}"\n\nSearch results:\n${resultsText}\n\n` +
        (livePriceContext ? `${livePriceContext}\n\n` : '') +
        `Only ${results.length} result(s) were returned — weigh confidence accordingly. ` +
        `Note any disagreement between these sources, and flag it plainly if none of them ` +
        `actually answer the query.`,
      context ? `Existing context from memory:\n${context}` : undefined
    );

    agent.emit('agent:research_complete', {
      agentRole: task.agentRole,
      taskId: task.id,
      summary,
      sources: results.map((r) => r.url),
    });

    const approved = await agent.proposeAction(task, `Store research findings for: ${query}`, {
      summary,
      sources: results.map((r) => r.url),
    });
    if (approved) {
      agent.remember(`Research on "${query}":\n\n${summary}`, [
        'research',
        'findings',
        ...query.toLowerCase().split(' ').slice(0, 3),
      ]);
    }

    // Optional, independent second approval: hand these findings straight
    // to a Content task instead of requiring the manual sessionStorage
    // click-through (content-handoff.ts). Still gated — the handoff itself
    // requires approval here, and the resulting Content task goes through
    // its own approval before anything is ever posted.
    if (offerContentDraft) {
      const { platform, tone } = offerContentDraft;
      // Built now, before the approval wait, and handed to proposeAction as
      // resumeTask — so it's captured in the approval row itself and can be
      // replayed on restart even if this continuation never gets to run
      // agent.emit() below. See ApprovalRequest.resumeTask.
      const handoffTask: AgentTask = ContentTasks.generatePost(
        query,
        platform,
        tone,
        summary,
        task.objectiveId
      );
      // Pilot: Research reviews Content's output cold once it's produced —
      // see review-handoff-output.ts and server.ts's content_generated
      // listener. attempt starts at 0; server.ts bumps it on a retry.
      handoffTask.input = {
        ...handoffTask.input,
        reviewContext: {
          requestedBy: 'research',
          originalTaskId: task.id,
          query,
          researchSummary: summary,
          tone,
          attempt: 0,
        },
      };
      const draftApproved = await agent.proposeAction(
        task,
        `Draft ${platform} content from this research on "${query}"?`,
        { query, platform, tone },
        handoffTask
      );
      if (draftApproved) {
        agent.emit('agent:handoff_requested', { task: handoffTask, taskId: task.id });
      }
    }

    // Same shape as the Content handoff above, pointed at NixOps instead —
    // still gated behind its own approval here, and the resulting workflow
    // run goes through run-workflow.ts's own delivery approval before
    // anything is ever "done."
    if (offerOpsHandoff) {
      const { workflow } = offerOpsHandoff;
      // Same reasoning as the content handoff above — built before the
      // approval wait so it survives as resumeTask even if this
      // continuation never resumes.
      const handoffTask: AgentTask = OpsTasks.createWorkflowRunTask({
        workflow,
        brief:
          `Use this research to identify every distinct, sellable, specific product concept ` +
          `(not vague categories) it points to, and write one numbered product entry per ` +
          `concept so this run can batch-generate a listing for each. If only one clear ` +
          `candidate emerges, that's fine — one numbered entry is still valid. Do not ask a ` +
          `follow-up question about WHICH product to pick; this is a one-shot handoff with no ` +
          `way to hear a reply, so pick the strongest candidates yourself and proceed. This ` +
          `does not excuse a genuinely missing shop setting (variant naming, cost sheet, etc.) ` +
          `— if the workflow's own rules say to block on one of those, still block; don't ` +
          `invent a value for it just because this is a one-shot handoff.` +
          `\n\nRESEARCH ON "${query}":\n${summary}`,
        description: `NixOps run from research: ${query}`,
        objectiveId: task.objectiveId,
      });
      const handoffApproved = await agent.proposeAction(
        task,
        `Turn this research into a "${workflow}" NixOps run?`,
        { query, workflow },
        handoffTask
      );
      if (handoffApproved) {
        agent.emit('agent:handoff_requested', { task: handoffTask, taskId: task.id });
      }
    }
  },
};
