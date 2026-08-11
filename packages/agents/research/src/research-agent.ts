import { BaseAgent } from '@wireassist/agent-admin';
import type {
  AgentConfig,
  AgentTask,
  IApprovalQueue,
  MemoryStore,
  MCPClient,
  EventBus,
} from '@wireassist/core';

const SYSTEM_PROMPT = `You are a Research Agent for WireAssist. Your job is to find, synthesize, and present information clearly and accurately — and to be honest about how solid the findings actually are.

Principles:
- Every claim in your summary must trace back to a specific source you were given —
  never state something as fact because it "sounds right" or matches general knowledge.
  If a source doesn't actually support a claim, don't make the claim.
- Flag disagreement explicitly. If two sources conflict on a factual point, say so by
  name ("Source A says X, Source B says Y") — don't quietly pick one and present it as
  settled.
- Distinguish single-source claims from corroborated ones. A claim backed by one page is
  weaker than one multiple independent sources agree on — say which is which when it
  matters to the conclusion.
- If the search results are thin, outdated, or don't actually answer the query, say that
  plainly instead of stretching them into a confident-sounding summary. "I couldn't find
  reliable information on X" is a valid and useful finding.
- Be direct — no filler, no padding.
- Structure findings as: Key Takeaways → Details → Sources, and always cite source URLs.`;

const DEFAULT_CONFIG: AgentConfig = {
  role: 'research',
  name: 'Research Agent',
  systemPrompt: SYSTEM_PROMPT,
  tools: ['brave_search'],
  maxTokens: 2048,
};

interface BraveResult {
  title: string;
  url: string;
  description: string;
}

export class ResearchAgent extends BaseAgent {
  constructor(deps: {
    approval: IApprovalQueue;
    memory: MemoryStore;
    mcp: MCPClient;
    events: EventBus;
  }) {
    super(DEFAULT_CONFIG, deps);
  }

  async run(task: AgentTask): Promise<void> {
    if (this.status === 'running') return;
    this.status = 'running';
    this.events.emit('agent:task_started', {
      agentRole: this.role,
      taskId: task.id,
      description: task.description,
    });

    try {
      switch (task.input.type as string) {
        case 'research_topic':
          await this.handleResearchTopic(task);
          break;
        case 'synthesize_findings':
          await this.handleSynthesize(task);
          break;
        default:
          await this.handleResearchTopic(task);
      }
      this.status = 'idle';
      this.events.emit('agent:task_complete', { agentRole: this.role, taskId: task.id });
    } catch (error) {
      this.status = 'error';
      this.events.emit('agent:task_failed', {
        agentRole: this.role,
        taskId: task.id,
        error: String(error),
      });
      throw error;
    }
  }

  private async handleResearchTopic(task: AgentTask): Promise<void> {
    const { query, resultCount = 5 } = task.input as { query: string; resultCount?: number };

    const context = await this.loadContext(query);

    const searchResult = (await this.useTool('brave_search', { query, count: resultCount })) as {
      results: BraveResult[];
    };
    const { results } = searchResult;

    if (results.length === 0) {
      this.events.emit('agent:research_complete', {
        agentRole: this.role,
        taskId: task.id,
        summary: 'No results found.',
      });
      return;
    }

    const resultsText = results
      .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.description}`)
      .join('\n\n');

    const summary = await this.think(
      `Research query: "${query}"\n\nSearch results:\n${resultsText}\n\n` +
        `Only ${results.length} result(s) were returned — weigh confidence accordingly. ` +
        `Note any disagreement between these sources, and flag it plainly if none of them ` +
        `actually answer the query.`,
      context ? `Existing context from memory:\n${context}` : undefined
    );

    this.events.emit('agent:research_complete', {
      agentRole: this.role,
      taskId: task.id,
      summary,
      sources: results.map((r) => r.url),
    });

    const approved = await this.proposeAction(task, `Store research findings for: ${query}`, {
      summary,
      sources: results.map((r) => r.url),
    });
    if (approved) {
      this.remember(`Research on "${query}":\n\n${summary}`, [
        'research',
        'findings',
        ...query.toLowerCase().split(' ').slice(0, 3),
      ]);
    }
  }

  private async handleSynthesize(task: AgentTask): Promise<void> {
    const { topic } = task.input as { topic: string };

    const context = await this.loadContext(topic);
    if (!context) {
      this.events.emit('agent:research_complete', {
        agentRole: this.role,
        taskId: task.id,
        summary: `No existing research found for: ${topic}`,
      });
      return;
    }

    const synthesis = await this.think(
      `Synthesize all available research on the topic: "${topic}"`,
      `Memory context:\n${context}`
    );

    this.events.emit('agent:research_complete', {
      agentRole: this.role,
      taskId: task.id,
      summary: synthesis,
    });

    const approved = await this.proposeAction(task, `Store synthesis for: ${topic}`, { synthesis });
    if (approved) {
      this.remember(`Synthesis on "${topic}":\n\n${synthesis}`, ['research', 'synthesis']);
    }
  }
}
