import { generateImage } from '../image-client';

describe('generateImage', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('requests the URL-encoded prompt and returns the image bytes + mime type', async () => {
    const fakeBytes = new Uint8Array([1, 2, 3, 4]).buffer;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => fakeBytes,
      headers: { get: (name: string) => (name === 'content-type' ? 'image/png' : null) },
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await generateImage('a red bicycle');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('https://image.pollinations.ai/prompt/');
    expect(url).toContain(encodeURIComponent('a red bicycle'));
    expect(result.mimeType).toBe('image/png');
    expect(Buffer.compare(result.buffer, Buffer.from(fakeBytes))).toBe(0);
  });

  it('falls back to image/jpeg when no content-type header is present', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
      headers: { get: () => null },
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await generateImage('a blue car');
    expect(result.mimeType).toBe('image/jpeg');
  });

  it('throws with response body on a non-ok response', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'upstream error',
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(generateImage('anything')).rejects.toThrow(
      /Pollinations image generation failed \(500\).*upstream error/
    );
  });
});
