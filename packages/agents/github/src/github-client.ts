import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  Client,
  StreamableHTTPClientTransport,
  type AuthProvider,
} from '@modelcontextprotocol/client';

const HOME_PATH = process.env.WIREASSIST_HOME ?? os.homedir();
const CREDENTIALS_PATH = path.join(HOME_PATH, '.wireassist', 'github-credentials.json');

// GitHub's official hosted remote MCP server — Streamable HTTP transport, no
// local process/Docker needed. `X-MCP-Toolsets` scopes the tool catalog down
// to what this agent could ever plausibly need; the real safety boundary is
// still tool-policy.ts's allowlist, enforced in code, not this header.
const GITHUB_MCP_URL = 'https://api.githubcopilot.com/mcp/';
const GITHUB_MCP_TOOLSETS = 'repos,issues,labels,pull_requests';

interface GitHubCredentials {
  personalAccessToken: string;
}

export interface RemoteToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

function loadCredentials(): GitHubCredentials {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      `GitHub credentials not found at ${CREDENTIALS_PATH}.\n` +
        `Create it with: { "personalAccessToken": "<fine-grained or classic PAT from ` +
        `GitHub Settings -> Developer settings -> Personal access tokens>" }`
    );
  }
  const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8')) as GitHubCredentials;
  if (!creds.personalAccessToken) {
    throw new Error(`GitHub credentials at ${CREDENTIALS_PATH} are missing "personalAccessToken".`);
  }
  return creds;
}

// The first real Model Context Protocol client in this codebase — every
// other integration (Gmail, WordPress, YouTube) is a hand-rolled REST client
// registered into WireAssist's own in-process MCPClient registry
// (wireassist/core/src/mcp/client.ts), which has no relation to the actual
// protocol. This connects to GitHub's genuine, vendor-maintained MCP server
// instead of hand-writing a GitHub REST client — the template future
// integrations (Slack, Notion, a local filesystem server) can follow.
export class GitHubMcpClient {
  private client: Client;
  private transport: StreamableHTTPClientTransport;

  constructor() {
    const creds = loadCredentials();
    const authProvider: AuthProvider = { token: async () => creds.personalAccessToken };
    this.transport = new StreamableHTTPClientTransport(new URL(GITHUB_MCP_URL), {
      authProvider,
      requestInit: { headers: { 'X-MCP-Toolsets': GITHUB_MCP_TOOLSETS } },
    });
    this.client = new Client({ name: 'wireassist-github-agent', version: '1.0.0' });
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

  // A failed tool call comes back as a normal result with isError: true, not
  // a thrown exception — re-throw here so it surfaces through
  // GitHubAgent.executeToolCall()'s existing catch the same way any other
  // tool failure does, instead of needing a second isError check downstream.
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const result = await this.client.callTool({ name, arguments: args });
    if (result.isError) {
      throw new Error(`GitHub tool "${name}" failed: ${JSON.stringify(result.content)}`);
    }
    return result.content;
  }

  async disconnect(): Promise<void> {
    await this.transport.terminateSession();
    await this.client.close();
  }
}
