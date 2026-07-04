import { BaseAgent } from '@wireassist/agent-admin';
import type {
  AgentConfig,
  AgentTask,
  IApprovalQueue,
  MemoryStore,
  MCPClient,
  EventBus,
} from '@wireassist/core';

const SYSTEM_PROMPT = `You are a Research Agent for WireAssist. Your job is to find, synthesize, and present information clearly and accurately.

Principles:
- Summarize search results into concise, actionable findings
- Always cite source URLs in your summaries
- Flag when information is uncertain or conflicting
- Be direct — no filler, no padding
- Structure findings as: Key Takeaways → Details → Sources`;

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
      `Research query: "${query}"\n\nSearch results:\n${resultsText}`,
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
