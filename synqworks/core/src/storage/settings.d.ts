export declare class SettingsStore {
    private db;
    constructor(storagePath?: string);
    private initTables;
    get<T = any>(key: string, defaultValue?: T): Promise<T | undefined>;
    set(key: string, value: any): Promise<void>;
    delete(key: string): Promise<void>;
    getAll(): Promise<Record<string, any>>;
    clear(): Promise<void>;
    close(): void;
}
//# sourceMappingURL=settings.d.ts.map