import {
  type AgentConfig,
  type AgentTask,
  type IApprovalQueue,
  type MemoryStore,
  type MCPClient,
  type EventBus,
  type ProviderToolCall,
} from '@wireassist/core';
import { posix } from 'path';
import { BaseAgent, buildDelegateToolSchema, DELEGATE_TOOL_NAME } from '@wireassist/agent-admin';
import { GITHUB_SKILLS } from './skills';
import { GITHUB_TOOL_ALLOWLIST, READ_ONLY_GITHUB_TOOLS } from './tool-policy';
import { buildGithubToolSchemas, GITHUB_SKILL_TOOLS, PROPOSE_SKILL_SCHEMA } from './tool-schemas';
import type { GitHubMcpClient, RemoteToolDefinition } from './github-client';

// The real security boundary for propose_skill's PR-writing step, across
// all 6 agents — an explicit allowlist of exactly 6 real paths, not a
// wildcard pattern. A wildcard (e.g. anything ending in /skills/proposed/)
// would silently permit a write to any such path a future typo or
// prompt-injection could construct; this list is auditable and safe.
const PROPOSED_SKILL_PATH_PREFIXES = [
  'packages/agents/admin/src/skills/proposed/',
  'packages/agents/content/src/skills/proposed/',
  'packages/agents/research/src/skills/proposed/',
  'packages/agents/gtm/src/skills/proposed/',
  'packages/agents/ops/src/skills/proposed/',
  'packages/agents/github/src/skills/proposed/',
];

// A plain `.startsWith(prefix)` check on the raw path string passes for
// something like "packages/agents/ops/src/skills/proposed/../../../../../malicious.ts" —
// it literally starts with an allowed prefix even though it resolves
// outside every one of them. GitHub's Contents API operates on git tree
// paths, not real filesystem paths, so it's unclear whether `..` segments
// even have traversal semantics there — but this check should hold
// regardless of that, defensively. Normalizes first, then requires BOTH
// that the normalized path still starts with an allowed prefix AND that it
// has no remaining `..` segment or leading slash (normalize() alone can
// still leave a leading "../" if the path climbs above where it started).
function isAllowedProposedSkillPath(rawPath: unknown): boolean {
  const normalized = posix.normalize(String(rawPath ?? ''));
  if (normalized.startsWith('..') || normalized.startsWith('/')) return false;
  return PROPOSED_SKILL_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

const GITHUB_SYSTEM_PROMPT = `You are the GitHub Dev Agent for WireAssist.
You give JNix read access to his GitHub repos, issues, and pull requests, plus a narrow
set of write actions: commenting, labeling, opening pull requests as DRAFTS ONLY, and —
narrowly, only for each agent's own skill-proposal pilot — writing a new file under that
agent's own proposed/ staging directory on a skill-proposal/* branch.

BOUNDARIES (non-negotiable, enforced in code — do not attempt to work around them):
- You never merge or close an issue or pull request. issue_write can update an issue's
  state to "closed" — you never do this, regardless of what's asked.
- You never approve or request changes on a pull request review. pull_request_review_write
  can submit an APPROVE or REQUEST_CHANGES review — you only ever leave a COMMENT-only
  review, or work with pending/resolve-thread actions.
- You never push commits, delete anything, or push multiple files at once (push_files is
  not available to you). create_or_update_file only works for paths under one of the 6
  agents' own proposed/ staging directories — nowhere else in the repo. create_branch only
  works for branch names starting with skill-proposal/ — never any other branch.
- You never open a pull request as anything but a draft (create_pull_request with
  draft: true, always).
- Every write action requires JNix's explicit approval before it happens — you propose,
  he decides. This approval gate is automatic and built into every write tool call itself:
  call the tool directly, and it pauses for his real approval before anything actually
  happens. Do NOT ask for confirmation in plain text before calling a write tool — you have
  no way to hear a reply after a single-shot request like this one, so a text question
  instead of a real tool call just ends the task with nothing done and nothing to approve.

Read tools execute immediately since they can't change anything. Write tools always wait
for approval, even for something that seems obviously fine — there is no "auto-approve"
exception for this agent.

SELF-IMPROVEMENT:
If the user is asking you to build yourself a new capability — "draft a skill that...", "can you
make yourself able to...", anything where the point is growing what you can do, not just doing
one thing with what you already have — call propose_skill_skill instead of hand-writing
pseudocode or prose describing the idea.

DELEGATION:
If the request needs something outside GitHub repo work — email/calendar (Admin), a written
post (Content), web research (Research), a business workflow (NixOps), or a go-to-market
strategy (GTM) — use delegate_to_agent instead of guessing or doing a worse version yourself.
Never delegate something you can already do with your own tools.`;

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
      toolSchemas: {
        ...buildGithubToolSchemas(deps.authorizedTools),
        propose_skill_skill: PROPOSE_SKILL_SCHEMA,
        [DELEGATE_TOOL_NAME]: buildDelegateToolSchema('github'),
      },
      maxTokens: 4096,
    };
    super(config, deps);
    this.githubClient = deps.githubClient;
    for (const skill of GITHUB_SKILLS) this.skills.registerSkill(skill);
  }

  protected isReadOnlyTool(toolName: string): boolean {
    return READ_ONLY_GITHUB_TOOLS.has(toolName);
  }

  // Lets a plain HTTP route call an allowlisted read-only GitHub tool
  // directly — bypassing agent.think()/the LLM tool-loop entirely — for
  // deterministic lookups (e.g. listing repos for a UI picker) that don't
  // need conversational reasoning and shouldn't cost a model call.
  async callReadOnlyTool(name: string, input: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.isReadOnlyTool(name)) {
      throw new Error(`"${name}" is not an allowlisted read-only GitHub tool`);
    }
    return this.githubClient.callTool(name, input);
  }

  protected async executeToolCall(
    task: AgentTask,
    call: ProviderToolCall
  ): Promise<{ result: unknown; isError: boolean }> {
    try {
      if (call.name === DELEGATE_TOOL_NAME) {
        return this.executeDelegateToAgent(task, call);
      }

      if (GITHUB_SKILL_TOOLS.has(call.name)) {
        // propose_skill_skill self-gates its own mutation via an internal
        // proposeAction() call — dispatch immediately rather than
        // approval-gating a second time, same as every other agent's
        // skill-tools.
        const skillName = call.name.replace(/_skill$/, '');
        return { result: await this.invokeSkill(task, skillName, call.input), isError: false };
      }

      // Defense-in-depth — toolSchemas should already only ever contain
      // allowlisted names (built from resolveAuthorizedGithubTools()'s
      // intersection) plus delegate_to_agent (handled above), so the model
      // should never see anything else. This guard protects against a
      // future refactor accidentally widening exposure, not against a
      // normal code path.
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

      // New file content is only ever allowed under one of the 6 agents'
      // own proposed-skill staging directories — never anywhere else in the
      // repo, regardless of what the model asks for. A file sitting there
      // is inert (never imported, never registered) until a human moves it
      // out as a separate, deliberate step.
      if (call.name === 'create_or_update_file' && !isAllowedProposedSkillPath(call.input.path)) {
        return {
          result: `create_or_update_file is only allowed under one of: ${PROPOSED_SKILL_PATH_PREFIXES.join(', ')}`,
          isError: true,
        };
      }

      // Branches created by this agent are only ever for a proposed-skill
      // PR — never a generically-named branch that could be confused with
      // real work.
      if (
        call.name === 'create_branch' &&
        !String(call.input.branch ?? call.input.ref ?? '').startsWith('skill-proposal/')
      ) {
        return {
          result: 'create_branch is only allowed for branch names starting with skill-proposal/',
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
