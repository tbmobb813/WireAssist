// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EmbedderFn = (text: string, options: Record<string, unknown>) => Promise<any>;

let _embedder: EmbedderFn | null = null;
let _loading: Promise<EmbedderFn> | null = null;

// Bypass TypeScript's CommonJS downlevelling of import() → require().
// @xenova/transformers is ESM-only; require() would throw ERR_REQUIRE_ESM.
const _dynamicImport = new Function('m', 'return import(m)') as (m: string) => Promise<unknown>;

export async function getEmbedder(): Promise<EmbedderFn> {
  if (_embedder) return _embedder;
  if (_loading) return _loading;

  _loading = (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { pipeline, env } = (await _dynamicImport('@xenova/transformers')) as any;
      // Silence HuggingFace download progress bars in server logs
      env.allowLocalModels = false;
      const embedder = (await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2'
      )) as EmbedderFn;
      _embedder = embedder;
      return embedder;
    } catch (err) {
      // Reset so a later call can attempt to load again (e.g. after a transient network failure)
      _loading = null;
      throw err;
    }
  })();
  return _loading;
}

export async function embed(text: string): Promise<Float32Array> {
  const embedder = await getEmbedder();
  const output = await embedder(text, { pooling: 'mean', normalize: true });
  // Copy to ensure byteOffset=0 regardless of internal Tensor layout
  const raw: Float32Array = output.data;
  const copy = new Float32Array(raw.length);
  copy.set(raw);
  return copy;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}
