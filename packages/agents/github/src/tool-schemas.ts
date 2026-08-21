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

// The one hand-written schema in this otherwise-dynamic file — propose_skill
// isn't a real GitHub tool the live MCP server advertises, it's a
// WireAssist skill (see skills/propose-skill.ts), dispatched via
// invokeSkill() rather than the real githubClient.callTool() path (see
// GitHubAgent.executeToolCall()).
export const PROPOSE_SKILL_SCHEMA: ProviderToolDefinition = {
  name: 'propose_skill_skill',
  description:
    'Draft a brand-new GitHub Dev skill (real TypeScript) for a capability the user describes, and — once they approve the drafted code — open it as a draft PR yourself for review. The drafted code is never wired into the running system by this tool; that stays a separate, manual step after the PR is reviewed and merged. Use this when the user is asking you to build yourself a new capability, not asking you to just do something with your existing tools.',
  inputSchema: {
    type: 'object',
    properties: {
      request: {
        type: 'string',
        description: "The capability being requested, in the user's own words.",
      },
    },
    required: ['request'],
  },
};

// Skill-tool names dispatched via invokeSkill() rather than the real
// githubClient.callTool() path — see GitHubAgent.executeToolCall(). Kept
// separate from GITHUB_TOOL_ALLOWLIST (tool-policy.ts) since this is never a
// valid real-GitHub-tool call.
export const GITHUB_SKILL_TOOLS = new Set<string>(['propose_skill_skill']);
