// swc compiles `import * as fs from 'fs'` with a namespace-copy interop
// helper, so a plain `jest.spyOn(fs, 'existsSync')` here mutates a
// different object than the one wordpress-client.ts sees. Mocking the
// module itself, before either file imports it, keeps both sides looking
// at the same jest.fn() references.
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

import * as fs from 'fs';

const mockExistsSync = fs.existsSync as jest.Mock;
const mockReadFileSync = fs.readFileSync as jest.Mock;

const CREDS = {
  siteUrl: 'https://example.com/',
  username: 'jnix',
  applicationPassword: 'abcd 1234 efgh 5678',
};

describe('WordPressClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    mockExistsSync.mockReset();
    mockReadFileSync.mockReset();
  });

  it('throws a helpful error when credentials are missing', async () => {
    mockExistsSync.mockReturnValue(false);
    const { WordPressClient } = await import('../wordpress-client');
    expect(() => new WordPressClient()).toThrow(/WordPress credentials not found/);
  });

  it('throws when a credentials field is missing', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ siteUrl: 'https://example.com' }));
    const { WordPressClient } = await import('../wordpress-client');
    expect(() => new WordPressClient()).toThrow(/missing one of/);
  });

  it('posts a draft with Basic auth, trimmed base URL, and status: draft', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(CREDS));

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 42, status: 'draft', link: 'https://example.com/?p=42' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { WordPressClient } = await import('../wordpress-client');
    const client = new WordPressClient();
    const result = await client.createDraftPost({
      title: 'Test Article',
      contentHtml: '<p>Body</p>',
      excerpt: 'A summary',
      slug: 'test-article',
      metaTitle: 'Test Article | Site',
      metaDescription: 'A description',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.com/wp-json/wp/v2/posts');

    const headers = opts.headers as Record<string, string>;
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from('jnix:abcd 1234 efgh 5678').toString('base64')}`
    );

    const body = JSON.parse(opts.body as string);
    expect(body).toMatchObject({
      title: 'Test Article',
      content: '<p>Body</p>',
      status: 'draft',
      excerpt: 'A summary',
      slug: 'test-article',
      meta: {
        _yoast_wpseo_title: 'Test Article | Site',
        _yoast_wpseo_metadesc: 'A description',
      },
    });

    expect(result).toEqual({
      id: 42,
      status: 'draft',
      link: 'https://example.com/?p=42',
      editLink: 'https://example.com/wp-admin/post.php?post=42&action=edit',
    });
  });

  it('never sends status other than draft, even if attempted via input', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(CREDS));

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 1, status: 'draft', link: 'https://example.com/?p=1' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { WordPressClient } = await import('../wordpress-client');
    const client = new WordPressClient();
    await client.createDraftPost({ title: 'T', contentHtml: '<p>x</p>' });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.status).toBe('draft');
  });

  it('throws with response body on a non-ok response', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(CREDS));

    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'invalid application password',
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { WordPressClient } = await import('../wordpress-client');
    const client = new WordPressClient();
    await expect(client.createDraftPost({ title: 'T', contentHtml: '<p>x</p>' })).rejects.toThrow(
      /WordPress draft creation failed \(401\).*invalid application password/
    );
  });

  it('includes featured_media in the post body when provided', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(CREDS));

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 1, status: 'draft', link: 'https://example.com/?p=1' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { WordPressClient } = await import('../wordpress-client');
    const client = new WordPressClient();
    await client.createDraftPost({ title: 'T', contentHtml: '<p>x</p>', featuredMediaId: 99 });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.featured_media).toBe(99);
  });

  describe('uploadMedia', () => {
    it('uploads raw bytes with Basic auth, content-type, and content-disposition headers', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(CREDS));

      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 7, source_url: 'https://example.com/wp-content/uploads/img.jpg' }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const { WordPressClient } = await import('../wordpress-client');
      const client = new WordPressClient();
      const result = await client.uploadMedia({
        imageBuffer: Buffer.from([1, 2, 3]),
        mimeType: 'image/jpeg',
        filename: 'img.jpg',
      });

      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toBe('https://example.com/wp-json/wp/v2/media');
      expect(opts.headers['Content-Type']).toBe('image/jpeg');
      expect(opts.headers['Content-Disposition']).toBe('attachment; filename="img.jpg"');
      expect(opts.headers.Authorization).toContain('Basic ');
      expect(result).toEqual({
        id: 7,
        sourceUrl: 'https://example.com/wp-content/uploads/img.jpg',
      });
    });

    it('throws with response body on a non-ok upload response', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(CREDS));

      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 413,
        text: async () => 'file too large',
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const { WordPressClient } = await import('../wordpress-client');
      const client = new WordPressClient();
      await expect(
        client.uploadMedia({
          imageBuffer: Buffer.from([1]),
          mimeType: 'image/png',
          filename: 'x.png',
        })
      ).rejects.toThrow(/WordPress media upload failed \(413\).*file too large/);
    });
  });

  describe('listRecentPosts', () => {
    it('requests the public posts endpoint with limited fields and no auth header', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(CREDS));

      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: 1,
            title: { rendered: 'Best GPUs for Budget Builds' },
            link: 'https://example.com/p1',
          },
        ],
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const { WordPressClient } = await import('../wordpress-client');
      const client = new WordPressClient();
      const posts = await client.listRecentPosts(50);

      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toBe(
        'https://example.com/wp-json/wp/v2/posts?per_page=50&_fields=id,title,link&status=publish'
      );
      expect(opts).toBeUndefined();
      expect(posts).toEqual([
        { id: 1, title: 'Best GPUs for Budget Builds', link: 'https://example.com/p1' },
      ]);
    });

    it('throws with response body on a non-ok response', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(CREDS));

      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'server error',
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const { WordPressClient } = await import('../wordpress-client');
      const client = new WordPressClient();
      await expect(client.listRecentPosts()).rejects.toThrow(
        /WordPress post listing failed \(500\).*server error/
      );
    });
  });
});
