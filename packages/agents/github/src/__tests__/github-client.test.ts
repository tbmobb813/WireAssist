jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockListTools = jest.fn();
const mockCallTool = jest.fn();
const mockClose = jest.fn().mockResolvedValue(undefined);
const mockTerminateSession = jest.fn().mockResolvedValue(undefined);
const MockClient = jest.fn().mockImplementation(() => ({
  connect: mockConnect,
  listTools: mockListTools,
  callTool: mockCallTool,
  close: mockClose,
}));
const MockTransport = jest.fn().mockImplementation((url: URL, opts: unknown) => ({
  url,
  opts,
  terminateSession: mockTerminateSession,
}));

jest.mock('@modelcontextprotocol/client', () => ({
  Client: MockClient,
  StreamableHTTPClientTransport: MockTransport,
}));

import * as fs from 'fs';

const mockExistsSync = fs.existsSync as jest.Mock;
const mockReadFileSync = fs.readFileSync as jest.Mock;

describe('GitHubMcpClient', () => {
  afterEach(() => {
    mockExistsSync.mockReset();
    mockReadFileSync.mockReset();
    MockClient.mockClear();
    MockTransport.mockClear();
    mockConnect.mockClear();
    mockListTools.mockReset();
    mockCallTool.mockReset();
  });

  it('throws a helpful error when credentials are missing', async () => {
    mockExistsSync.mockReturnValue(false);
    const { GitHubMcpClient } = await import('../github-client');
    expect(() => new GitHubMcpClient()).toThrow(/GitHub credentials not found/);
  });

  it('throws when personalAccessToken is missing from the credentials file', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({}));
    const { GitHubMcpClient } = await import('../github-client');
    expect(() => new GitHubMcpClient()).toThrow(/missing "personalAccessToken"/);
  });

  it('connects with the GitHub MCP endpoint and a bearer-token authProvider', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ personalAccessToken: 'ghp_test123' }));
    const { GitHubMcpClient } = await import('../github-client');

    const client = new GitHubMcpClient();
    await client.connect();

    expect(MockTransport).toHaveBeenCalledTimes(1);
    const [url, opts] = MockTransport.mock.calls[0] as [
      URL,
      { authProvider: { token: () => Promise<string> } },
    ];
    expect(url.toString()).toBe('https://api.githubcopilot.com/mcp/');
    await expect(opts.authProvider.token()).resolves.toBe('ghp_test123');
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it('sets the X-MCP-Toolsets header to scope the tool catalog', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ personalAccessToken: 'ghp_test123' }));
    const { GitHubMcpClient } = await import('../github-client');

    new GitHubMcpClient();

    const [, opts] = MockTransport.mock.calls[0] as [
      URL,
      { requestInit: { headers: Record<string, string> } },
    ];
    expect(opts.requestInit.headers['X-MCP-Toolsets']).toBe('repos,issues,labels,pull_requests');
  });

  it('listRemoteTools returns the raw {name, description, inputSchema} list', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ personalAccessToken: 'ghp_test123' }));
    mockListTools.mockResolvedValue({
      tools: [{ name: 'get_issue', description: 'Get an issue', inputSchema: { type: 'object' } }],
    });
    const { GitHubMcpClient } = await import('../github-client');

    const client = new GitHubMcpClient();
    const tools = await client.listRemoteTools();

    expect(tools).toEqual([
      { name: 'get_issue', description: 'Get an issue', inputSchema: { type: 'object' } },
    ]);
  });

  it('callTool returns content on success', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ personalAccessToken: 'ghp_test123' }));
    mockCallTool.mockResolvedValue({ isError: false, content: [{ type: 'text', text: 'ok' }] });
    const { GitHubMcpClient } = await import('../github-client');

    const client = new GitHubMcpClient();
    const result = await client.callTool('get_issue', { issue_number: 1 });

    expect(mockCallTool).toHaveBeenCalledWith({
      name: 'get_issue',
      arguments: { issue_number: 1 },
    });
    expect(result).toEqual([{ type: 'text', text: 'ok' }]);
  });

  it('callTool throws when the MCP result has isError: true, instead of returning it silently', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ personalAccessToken: 'ghp_test123' }));
    mockCallTool.mockResolvedValue({
      isError: true,
      content: [{ type: 'text', text: 'not found' }],
    });
    const { GitHubMcpClient } = await import('../github-client');

    const client = new GitHubMcpClient();
    await expect(client.callTool('get_issue', { issue_number: 999 })).rejects.toThrow(
      /GitHub tool "get_issue" failed/
    );
  });
});
