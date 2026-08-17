import { postToLinkedin } from '../linkedin';

describe('postToLinkedin()', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.LINKEDIN_ACCESS_TOKEN = 'li-token';
    process.env.LINKEDIN_PERSON_URN = '12345';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  it('posts to the UGC Posts API with the expected URL, headers, and body shape', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: { get: (name: string) => (name === 'x-restli-id' ? 'li-999' : null) },
      json: async () => ({}),
    });

    const result = await postToLinkedin('hello world');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.linkedin.com/v2/ugcPosts',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer li-token',
          'X-Restli-Protocol-Version': '2.0.0',
        }),
      })
    );
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.author).toBe('urn:li:person:12345');
    expect(body.specificContent['com.linkedin.ugc.ShareContent'].shareCommentary.text).toBe(
      'hello world'
    );
    expect(result).toEqual({ platformPostId: 'li-999' });
  });

  it('accepts a LINKEDIN_PERSON_URN that already includes the urn:li:person: prefix', async () => {
    process.env.LINKEDIN_PERSON_URN = 'urn:li:person:12345';
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: { get: () => 'li-999' },
      json: async () => ({}),
    });

    await postToLinkedin('hello');

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.author).toBe('urn:li:person:12345');
  });

  it('falls back to a JSON id field when the x-restli-id header is absent', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      json: async () => ({ id: 'li-from-body' }),
    });

    const result = await postToLinkedin('hello');

    expect(result).toEqual({ platformPostId: 'li-from-body' });
  });

  it('throws with the response body text on a non-2xx response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'invalid token',
    });

    await expect(postToLinkedin('hello')).rejects.toThrow(/401.*invalid token/s);
  });

  it('throws a clear error when credentials are missing', async () => {
    delete process.env.LINKEDIN_ACCESS_TOKEN;
    await expect(postToLinkedin('hello')).rejects.toThrow(/LINKEDIN_ACCESS_TOKEN/);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
