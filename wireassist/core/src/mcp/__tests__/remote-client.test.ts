jest.mock('@modelcontextprotocol/client', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    listTools: mockListTools,
    callTool: mockCallTool,
    close: mockClose,
  })),
  StreamableHTTPClientTransport: jest.fn().mockImplementation((url: URL, opts: unknown) => ({
    url,
    opts,
    terminateSession: mockTerminateSession,
  })),
}));

const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockListTools = jest.fn();
const mockCallTool = jest.fn();
const mockClose = jest.fn().mockResolvedValue(undefined);
const mockTerminateSession = jest.fn().mockResolvedValue(undefined);

import { RemoteMcpClient } from '../remote-client';

describe('RemoteMcpClient', () => {
  afterEach(() => {
    mockConnect.mockClear();
    mockListTools.mockClear();
    mockCallTool.mockClear();
    mockClose.mockClear();
    mockTerminateSession.mockClear();
  });

  const makeClient = () =>
    new RemoteMcpClient({
      url: 'https://example.com/mcp',
      authProvider: { token: async () => 'fake-token' },
      clientName: 'test-client',
    });

  it('connect() delegates to the underlying MCP client', async () => {
    const client = makeClient();
    await client.connect();
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it('listRemoteTools() maps the MCP tool list, defaulting missing fields', async () => {
    mockListTools.mockResolvedValue({
      tools: [
        { name: 'a', description: 'does a thing', inputSchema: { type: 'object', properties: {} } },
        { name: 'b' },
      ],
    });
    const client = makeClient();
    const tools = await client.listRemoteTools();
    expect(tools).toEqual([
      { name: 'a', description: 'does a thing', inputSchema: { type: 'object', properties: {} } },
      { name: 'b', description: '', inputSchema: { type: 'object', properties: {} } },
    ]);
  });

  it('callTool() returns content on success', async () => {
    mockCallTool.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }], isError: false });
    const client = makeClient();
    const result = await client.callTool('do_thing', { x: 1 });
    expect(result).toEqual([{ type: 'text', text: 'ok' }]);
    expect(mockCallTool).toHaveBeenCalledWith({ name: 'do_thing', arguments: { x: 1 } });
  });

  it('callTool() throws when the MCP result has isError: true', async () => {
    mockCallTool.mockResolvedValue({
      content: [{ type: 'text', text: 'bad input' }],
      isError: true,
    });
    const client = makeClient();
    await expect(client.callTool('do_thing', {})).rejects.toThrow(/MCP tool "do_thing" failed/);
  });

  it('disconnect() terminates the session and closes the client', async () => {
    const client = makeClient();
    await client.disconnect();
    expect(mockTerminateSession).toHaveBeenCalledTimes(1);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
