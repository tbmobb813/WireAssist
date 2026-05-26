export class MCPClient {
  private tools: Map<string, (params: Record<string, unknown>) => Promise<unknown>> = new Map();

  register(name: string, handler: (params: Record<string, unknown>) => Promise<unknown>): void {
    this.tools.set(name, handler);
  }

  async call(name: string, params: Record<string, unknown>): Promise<unknown> {
    const handler = this.tools.get(name);
    if (!handler) {
      throw new Error(`MCP tool not registered: ${name}`);
    }
    return handler(params);
  }

  listTools(): string[] {
    return Array.from(this.tools.keys());
  }
}
