import type { Skill } from '@wireassist/core';
import { ContentTasks } from '@wireassist/agent-content';
import type { Platform } from '@wireassist/trendpost-mcp';

interface BraveResult {
  title: string;
  url: string;
  description: string;
}

export interface ResearchTopicInput {
  query: string;
  resultCount?: number;
  offerContentDraft?: { platform: Platform; tone?: string };
}

export const researchTopicSkill: Skill<ResearchTopicInput, void> = {
  name: 'research_topic',
  role: 'research',
  description: 'Search the web for a topic and synthesize findings.',
  requiresApproval: true,

  async execute({ agent, task, input }) {
    const { query, resultCount = 5, offerContentDraft } = input;

    const context = await agent.loadContext(query);

    const searchResult = (await agent.useTool('brave_search', { query, count: resultCount })) as {
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

    const summary = await agent.think(
      `Research query: "${query}"\n\nSearch results:\n${resultsText}\n\n` +
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
      const draftApproved = await agent.proposeAction(
        task,
        `Draft ${platform} content from this research on "${query}"?`,
        { query, platform, tone }
      );
      if (draftApproved) {
        const handoffTask = ContentTasks.generatePost(query, platform, tone, summary);
        agent.emit('agent:handoff_requested', { task: handoffTask });
      }
    }
  },
};
