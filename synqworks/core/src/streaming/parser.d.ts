export interface SSEEvent {
    event?: string;
    data?: string;
    id?: string;
    retry?: number;
}
export declare function parseSSEChunk(chunk: string): string | null;
export declare function parseJSONChunk(chunk: string): string | null;
export declare function parseStreamLine(line: string, format: 'sse' | 'json' | 'text'): string | null;
export declare class StreamParser {
    private buffer;
    private format;
    constructor(format?: 'sse' | 'json' | 'text');
    parse(data: string): string[];
    flush(): string | null;
    reset(): void;
}
//# sourceMappingURL=parser.d.ts.map