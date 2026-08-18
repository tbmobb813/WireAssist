import {
  type AgentConfig,
  type AgentTask,
  type IApprovalQueue,
  type MemoryStore,
  type MCPClient,
  type EventBus,
  type ProviderToolCall,
} from '@wireassist/core';
import { BaseAgent } from '@wireassist/agent-admin';
import { GITHUB_SKILLS } from './skills';
import { GITHUB_TOOL_ALLOWLIST, READ_ONLY_GITHUB_TOOLS } from './tool-policy';
import { buildGithubToolSchemas } from './tool-schemas';
import type { GitHubMcpClient, RemoteToolDefinition } from './github-client';

const GITHUB_SYSTEM_PROMPT = `You are the GitHub Dev Agent for WireAssist.
You give JNix read access to his GitHub repos, issues, and pull requests, plus a narrow
set of write actions: commenting, labeling, and opening pull requests as DRAFTS ONLY.

BOUNDARIES (non-negotiable, enforced in code — do not attempt to work around them):
- You never merge or close an issue or pull request. issue_write can update an issue's
  state to "closed" — you never do this, regardless of what's asked.
- You never approve or request changes on a pull request review. pull_request_review_write
  can submit an APPROVE or REQUEST_CHANGES review — you only ever leave a COMMENT-only
  review, or work with pending/resolve-thread actions.
- You never push commits, create/delete branches, or delete anything.
- You never open a pull request as anything but a draft (create_pull_request with
  draft: true, always).
- Every write action requires JNix's explicit approval before it happens — you propose,
  he decides.

Read tools execute immediately since they can't change anything. Write tools always wait
for approval, even for something that seems obviously fine — there is no "auto-approve"
exception for this agent.`;

export class GitHubAgent extends BaseAgent {
  private githubClient: GitHubMcpClient;

  constructor(deps: {
    approval: IApprovalQueue;
    memory: MemoryStore;
    mcp: MCPClient;
    events: EventBus;
    githubClient: GitHubMcpClient;
    authorizedTools: RemoteToolDefinition[];
  }) {
    const config: AgentConfig = {
      role: 'github',
      name: 'GitHub Dev Agent',
      systemPrompt: GITHUB_SYSTEM_PROMPT,
      // Deliberately empty — GitHub calls go through the real MCP client
      // (this.githubClient), bypassing the fake in-process MCPClient/useTool()
      // entirely. `tools` only gates the old registry, so it has nothing to
      // authorize here.
      tools: [],
      toolSchemas: buildGithubToolSchemas(deps.authorizedTools),
      maxTokens: 4096,
    };
    super(config, deps);
    this.githubClient = deps.githubClient;
    for (const skill of GITHUB_SKILLS) this.skills.registerSkill(skill);
  }

  protected isReadOnlyTool(toolName: string): boolean {
    return READ_ONLY_GITHUB_TOOLS.has(toolName);
  }

  protected async executeToolCall(
    task: AgentTask,
    call: ProviderToolCall
  ): Promise<{ result: unknown; isError: boolean }> {
    try {
      // Defense-in-depth — toolSchemas should already only ever contain
      // allowlisted names (built from resolveAuthorizedGithubTools()'s
      // intersection), so the model should never see anything else. This
      // guard protects against a future refactor accidentally widening
      // exposure, not against a normal code path.
      if (!GITHUB_TOOL_ALLOWLIST.has(call.name)) {
        return {
          result: `Tool "${call.name}" is outside this agent's allowed scope.`,
          isError: true,
        };
      }

      // Hard code-level enforcement of "draft only" — not just a system-prompt
      // instruction the model could ignore or be prompt-injected around.
      if (call.name === 'create_pull_request' && call.input.draft !== true) {
        return { result: 'create_pull_request must be called with draft: true.', isError: true };
      }

      // issue_write is a consolidated create/update tool — state: 'closed'
      // closes the issue, which is explicitly forbidden regardless of
      // approval. create/update/comment/label/assign are all fine.
      if (call.name === 'issue_write' && call.input.state === 'closed') {
        return { result: 'issue_write must not be called with state: "closed".', isError: true };
      }

      // pull_request_review_write's event decides whether the review
      // actually gatekeeps the PR — APPROVE/REQUEST_CHANGES is a real human
      // decision this agent never makes on its own. Commenting, submitting a
      // pending comment-only review, and resolving/unresolving threads are
      // all fine.
      if (
        call.name === 'pull_request_review_write' &&
        (call.input.event === 'APPROVE' || call.input.event === 'REQUEST_CHANGES')
      ) {
        return {
          result: `pull_request_review_write must not be called with event: "${call.input.event}".`,
          isError: true,
        };
      }

      if (this.isReadOnlyTool(call.name)) {
        return { result: await this.githubClient.callTool(call.name, call.input), isError: false };
      }

      const approved = await this.proposeAction(
        task,
        `Call GitHub tool "${call.name}"`,
        call.input
      );
      if (!approved) {
        return { result: 'User declined this action.', isError: true };
      }
      return { result: await this.githubClient.callTool(call.name, call.input), isError: false };
    } catch (error) {
      return { result: error instanceof Error ? error.message : String(error), isError: true };
    }
  }
}
