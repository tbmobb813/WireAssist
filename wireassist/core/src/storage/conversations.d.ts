import type { Conversation } from '../types';
export declare class ConversationStore {
  private db;
  constructor(storagePath?: string);
  private initTables;
  create(data: {
    title: string;
    provider: string;
    model: string;
    metadata?: Record<string, any>;
  }): Promise<string>;
  get(id: string): Promise<Conversation>;
  update(
    id: string,
    data: Partial<{
      title: string;
      metadata: Record<string, any>;
    }>
  ): Promise<void>;
  delete(id: string): Promise<void>;
  list(options?: { limit?: number; offset?: number }): Promise<Conversation[]>;
  search(query: string): Promise<Conversation[]>;
  close(): void;
}
//# sourceMappingURL=conversations.d.ts.map
