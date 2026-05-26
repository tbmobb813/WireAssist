// FTS5 search implementation
import Database from 'better-sqlite3';
import type { Conversation, Message } from '../types';

export interface SearchResult {
  type: 'conversation' | 'message';
  item: Conversation | Message;
  rank: number;
  snippet?: string;
}

export class SearchEngine {
  private db: Database.Database;

  constructor(storagePath: string = './data/lai.db') {
    this.db = new Database(storagePath);
  }

  async searchAll(
    query: string,
    options?: {
      limit?: number;
      includeMessages?: boolean;
    }
  ): Promise<SearchResult[]> {
    const limit = options?.limit || 50;
    const results: SearchResult[] = [];

    // Search conversations
    const conversationRows = this.db
      .prepare(
        `SELECT c.*, rank FROM conversations c
         JOIN conversations_fts fts ON c.id = fts.id
         WHERE conversations_fts MATCH ?
         ORDER BY rank
         LIMIT ?`
      )
      .all(query, limit) as any[];

    for (const row of conversationRows) {
      results.push({
        type: 'conversation',
        item: {
          id: row.id,
          title: row.title,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          provider: row.provider,
          model: row.model,
          messages: [],
          metadata: JSON.parse(row.metadata || '{}'),
        },
        rank: row.rank,
      });
    }

    // Search messages if requested
    if (options?.includeMessages !== false) {
      const messageRows = this.db
        .prepare(
          `SELECT m.*, rank, snippet(messages_fts, 1, '<mark>', '</mark>', '...', 50) as snippet
           FROM messages m
           JOIN messages_fts fts ON m.id = fts.id
           WHERE messages_fts MATCH ?
           ORDER BY rank
           LIMIT ?`
        )
        .all(query, limit) as any[];

      for (const row of messageRows) {
        results.push({
          type: 'message',
          item: {
            id: row.id,
            conversationId: row.conversation_id,
            role: row.role,
            content: row.content,
            timestamp: row.timestamp,
            tokensUsed: row.tokens_used,
            context: row.context ? JSON.parse(row.context) : undefined,
          },
          rank: row.rank,
          snippet: row.snippet,
        });
      }
    }

    // Sort by rank
    results.sort((a, b) => a.rank - b.rank);

    return results.slice(0, limit);
  }

  close(): void {
    this.db.close();
  }
}

export function search(query: string, storagePath?: string): SearchResult[] {
  const engine = new SearchEngine(storagePath);
  const results = engine.searchAll(query);
  engine.close();
  return results as any;
}
