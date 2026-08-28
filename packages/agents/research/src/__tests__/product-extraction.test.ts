import { extractProductFromJsonLd } from '../product-extraction';

function htmlWithJsonLd(json: unknown): string {
  return `<html><head><script type="application/ld+json">${JSON.stringify(json)}</script></head><body></body></html>`;
}

describe('extractProductFromJsonLd', () => {
  it('extracts a bare Product object with a single Offer', () => {
    const html = htmlWithJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Widget 3000',
      offers: {
        '@type': 'Offer',
        price: '29.99',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
    });

    expect(extractProductFromJsonLd(html)).toEqual({
      title: 'Widget 3000',
      price: '29.99',
      currency: 'USD',
      availability: 'InStock',
    });
  });

  it('finds a Product node inside an @graph array', () => {
    const html = htmlWithJsonLd({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'BreadcrumbList', itemListElement: [] },
        {
          '@type': 'Product',
          name: 'Graph Widget',
          offers: { '@type': 'Offer', price: 15, priceCurrency: 'USD' },
        },
      ],
    });

    const result = extractProductFromJsonLd(html);
    expect(result?.title).toBe('Graph Widget');
    expect(result?.price).toBe('15');
  });

  it('finds a Product node inside a top-level array of nodes', () => {
    const html = htmlWithJsonLd([
      { '@type': 'WebPage' },
      { '@type': 'Product', name: 'Array Widget', offers: { price: '9.99', priceCurrency: 'USD' } },
    ]);

    expect(extractProductFromJsonLd(html)?.title).toBe('Array Widget');
  });

  it('takes the first offer when `offers` is an array', () => {
    const html = htmlWithJsonLd({
      '@type': 'Product',
      name: 'Multi-Offer Widget',
      offers: [
        { '@type': 'Offer', price: '19.99', priceCurrency: 'USD' },
        { '@type': 'Offer', price: '24.99', priceCurrency: 'USD' },
      ],
    });

    expect(extractProductFromJsonLd(html)?.price).toBe('19.99');
  });

  it('falls back to lowPrice for an AggregateOffer', () => {
    const html = htmlWithJsonLd({
      '@type': 'Product',
      name: 'Aggregate Widget',
      offers: {
        '@type': 'AggregateOffer',
        lowPrice: '12.00',
        highPrice: '18.00',
        priceCurrency: 'USD',
      },
    });

    expect(extractProductFromJsonLd(html)?.price).toBe('12.00');
  });

  it('skips a malformed JSON-LD block instead of throwing', () => {
    const html =
      '<script type="application/ld+json">{not valid json,,,}</script>' +
      htmlWithJsonLd({ '@type': 'Product', name: 'Recovered Widget', offers: { price: '5.00' } });

    expect(extractProductFromJsonLd(html)?.title).toBe('Recovered Widget');
  });

  it('returns null when no JSON-LD block exists', () => {
    expect(
      extractProductFromJsonLd('<html><body>no structured data here</body></html>')
    ).toBeNull();
  });

  it('returns null when JSON-LD exists but has no Product node', () => {
    const html = htmlWithJsonLd({ '@type': 'Organization', name: 'Some Retailer' });
    expect(extractProductFromJsonLd(html)).toBeNull();
  });

  it('handles a Product with no offers at all (title only, no price)', () => {
    const html = htmlWithJsonLd({ '@type': 'Product', name: 'Priceless Widget' });
    const result = extractProductFromJsonLd(html);
    expect(result?.title).toBe('Priceless Widget');
    expect(result?.price).toBeUndefined();
  });
});
