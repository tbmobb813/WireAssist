"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchEngine = void 0;
exports.search = search;
// FTS5 search implementation
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
class SearchEngine {
    constructor(storagePath = './data/lai.db') {
        Object.defineProperty(this, "db", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.db = new better_sqlite3_1.default(storagePath);
    }
    async searchAll(query, options) {
        const limit = options?.limit || 50;
        const results = [];
        // Search conversations
        const conversationRows = this.db
            .prepare(`SELECT c.*, rank FROM conversations c
         JOIN conversations_fts fts ON c.id = fts.id
         WHERE conversations_fts MATCH ?
         ORDER BY rank
         LIMIT ?`)
            .all(query, limit);
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
                .prepare(`SELECT m.*, rank, snippet(messages_fts, 1, '<mark>', '</mark>', '...', 50) as snippet
           FROM messages m
           JOIN messages_fts fts ON m.id = fts.id
           WHERE messages_fts MATCH ?
           ORDER BY rank
           LIMIT ?`)
                .all(query, limit);
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
    close() {
        this.db.close();
    }
}
exports.SearchEngine = SearchEngine;
function search(query, storagePath) {
    const engine = new SearchEngine(storagePath);
    const results = engine.searchAll(query);
    engine.close();
    return results;
}
