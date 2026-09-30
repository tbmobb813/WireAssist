import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { RemoteMcpClient, type AuthProvider, type RemoteToolDefinition } from '@wireassist/core';

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

export type { RemoteToolDefinition };

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

// Was the first real Model Context Protocol client in this codebase —
// every other integration (Gmail, WordPress, YouTube) is a hand-rolled
// REST client registered into WireAssist's own in-process MCPClient
// registry (wireassist/core/src/mcp/client.ts), which has no relation to
// the actual protocol. Now a thin GitHub-specific wrapper (URL, PAT-based
// auth, the toolsets header) around the generic RemoteMcpClient
// (wireassist/core/src/mcp/remote-client.ts), extracted from this class's
// original implementation so future integrations (Slack, Notion, a local
// filesystem server) construct one instead of copy-pasting this file.
// Public API unchanged — callers (github-agent.ts, server.ts) don't
// need to know this delegates internally.
export class GitHubMcpClient {
  private remote: RemoteMcpClient;

  constructor() {
    const creds = loadCredentials();
    const authProvider: AuthProvider = { token: async () => creds.personalAccessToken };
    this.remote = new RemoteMcpClient({
      url: GITHUB_MCP_URL,
      authProvider,
      clientName: 'wireassist-github-agent',
      extraHeaders: { 'X-MCP-Toolsets': GITHUB_MCP_TOOLSETS },
    });
  }

  async connect(): Promise<void> {
    await this.remote.connect();
  }

  async listRemoteTools(): Promise<RemoteToolDefinition[]> {
    return this.remote.listRemoteTools();
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    try {
      return await this.remote.callTool(name, args);
    } catch (err) {
      // Re-labeled from RemoteMcpClient's generic "MCP tool" phrasing to
      // GitHub-specific wording — callers/logs here have always said
      // "GitHub tool", and that's worth keeping rather than a silent
      // message change as a side effect of this refactor.
      if (err instanceof Error) {
        throw new Error(err.message.replace(/^MCP tool /, 'GitHub tool '));
      }
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    await this.remote.disconnect();
  }
}
