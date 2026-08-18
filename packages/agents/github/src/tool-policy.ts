import type { RemoteToolDefinition } from './github-client';

// The actual safety boundary — a hardcoded allowlist independent of
// whatever GitHub's MCP server advertises. This must never grow silently
// just because GitHub adds a new tool to the "issues"/"pull_requests"
// toolsets later; widening scope here is a deliberate decision, not a side
// effect of an upstream catalog change.
//
// Deliberately excluded regardless of what the server offers: merge_pull_request,
// close_pull_request, close_issue (or any state-closing update_issue),
// delete_file, delete_branch, push_files, create_branch, any org/repo-admin
// or collaborator/team management tool, any secret/Actions-write tool, and
// create_or_update_file (deferred — "never push code" makes this one
// ambiguous enough to leave out of v1 entirely).
export const READ_ONLY_GITHUB_TOOLS = new Set([
  'get_issue',
  'list_issues',
  'search_issues',
  'get_issue_comments',
  'get_pull_request',
  'list_pull_requests',
  'search_pull_requests',
  'get_pull_request_diff',
  'get_pull_request_files',
  'get_pull_request_status',
  'get_pull_request_reviews',
  'get_pull_request_comments',
  'get_file_contents',
  'search_code',
  'list_branches',
  'list_commits',
  'get_commit',
  'list_labels',
  'search_repositories',
  'get_repository',
]);

// Write tools — in the allowlist, but every call still goes through
// BaseAgent.proposeAction() (the approval queue) before executing.
const WRITE_GITHUB_TOOLS = new Set([
  'add_issue_comment',
  'add_labels_to_issue',
  'remove_labels_from_issue',
  'add_pull_request_review_comment',
  'create_pull_request_review',
  'create_pull_request', // draft:true is enforced in code — see github-agent.ts
]);

export const GITHUB_TOOL_ALLOWLIST = new Set([...READ_ONLY_GITHUB_TOOLS, ...WRITE_GITHUB_TOOLS]);

// Intersects the live server's advertised tools against the allowlist.
// Warns (doesn't throw) for any allowlisted name the server didn't actually
// advertise — a scope mismatch (PAT missing a permission, or GitHub renamed
// a tool) should be visible in logs, not a silent capability gap.
export function resolveAuthorizedGithubTools(
  remoteTools: RemoteToolDefinition[]
): RemoteToolDefinition[] {
  const byName = new Map(remoteTools.map((tool) => [tool.name, tool]));
  const authorized: RemoteToolDefinition[] = [];

  for (const name of GITHUB_TOOL_ALLOWLIST) {
    const tool = byName.get(name);
    if (tool) {
      authorized.push(tool);
    } else {
      console.warn(
        `⚠️  GitHub MCP server did not advertise allowlisted tool "${name}" — ` +
          `likely a PAT scope gap or an upstream rename. This tool will be unavailable.`
      );
    }
  }

  return authorized;
}
