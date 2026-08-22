export declare class MCPClient {
  private tools;
  register(name: string, handler: (params: Record<string, unknown>) => Promise<unknown>): void;
  call(name: string, params: Record<string, unknown>): Promise<unknown>;
  listTools(): string[];
}
//# sourceMappingURL=client.d.ts.map
