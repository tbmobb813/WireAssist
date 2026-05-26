import type { Conversation, Message } from '../types';
export interface SearchResult {
    type: 'conversation' | 'message';
    item: Conversation | Message;
    rank: number;
    snippet?: string;
}
export declare class SearchEngine {
    private db;
    constructor(storagePath?: string);
    searchAll(query: string, options?: {
        limit?: number;
        includeMessages?: boolean;
    }): Promise<SearchResult[]>;
    close(): void;
}
export declare function search(query: string, storagePath?: string): SearchResult[];
//# sourceMappingURL=search.d.ts.map