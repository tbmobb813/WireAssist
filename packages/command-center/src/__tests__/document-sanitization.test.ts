// Inlined from server.ts's sanitizeDocuments() to test without importing the
// full server (which bootstraps agents) — same approach as
// image-sanitization.test.ts's sanitizeImages().

interface DocumentAttachment {
  mediaType: string;
  data: string;
  filename?: string;
}

const MAX_DOCUMENTS_PER_MESSAGE = 4;
const MAX_DOCUMENT_BASE64_BYTES = 30 * 1024 * 1024;
const ALLOWED_DOCUMENT_MEDIA_TYPES = new Set(['application/pdf', 'text/plain']);

function sanitizeDocuments(raw: unknown): DocumentAttachment[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const documents = raw.filter(
    (doc): doc is DocumentAttachment =>
      !!doc &&
      typeof doc === 'object' &&
      typeof (doc as DocumentAttachment).mediaType === 'string' &&
      ALLOWED_DOCUMENT_MEDIA_TYPES.has((doc as DocumentAttachment).mediaType) &&
      typeof (doc as DocumentAttachment).data === 'string' &&
      (doc as DocumentAttachment).data.length > 0 &&
      (doc as DocumentAttachment).data.length <= MAX_DOCUMENT_BASE64_BYTES &&
      (doc.filename === undefined || typeof doc.filename === 'string')
  );
  return documents.length > 0 ? documents.slice(0, MAX_DOCUMENTS_PER_MESSAGE) : undefined;
}

describe('sanitizeDocuments()', () => {
  it('returns undefined for non-array input', () => {
    expect(sanitizeDocuments(undefined)).toBeUndefined();
    expect(sanitizeDocuments(null)).toBeUndefined();
    expect(sanitizeDocuments('not an array')).toBeUndefined();
    expect(sanitizeDocuments({ mediaType: 'application/pdf', data: 'x' })).toBeUndefined();
  });

  it('returns undefined for an empty array', () => {
    expect(sanitizeDocuments([])).toBeUndefined();
  });

  it('passes through valid documents unchanged', () => {
    const documents = [
      { mediaType: 'application/pdf', data: 'abc', filename: 'a.pdf' },
      { mediaType: 'text/plain', data: 'def', filename: 'b.txt' },
    ];
    expect(sanitizeDocuments(documents)).toEqual(documents);
  });

  it('passes through a valid document with no filename', () => {
    const documents = [{ mediaType: 'application/pdf', data: 'abc' }];
    expect(sanitizeDocuments(documents)).toEqual(documents);
  });

  it('drops entries with an unsupported media type', () => {
    const documents = [
      { mediaType: 'application/pdf', data: 'abc' },
      { mediaType: 'image/png', data: 'def' },
      { mediaType: 'application/msword', data: 'ghi' },
    ];
    expect(sanitizeDocuments(documents)).toEqual([{ mediaType: 'application/pdf', data: 'abc' }]);
  });

  it('drops malformed entries (missing fields, wrong types, null)', () => {
    const documents = [
      { mediaType: 'application/pdf', data: 'abc' },
      { mediaType: 'application/pdf' }, // missing data
      { data: 'abc' }, // missing mediaType
      null,
      'not an object',
      { mediaType: 123, data: 'abc' }, // wrong type
      { mediaType: 'application/pdf', data: '' }, // empty data
      { mediaType: 'application/pdf', data: 'abc', filename: 123 }, // wrong filename type
    ];
    expect(sanitizeDocuments(documents)).toEqual([{ mediaType: 'application/pdf', data: 'abc' }]);
  });

  it('drops a document whose base64 data exceeds the 30 MB cap', () => {
    const tooLarge = { mediaType: 'application/pdf', data: 'x'.repeat(30 * 1024 * 1024 + 1) };
    const okSize = { mediaType: 'application/pdf', data: 'x'.repeat(30 * 1024 * 1024) };
    expect(sanitizeDocuments([tooLarge])).toBeUndefined();
    expect(sanitizeDocuments([okSize])).toEqual([okSize]);
  });

  it('caps the result at 4 documents, keeping the first 4', () => {
    const documents = Array.from({ length: 6 }, (_, i) => ({
      mediaType: 'application/pdf',
      data: `doc-${i}`,
    }));
    const result = sanitizeDocuments(documents);
    expect(result).toHaveLength(4);
    expect(result).toEqual(documents.slice(0, 4));
  });
});
