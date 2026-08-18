import type { RemoteToolDefinition } from './github-client';

// The actual safety boundary — a hardcoded allowlist independent of
// whatever GitHub's MCP server advertises. This must never grow silently
// just because GitHub adds a new tool to the "issues"/"pull_requests"
// toolsets later; widening scope here is a deliberate decision, not a side
// effect of an upstream catalog change.
//
// Verified against the live server's real tools/list() response (2026-08-18)
// — GitHub's actual catalog consolidates many single-purpose tools the docs
// implied into a handful of multi-method ones (issue_read/issue_write,
// pull_request_read/pull_request_review_write, etc.), addressed with `method`
// or `state`/`event` parameters rather than separate tool names. The
// consolidated write tools can do more than this agent should ever do
// unattended (issue_write can close an issue via state:'closed';
// pull_request_review_write can submit an APPROVE/REQUEST_CHANGES review) —
// see github-agent.ts's executeToolCall() for the code-level guards on those.
//
// Deliberately excluded regardless of what the server offers: merge_pull_request,
// update_pull_request (can close a PR via state:'closed', or toggle draft
// status — out of v1 scope entirely, not just the closing part),
// label_write (manages the repo's label *definitions* — creating/renaming/
// deleting label types — not applying a label to an issue, which is a
// labels field on issue_write instead), create_or_update_file, delete_file,
// create_branch, push_files, create_repository, fork_repository, and any
// org/repo-admin, collaborator/team, or secret/Actions-write tool.
export const READ_ONLY_GITHUB_TOOLS = new Set([
  'issue_read',
  'pull_request_read',
  'list_issues',
  'search_issues',
  'list_pull_requests',
  'search_pull_requests',
  'get_file_contents',
  'search_code',
  'list_branches',
  'list_commits',
  'get_commit',
  'search_commits',
  'get_label',
  'list_label',
  'search_repositories',
]);

// Write tools — in the allowlist, but every call still goes through
// BaseAgent.proposeAction() (the approval queue) before executing. Two of
// these also get an additional code-level guard in github-agent.ts because
// the tool itself can do more than the allowlist alone can restrict:
//   - issue_write: rejected if state === 'closed' (create/update/comment/
//     label are all fine; closing is not).
//   - pull_request_review_write: rejected if event is 'APPROVE' or
//     'REQUEST_CHANGES' (a COMMENT-only review, or a pending/resolve-thread
//     action, is fine; approving or blocking a PR is a human decision).
//   - create_pull_request: rejected unless draft === true.
const WRITE_GITHUB_TOOLS = new Set([
  'add_issue_comment',
  'issue_write',
  'pull_request_review_write',
  'create_pull_request',
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
