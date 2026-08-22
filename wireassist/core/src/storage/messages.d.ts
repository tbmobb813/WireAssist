import type { Message } from '../types';
export declare class MessageStore {
  private db;
  constructor(storagePath?: string);
  private initTables;
  create(data: {
    conversationId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    tokensUsed?: number;
    context?: any;
  }): Promise<string>;
  get(id: string): Promise<Message>;
  getByConversation(conversationId: string): Promise<Message[]>;
  delete(id: string): Promise<void>;
  deleteByConversation(conversationId: string): Promise<void>;
  search(query: string, conversationId?: string): Promise<Message[]>;
  close(): void;
}
//# sourceMappingURL=messages.d.ts.map
