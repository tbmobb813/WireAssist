import type { AIRequest, AuditLogOptions } from '../types';
export declare class AuditLogger {
  private db;
  constructor(storagePath?: string);
  private initTables;
  log(request: AIRequest): Promise<void>;
  query(options?: AuditLogOptions): Promise<AIRequest[]>;
  clear(beforeDate?: number): Promise<void>;
  getStats(): Promise<{
    totalRequests: number;
    totalTokens: number;
    byProvider: Record<string, number>;
  }>;
  close(): void;
}
//# sourceMappingURL=audit.d.ts.map
