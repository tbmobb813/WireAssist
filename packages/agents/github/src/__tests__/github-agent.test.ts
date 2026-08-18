import type { AgentTask, IApprovalQueue, MemoryStore, MCPClient, EventBus } from '@wireassist/core';
import { GitHubAgent } from '../github-agent';
import type { GitHubMcpClient, RemoteToolDefinition } from '../github-client';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-g1',
    agentRole: 'github',
    description: 'Check open issues',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'freeform', prompt: 'Check open issues' },
    approvalRequired: true,
    ...overrides,
  };
}

const authorizedTools: RemoteToolDefinition[] = [
  { name: 'get_issue', description: 'Get an issue', inputSchema: { type: 'object' } },
  {
    name: 'add_issue_comment',
    description: 'Comment on an issue',
    inputSchema: { type: 'object' },
  },
  {
    name: 'create_pull_request',
    description: 'Open a pull request',
    inputSchema: { type: 'object' },
  },
];

function makeDeps(
  overrides: {
    approval?: Partial<IApprovalQueue>;
    githubClient?: Partial<GitHubMcpClient>;
  } = {}
) {
  const githubClient = {
    callTool: jest.fn().mockResolvedValue({ ok: true }),
    ...overrides.githubClient,
  } as unknown as GitHubMcpClient;

  return {
    approval: {
      request: jest.fn().mockResolvedValue(true),
      resolve: jest.fn(),
      getPending: jest.fn().mockReturnValue([]),
      ...overrides.approval,
    } as unknown as IApprovalQueue,
    memory: {
      searchAsync: jest.fn().mockResolvedValue([]),
      search: jest.fn().mockReturnValue([]),
      store: jest.fn().mockReturnValue('m1'),
      storeAsync: jest.fn().mockResolvedValue('m1'),
      listRecent: jest.fn().mockReturnValue([]),
      upgradeEmbeddings: jest.fn().mockResolvedValue({ upgraded: 0, total: 0 }),
    } as unknown as MemoryStore,
    mcp: { call: jest.fn(), register: jest.fn() } as unknown as MCPClient,
    events: { emit: jest.fn(), on: jest.fn() } as unknown as EventBus,
    githubClient,
    authorizedTools,
  };
}

describe('GitHubAgent.executeToolCall', () => {
  it('runs a read-only tool immediately, with no approval request', async () => {
    const deps = makeDeps();
    const agent = new GitHubAgent(deps);

    const result = await (agent as any).executeToolCall(makeTask(), {
      id: 'c1',
      name: 'get_issue',
      input: { issue_number: 1 },
    });

    expect(result).toEqual({ result: { ok: true }, isError: false });
    expect(deps.approval.request).not.toHaveBeenCalled();
    expect(deps.githubClient.callTool).toHaveBeenCalledWith('get_issue', { issue_number: 1 });
  });

  it('requires approval for a write tool, and executes it once approved', async () => {
    const deps = makeDeps();
    const agent = new GitHubAgent(deps);

    const result = await (agent as any).executeToolCall(makeTask(), {
      id: 'c2',
      name: 'add_issue_comment',
      input: { issue_number: 1, body: 'hi' },
    });

    expect(deps.approval.request).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ result: { ok: true }, isError: false });
    expect(deps.githubClient.callTool).toHaveBeenCalledWith('add_issue_comment', {
      issue_number: 1,
      body: 'hi',
    });
  });

  it('never calls the GitHub client when approval is declined', async () => {
    const deps = makeDeps({ approval: { request: jest.fn().mockResolvedValue(false) } });
    const agent = new GitHubAgent(deps);

    const result = await (agent as any).executeToolCall(makeTask(), {
      id: 'c3',
      name: 'add_issue_comment',
      input: { issue_number: 1, body: 'hi' },
    });

    expect(result).toEqual({ result: 'User declined this action.', isError: true });
    expect(deps.githubClient.callTool).not.toHaveBeenCalled();
  });

  it('rejects a tool name outside the allowlist before any network call', async () => {
    const deps = makeDeps();
    const agent = new GitHubAgent(deps);

    const result = await (agent as any).executeToolCall(makeTask(), {
      id: 'c4',
      name: 'merge_pull_request',
      input: { pull_number: 1 },
    });

    expect(result.isError).toBe(true);
    expect(String(result.result)).toMatch(/outside this agent's allowed scope/);
    expect(deps.approval.request).not.toHaveBeenCalled();
    expect(deps.githubClient.callTool).not.toHaveBeenCalled();
  });

  it('rejects create_pull_request unless draft is explicitly true', async () => {
    const deps = makeDeps();
    const agent = new GitHubAgent(deps);

    const result = await (agent as any).executeToolCall(makeTask(), {
      id: 'c5',
      name: 'create_pull_request',
      input: { title: 'x', draft: false },
    });

    expect(result).toEqual({
      result: 'create_pull_request must be called with draft: true.',
      isError: true,
    });
    expect(deps.approval.request).not.toHaveBeenCalled();
    expect(deps.githubClient.callTool).not.toHaveBeenCalled();
  });

  it('allows create_pull_request when draft is explicitly true, still gated by approval', async () => {
    const deps = makeDeps();
    const agent = new GitHubAgent(deps);

    const result = await (agent as any).executeToolCall(makeTask(), {
      id: 'c6',
      name: 'create_pull_request',
      input: { title: 'x', draft: true },
    });

    expect(deps.approval.request).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ result: { ok: true }, isError: false });
  });
});

describe('GitHubAgent config', () => {
  it('toolSchemas is built from the authorized tools passed in', () => {
    const deps = makeDeps();
    const agent = new GitHubAgent(deps);
    const toolSchemas = (agent as any).config.toolSchemas;

    expect(Object.keys(toolSchemas).sort()).toEqual(
      ['add_issue_comment', 'create_pull_request', 'get_issue'].sort()
    );
  });

  it('tools (the old MCP registry authorization list) is empty — GitHub calls bypass it entirely', () => {
    const deps = makeDeps();
    const agent = new GitHubAgent(deps);
    expect((agent as any).config.tools).toEqual([]);
  });
});
