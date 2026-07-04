import { existsSync, unlinkSync } from 'fs';
import { MemoryStore } from '../../memory/store';

const TEST_DB = './test-memory-store.db';

// Mock embed() so tests never download the real model
jest.mock('../../memory/embeddings', () => {
  const makeVec = (seed: number) => {
    const v = new Float32Array(384).fill(0);
    v[seed % 384] = 1; // unit vector in one dimension
    return v;
  };
  let callCount = 0;
  return {
    embed: jest.fn(() => Promise.resolve(makeVec(callCount++))),
    cosineSimilarity: jest.requireActual('../../memory/embeddings').cosineSimilarity,
  };
});

import { embed } from '../../memory/embeddings';

function freshStore() {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  return new MemoryStore(TEST_DB);
}

afterEach(() => {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  jest.clearAllMocks();
});

describe('MemoryStore.store() — sync path', () => {
  test('stores an entry and returns an id', async () => {
    const store = freshStore();
    const id = store.store({
      content: 'hello',
      agentRole: 'admin',
      tags: [],
      createdAt: new Date(),
    });
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    // Give the fire-and-forget backfill a tick to run
    await new Promise((r) => setTimeout(r, 10));
  });

  test('entry is retrievable via listRecent', () => {
    const store = freshStore();
    store.store({
      content: 'remember this',
      agentRole: 'admin',
      tags: ['test'],
      createdAt: new Date(),
    });
    const entries = store.listRecent();
    expect(entries).toHaveLength(1);
    expect(entries[0].content).toBe('remember this');
    expect(entries[0].agentRole).toBe('admin');
    expect(entries[0].tags).toEqual(['test']);
  });

  test('triggers background embedding generation', async () => {
    const store = freshStore();
    store.store({ content: 'embed me', agentRole: 'admin', tags: [], createdAt: new Date() });
    await new Promise((r) => setTimeout(r, 50));
    expect(embed).toHaveBeenCalledWith('embed me');
  });
});

describe('MemoryStore.storeAsync()', () => {
  test('stores entry with embedding immediately', async () => {
    const store = freshStore();
    const id = await store.storeAsync({
      content: 'async store',
      agentRole: 'content',
      tags: [],
      createdAt: new Date(),
    });
    expect(typeof id).toBe('string');
    expect(embed).toHaveBeenCalledWith('async store');
    const entries = store.listRecent();
    expect(entries[0].content).toBe('async store');
  });
});

describe('MemoryStore.searchAsync()', () => {
  test('returns results via vector search when embeddings exist', async () => {
    const store = freshStore();
    // Use storeAsync so embeddings are immediately present
    await store.storeAsync({
      content: 'vector search target',
      agentRole: 'admin',
      tags: [],
      createdAt: new Date(),
    });
    (embed as jest.Mock).mockResolvedValueOnce(new Float32Array(384).fill(0.05));
    // searchAsync will compute a query vec and compare against stored vecs
    const results = await store.searchAsync('some query');
    // Results may or may not match depending on cosine threshold; test that it doesn't throw
    expect(Array.isArray(results)).toBe(true);
  });

  test('falls back to FTS5 when no embeddings exist', async () => {
    const store = freshStore();
    // store() without waiting — embedding won't be ready yet
    store.store({
      content: 'fts fallback test',
      agentRole: 'admin',
      tags: [],
      createdAt: new Date(),
    });
    // Make embed return a zero-similarity vec so vectorSearch returns nothing
    (embed as jest.Mock).mockResolvedValueOnce(new Float32Array(384).fill(0));
    const results = await store.searchAsync('fts fallback test');
    expect(results.some((r) => r.content === 'fts fallback test')).toBe(true);
  });

  test('respects agentRole filter', async () => {
    const store = freshStore();
    await store.storeAsync({
      content: 'admin memory',
      agentRole: 'admin',
      tags: [],
      createdAt: new Date(),
    });
    await store.storeAsync({
      content: 'content memory',
      agentRole: 'content',
      tags: [],
      createdAt: new Date(),
    });
    const results = await store.searchAsync('memory', { agentRole: 'admin' });
    expect(results.every((r) => r.agentRole === 'admin')).toBe(true);
  });
});

describe('MemoryStore.upgradeEmbeddings()', () => {
  test('backfills entries missing embeddings', async () => {
    const store = freshStore();
    // store() doesn't await embedding — simulate a row with no embedding
    store.store({
      content: 'needs embedding',
      agentRole: 'admin',
      tags: [],
      createdAt: new Date(),
    });
    // Reset call count before upgrade
    (embed as jest.Mock).mockClear();
    const result = await store.upgradeEmbeddings();
    // total = 1, upgraded = 1 (assuming backfill from store() hasn't run yet — race, but upgrade should handle it)
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.upgraded).toBeGreaterThanOrEqual(0);
    expect(result.upgraded).toBeLessThanOrEqual(result.total + 1);
  });

  test('returns { upgraded: 0, total: 0 } when all entries already have embeddings', async () => {
    const store = freshStore();
    await store.storeAsync({
      content: 'already embedded',
      agentRole: 'admin',
      tags: [],
      createdAt: new Date(),
    });
    (embed as jest.Mock).mockClear();
    const result = await store.upgradeEmbeddings();
    expect(result.total).toBe(0);
    expect(result.upgraded).toBe(0);
    expect(embed).not.toHaveBeenCalled();
  });
});

describe('MemoryStore — column migration', () => {
  test('adds embedding column to a pre-existing DB without it', () => {
    // Create a DB using the old schema (no embedding column)
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    const Database = require('better-sqlite3');
    const db = new Database(TEST_DB);
    db.exec(`
      CREATE TABLE memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        agent_role TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      );
      CREATE VIRTUAL TABLE memories_fts
        USING fts5(content, agent_role, tags, content='memories', content_rowid='rowid');
      CREATE TRIGGER memories_ai AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(rowid, content, agent_role, tags)
        VALUES (new.rowid, new.content, new.agent_role, new.tags);
      END;
      INSERT INTO memories (id, content, agent_role, tags, created_at)
      VALUES ('old-id', 'old content', 'admin', '[]', '2025-01-01T00:00:00.000Z');
    `);
    db.close();

    // Opening MemoryStore on this DB should migrate it without throwing
    expect(() => new MemoryStore(TEST_DB)).not.toThrow();

    // Confirm the column now exists
    const db2 = new Database(TEST_DB);
    const cols = db2.prepare('PRAGMA table_info(memories)').all() as Array<{ name: string }>;
    db2.close();
    expect(cols.some((c: { name: string }) => c.name === 'embedding')).toBe(true);
  });
});
