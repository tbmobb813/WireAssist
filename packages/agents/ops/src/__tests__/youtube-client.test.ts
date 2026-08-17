jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

import * as fs from 'fs';

const mockExistsSync = fs.existsSync as jest.Mock;
const mockReadFileSync = fs.readFileSync as jest.Mock;

describe('searchVideos', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    mockExistsSync.mockReset();
    mockReadFileSync.mockReset();
  });

  it('throws a helpful error when credentials are missing', async () => {
    mockExistsSync.mockReturnValue(false);
    const { searchVideos } = await import('../youtube-client');
    await expect(searchVideos('gpu shortage')).rejects.toThrow(/YouTube credentials not found/);
  });

  it('throws when apiKey is missing from the credentials file', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({}));
    const { searchVideos } = await import('../youtube-client');
    await expect(searchVideos('gpu shortage')).rejects.toThrow(/missing "apiKey"/);
  });

  it('searches with the query and API key, and maps results to a flat shape', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ apiKey: 'test-key' }));

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: { videoId: 'abc123' },
            snippet: { title: 'GPU Shortage Explained', channelTitle: 'Some Tech Channel' },
          },
        ],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { searchVideos } = await import('../youtube-client');
    const results = await searchVideos('gpu shortage 2026', 5);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('key=test-key');
    expect(url).toContain('q=gpu+shortage+2026');
    expect(url).toContain('maxResults=5');

    expect(results).toEqual([
      {
        videoId: 'abc123',
        title: 'GPU Shortage Explained',
        channelTitle: 'Some Tech Channel',
        url: 'https://www.youtube.com/watch?v=abc123',
      },
    ]);
  });

  it('throws with response body on a non-ok response', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ apiKey: 'test-key' }));

    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'quota exceeded',
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { searchVideos } = await import('../youtube-client');
    await expect(searchVideos('anything')).rejects.toThrow(
      /YouTube search failed \(403\).*quota exceeded/
    );
  });
});
