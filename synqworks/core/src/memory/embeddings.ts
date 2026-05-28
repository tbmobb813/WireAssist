// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EmbedderFn = (text: string, options: Record<string, unknown>) => Promise<any>;

let _embedder: EmbedderFn | null = null;
let _loading: Promise<EmbedderFn> | null = null;

export async function getEmbedder(): Promise<EmbedderFn> {
  if (_embedder) return _embedder;
  if (_loading) return _loading;

  _loading = (async () => {
    // Dynamic import keeps ESM-only @xenova/transformers out of the CommonJS require graph
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { pipeline, env } = await import('@xenova/transformers') as any;
    // Silence noisy HuggingFace progress bars in server logs
    env.allowLocalModels = false;
    _embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    return _embedder as EmbedderFn;
  })();
  return _loading;
}

export async function embed(text: string): Promise<Float32Array> {
  const embedder = await getEmbedder();
  const output = await embedder(text, { pooling: 'mean', normalize: true });
  // output.data is Float32Array; copy to ensure clean byteOffset=0 view
  const raw: Float32Array = output.data;
  const copy = new Float32Array(raw.length);
  copy.set(raw);
  return copy;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}
