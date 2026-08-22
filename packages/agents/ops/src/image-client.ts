// Pollinations.ai — free, no-API-key image generation backed by open models
// (Flux). No account, no billing setup; the trade-off is it's a community
// service with no uptime/rate-limit guarantee, not a paid product.
const BASE_URL = 'https://image.pollinations.ai/prompt';

export interface GeneratedImage {
  buffer: Buffer;
  mimeType: string;
}

export async function generateImage(prompt: string): Promise<GeneratedImage> {
  const url = `${BASE_URL}/${encodeURIComponent(prompt)}?width=1024&height=576&nologo=true&model=flux`;
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Pollinations image generation failed (${response.status}): ${text.slice(0, 300)}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const mimeType = response.headers.get('content-type') || 'image/jpeg';
  return { buffer: Buffer.from(arrayBuffer), mimeType };
}
