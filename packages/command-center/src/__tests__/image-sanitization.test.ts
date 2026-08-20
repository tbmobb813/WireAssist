// Inlined from server.ts's sanitizeImages() to test without importing the
// full server (which bootstraps agents) — same approach as
// nudge-input-validation.test.ts's resolveThresholdPercent()/resolveDaysStale().

interface ImageAttachment {
  mediaType: string;
  data: string;
}

const MAX_IMAGES_PER_MESSAGE = 4;
const MAX_IMAGE_BASE64_BYTES = 9 * 1024 * 1024;
const ALLOWED_IMAGE_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

function sanitizeImages(raw: unknown): ImageAttachment[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const images = raw.filter(
    (img): img is ImageAttachment =>
      !!img &&
      typeof img === 'object' &&
      typeof (img as ImageAttachment).mediaType === 'string' &&
      ALLOWED_IMAGE_MEDIA_TYPES.has((img as ImageAttachment).mediaType) &&
      typeof (img as ImageAttachment).data === 'string' &&
      (img as ImageAttachment).data.length > 0 &&
      (img as ImageAttachment).data.length <= MAX_IMAGE_BASE64_BYTES
  );
  return images.length > 0 ? images.slice(0, MAX_IMAGES_PER_MESSAGE) : undefined;
}

describe('sanitizeImages()', () => {
  it('returns undefined for non-array input', () => {
    expect(sanitizeImages(undefined)).toBeUndefined();
    expect(sanitizeImages(null)).toBeUndefined();
    expect(sanitizeImages('not an array')).toBeUndefined();
    expect(sanitizeImages({ mediaType: 'image/png', data: 'x' })).toBeUndefined();
  });

  it('returns undefined for an empty array', () => {
    expect(sanitizeImages([])).toBeUndefined();
  });

  it('passes through valid images unchanged', () => {
    const images = [
      { mediaType: 'image/png', data: 'abc' },
      { mediaType: 'image/jpeg', data: 'def' },
    ];
    expect(sanitizeImages(images)).toEqual(images);
  });

  it('drops entries with an unsupported media type', () => {
    const images = [
      { mediaType: 'image/png', data: 'abc' },
      { mediaType: 'application/pdf', data: 'def' },
      { mediaType: 'image/svg+xml', data: 'ghi' },
    ];
    expect(sanitizeImages(images)).toEqual([{ mediaType: 'image/png', data: 'abc' }]);
  });

  it('drops malformed entries (missing fields, wrong types, null)', () => {
    const images = [
      { mediaType: 'image/png', data: 'abc' },
      { mediaType: 'image/png' }, // missing data
      { data: 'abc' }, // missing mediaType
      null,
      'not an object',
      { mediaType: 123, data: 'abc' }, // wrong type
      { mediaType: 'image/png', data: '' }, // empty data
    ];
    expect(sanitizeImages(images)).toEqual([{ mediaType: 'image/png', data: 'abc' }]);
  });

  it('drops an image whose base64 data exceeds the 9 MB cap', () => {
    const tooLarge = { mediaType: 'image/png', data: 'x'.repeat(9 * 1024 * 1024 + 1) };
    const okSize = { mediaType: 'image/png', data: 'x'.repeat(9 * 1024 * 1024) };
    expect(sanitizeImages([tooLarge])).toBeUndefined();
    expect(sanitizeImages([okSize])).toEqual([okSize]);
  });

  it('caps the result at 4 images, keeping the first 4', () => {
    const images = Array.from({ length: 6 }, (_, i) => ({
      mediaType: 'image/png',
      data: `img-${i}`,
    }));
    const result = sanitizeImages(images);
    expect(result).toHaveLength(4);
    expect(result).toEqual(images.slice(0, 4));
  });
});
