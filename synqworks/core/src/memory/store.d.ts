import type { AgentRole } from '../agents/types';
export interface MemoryEntry {
    id: string;
    content: string;
    agentRole: AgentRole;
    tags: string[];
    createdAt: Date;
}
export declare class MemoryStore {
    private db;
    constructor(dbPath: string);
    private init;
    store(entry: Omit<MemoryEntry, 'id'>): string;
    search(query: string, filters?: {
        agentRole?: AgentRole;
    }): MemoryEntry[];
}
//# sourceMappingURL=store.d.ts.map