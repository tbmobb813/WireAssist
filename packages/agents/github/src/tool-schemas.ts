import type { ProviderToolDefinition } from '@wireassist/core';
import type { RemoteToolDefinition } from './github-client';

// Unlike every other agent's hand-written tool-schemas.ts, GitHub's tool
// catalog is fetched live from the real MCP server at connect time
// (github-client.ts's listRemoteTools()) rather than authored by hand — this
// is just a shape passthrough (MCP's {name, description, inputSchema} and
// WireAssist's ProviderToolDefinition are the same three fields) filtered
// down to whatever tool-policy.ts's allowlist actually authorized.
export function buildGithubToolSchemas(
  authorizedTools: RemoteToolDefinition[]
): Record<string, ProviderToolDefinition> {
  return Object.fromEntries(
    authorizedTools.map((tool) => [
      tool.name,
      { name: tool.name, description: tool.description, inputSchema: tool.inputSchema },
    ])
  );
}
