import {
  Client,
  StreamableHTTPClientTransport,
  type AuthProvider,
} from '@modelcontextprotocol/client';

// The generic real Model Context Protocol client — extracted from
// packages/agents/github/src/github-client.ts's GitHubMcpClient, the
// first (and until this existed, only) real MCP client in this codebase.
// That file's own comment already called itself "the template future
// integrations (Slack, Notion, a local filesystem server) can follow" —
// this is that template, made reusable instead of copy-pasted per
// service. GitHubMcpClient now constructs one of these internally with
// GitHub's URL/auth/headers; its own public API is unchanged.
//
// Distinct from MCPClient (./client.ts) — that's an in-process
// Map<name, handler> registry every hand-rolled integration (Gmail,
// WordPress, YouTube, etc.) registers into; it has no relation to the
// actual protocol. This connects to a real, vendor-run MCP server over
// Streamable HTTP.
export interface RemoteToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface RemoteMcpClientConfig {
  url: string;
  authProvider: AuthProvider;
  clientName: string;
  clientVersion?: string;
  // e.g. GitHub's `X-MCP-Toolsets` header, scoping the tool catalog
  // server-side. Optional — most remote MCP servers won't need this.
  extraHeaders?: Record<string, string>;
}

export class RemoteMcpClient {
  private client: Client;
  private transport: StreamableHTTPClientTransport;

  constructor(config: RemoteMcpClientConfig) {
    this.transport = new StreamableHTTPClientTransport(new URL(config.url), {
      authProvider: config.authProvider,
      requestInit: config.extraHeaders ? { headers: config.extraHeaders } : undefined,
    });
    this.client = new Client({
      name: config.clientName,
      version: config.clientVersion ?? '1.0.0',
    });
  }

  async connect(): Promise<void> {
    await this.client.connect(this.transport);
  }

  async listRemoteTools(): Promise<RemoteToolDefinition[]> {
    const { tools } = await this.client.listTools();
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description ?? '',
      inputSchema: (tool.inputSchema ?? { type: 'object', properties: {} }) as Record<
        string,
        unknown
      >,
    }));
  }

  // A failed tool call comes back as a normal result with isError: true,
  // not a thrown exception — re-throw here so it surfaces through a
  // caller's own try/catch the same way any other tool failure does,
  // instead of needing a second isError check downstream.
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const result = await this.client.callTool({ name, arguments: args });
    if (result.isError) {
      throw new Error(`MCP tool "${name}" failed: ${JSON.stringify(result.content)}`);
    }
    return result.content;
  }

  async disconnect(): Promise<void> {
    await this.transport.terminateSession();
    await this.client.close();
  }
}
