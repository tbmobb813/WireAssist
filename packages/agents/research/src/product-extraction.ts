export interface ExtractedProduct {
  title?: string;
  price?: string;
  currency?: string;
  availability?: string;
}

// Pulls Schema.org Product/Offer data out of raw HTML's JSON-LD blocks — the
// same structured data retailers embed for Google's rich-snippet pricing, so
// it's a stable, low-maintenance extraction target: no per-site CSS
// selectors to keep patching as retailer markup changes, and it works on a
// plain static fetch (no JS rendering needed, since this is exactly the data
// retailers serve to non-JS crawlers on purpose).
export function extractProductFromJsonLd(html: string): ExtractedProduct | null {
  for (const block of extractJsonLdBlocks(html)) {
    const product = findProductNode(block);
    if (product) return productNodeToResult(product);
  }
  return null;
}

function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(match[1].trim()));
    } catch {
      // Malformed JSON-LD (trailing commas, unescaped entities) is common
      // enough that one bad block shouldn't abort the whole page.
    }
  }
  return blocks;
}

function isProductType(type: unknown): boolean {
  if (typeof type === 'string') return type === 'Product';
  if (Array.isArray(type)) return type.includes('Product');
  return false;
}

// JSON-LD nests in a few different shapes in the wild: a bare Product
// object, an array of nodes, or an @graph wrapper. Walk all three.
function findProductNode(node: unknown): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findProductNode(item);
      if (found) return found;
    }
    return null;
  }
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (isProductType(obj['@type'])) return obj;
    if (Array.isArray(obj['@graph'])) return findProductNode(obj['@graph']);
  }
  return null;
}

function priceLike(value: unknown): string | undefined {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

function productNodeToResult(product: Record<string, unknown>): ExtractedProduct {
  const title = typeof product.name === 'string' ? product.name : undefined;

  let offers = product.offers;
  if (Array.isArray(offers)) offers = offers[0];
  const offer = (offers && typeof offers === 'object' ? offers : {}) as Record<string, unknown>;

  // AggregateOffer uses lowPrice/highPrice instead of a single `price`.
  const price = priceLike(offer.price) ?? priceLike(offer.lowPrice);
  const currency = typeof offer.priceCurrency === 'string' ? offer.priceCurrency : undefined;

  // Schema.org availability is a full URL (e.g. schema.org/InStock) — trim
  // to the trailing segment for a plain value.
  const rawAvailability = typeof offer.availability === 'string' ? offer.availability : undefined;
  const availability = rawAvailability?.split('/').pop();

  return { title, price, currency, availability };
}
