jest.mock('../publishers', () => ({ publishToPlatform: jest.fn() }));

import { existsSync, unlinkSync } from 'fs';
import { MCPClient } from '@wireassist/core';
import { distributeDates, timelineWeekNumber, parseJson, registerTrendPostTools } from '../tools';
import { TrendPostStorage } from '../storage';
import { publishToPlatform } from '../publishers';

const TEST_DB = './test-trendpost-tools.db';
const mockPublishToPlatform = publishToPlatform as jest.Mock;

describe('distributeDates()', () => {
  it('returns an empty array for count <= 0', () => {
    expect(distributeDates(0, 1)).toEqual([]);
    expect(distributeDates(-1, 1)).toEqual([]);
  });

  it('spreads count items evenly across the weeksAhead*7-day window', () => {
    const from = new Date('2026-06-01T00:00:00Z');
    const dates = distributeDates(3, 1, from);
    expect(dates).toHaveLength(3);
    // Window is 7 days starting tomorrow (2026-06-02); 3 items step ~2.33 days apart.
    expect(dates[0].getUTCDate()).toBe(2);
    expect(dates[1].getUTCDate()).toBeGreaterThan(dates[0].getUTCDate());
    expect(dates[2].getUTCDate()).toBeGreaterThan(dates[1].getUTCDate());
  });

  it('starts strictly after "from" (never schedules for today)', () => {
    const from = new Date('2026-06-01T15:00:00Z');
    const [first] = distributeDates(1, 1, from);
    expect(first.getTime()).toBeGreaterThan(from.getTime());
  });

  it('produces dates in ascending order', () => {
    const dates = distributeDates(5, 2, new Date('2026-06-01T00:00:00Z'));
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i].getTime()).toBeGreaterThanOrEqual(dates[i - 1].getTime());
    }
  });
});

describe('timelineWeekNumber()', () => {
  it('parses a leading integer from the label', () => {
    expect(timelineWeekNumber('Week 1', 0)).toBe(1);
    expect(timelineWeekNumber('Week 2: Launch', 0)).toBe(2);
  });

  it('falls back to the 1-indexed position when the label has no number', () => {
    expect(timelineWeekNumber('Pre-launch', 0)).toBe(1);
    expect(timelineWeekNumber('Pre-launch', 2)).toBe(3);
  });
});

describe('parseJson()', () => {
  it('parses a plain JSON object with no surrounding text', () => {
    expect(parseJson<{ a: number }>('{"a": 1}', 'test')).toEqual({ a: 1 });
  });

  it('parses JSON wrapped in ```json fences with nothing else', () => {
    expect(parseJson<{ a: number }>('```json\n{"a": 1}\n```', 'test')).toEqual({ a: 1 });
  });

  // The real live failure this fixes: content_analyze's model response
  // sometimes includes prose around the object despite "return only JSON,
  // no markdown fences" — the old anchored-at-start/end regex only handled
  // a fence with nothing else around it.
  it('parses JSON with a leading sentence of prose', () => {
    expect(parseJson<{ a: number }>('Here is my analysis:\n{"a": 1}', 'test')).toEqual({ a: 1 });
  });

  it('parses JSON with trailing prose after the object', () => {
    expect(
      parseJson<{ a: number }>('{"a": 1}\nLet me know if you want more detail.', 'test')
    ).toEqual({ a: 1 });
  });

  it('handles nested objects correctly (does not truncate at the first inner "}")', () => {
    const input = '{"score": 5, "nested": {"b": 2}}';
    expect(parseJson<{ score: number; nested: { b: number } }>(input, 'test')).toEqual({
      score: 5,
      nested: { b: 2 },
    });
  });

  it('throws a labeled error (not a silent garbage result) on genuinely malformed JSON', () => {
    expect(() => parseJson('{"a": }', 'content_analyze')).toThrow(
      /content_analyze returned unparseable JSON/
    );
  });

  // Real live failure, 2026-09-05: content_generate_plan returns a JSON
  // array, not an object. The old {..}-only bracket matching skipped the
  // enclosing [ ] entirely, turning a complete, well-formed 5-item array
  // into several comma-separated objects with no wrapper — invalid JSON,
  // even though the model's actual response was never truncated or wrong.
  it('parses a plain JSON array with no surrounding text', () => {
    expect(parseJson<Array<{ a: number }>>('[{"a": 1}, {"a": 2}]', 'test')).toEqual([
      { a: 1 },
      { a: 2 },
    ]);
  });

  it('parses a JSON array wrapped in prose', () => {
    expect(
      parseJson<Array<{ a: number }>>('Here is the plan:\n[{"a": 1}, {"a": 2}]\nEnjoy!', 'test')
    ).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('parses a JSON array whose items are objects containing braces in string values', () => {
    // Guards against a naive fix that just switches to always matching [ ]
    // — the array-vs-object detection has to pick whichever bracket type
    // genuinely opens the value first, not just prefer one unconditionally.
    const input = '[{"topic": "uses a { character in prose"}]';
    expect(parseJson<Array<{ topic: string }>>(input, 'test')).toEqual([
      { topic: 'uses a { character in prose' },
    ]);
  });
});

describe('content_list_posts — dueOnly', () => {
  function freshTools() {
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    const storage = new TrendPostStorage(TEST_DB);
    const mcp = new MCPClient();
    registerTrendPostTools(mcp, storage);
    return { storage, mcp };
  }

  afterEach(() => {
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  });

  it('returns only scheduled posts at or before now, regardless of daysAhead', async () => {
    const { storage, mcp } = freshTools();
    const past = storage.createPost({
      content: 'due',
      platform: 'twitter',
      scheduledAt: new Date(Date.now() - 60_000),
    });
    storage.createPost({
      content: 'future',
      platform: 'twitter',
      scheduledAt: new Date(Date.now() + 60 * 60_000),
    });

    const due = (await mcp.call('content_list_posts', {
      status: 'scheduled',
      dueOnly: true,
    })) as { id: string }[];

    expect(due.map((p) => p.id)).toEqual([past.id]);
  });

  it('without dueOnly, keeps the existing from-now-forward behavior', async () => {
    const { storage, mcp } = freshTools();
    storage.createPost({
      content: 'past',
      platform: 'twitter',
      scheduledAt: new Date(Date.now() - 60_000),
    });
    const future = storage.createPost({
      content: 'future',
      platform: 'twitter',
      scheduledAt: new Date(Date.now() + 60 * 60_000),
    });

    const upcoming = (await mcp.call('content_list_posts', { status: 'scheduled' })) as {
      id: string;
    }[];

    expect(upcoming.map((p) => p.id)).toEqual([future.id]);
  });

  it('daysAgo returns only posts scheduled within the backward-looking window', async () => {
    const { storage, mcp } = freshTools();
    const recent = storage.createPost({
      content: 'recent',
      platform: 'twitter',
      scheduledAt: new Date(Date.now() - 2 * 24 * 60 * 60_000),
    });
    storage.createPost({
      content: 'too old',
      platform: 'twitter',
      scheduledAt: new Date(Date.now() - 10 * 24 * 60 * 60_000),
    });
    storage.createPost({
      content: 'future',
      platform: 'twitter',
      scheduledAt: new Date(Date.now() + 60 * 60_000),
    });

    const withinWindow = (await mcp.call('content_list_posts', {
      daysAgo: 5,
    })) as { id: string }[];

    expect(withinWindow.map((p) => p.id)).toEqual([recent.id]);
  });
});

describe('content_publish_post', () => {
  function freshTools() {
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    const storage = new TrendPostStorage(TEST_DB);
    const mcp = new MCPClient();
    registerTrendPostTools(mcp, storage);
    return { storage, mcp };
  }

  beforeEach(() => {
    mockPublishToPlatform.mockReset();
  });

  afterEach(() => {
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  });

  it('publishes successfully: sets status published and stores the platformPostId', async () => {
    const { storage, mcp } = freshTools();
    const post = storage.createPost({
      content: 'hi',
      platform: 'twitter',
      scheduledAt: new Date(),
    });
    mockPublishToPlatform.mockResolvedValue({ platformPostId: 'tw-1' });

    const result = (await mcp.call('content_publish_post', { postId: post.id })) as {
      status: string;
      platformPostId?: string;
    };

    expect(mockPublishToPlatform).toHaveBeenCalledWith('twitter', 'hi');
    expect(result.status).toBe('published');
    expect(result.platformPostId).toBe('tw-1');
  });

  it('on publisher failure, sets status failed with the error message instead of throwing', async () => {
    const { storage, mcp } = freshTools();
    const post = storage.createPost({
      content: 'hi',
      platform: 'instagram',
      scheduledAt: new Date(),
    });
    mockPublishToPlatform.mockRejectedValue(new Error('missing INSTAGRAM_DEFAULT_IMAGE_URL'));

    const result = (await mcp.call('content_publish_post', { postId: post.id })) as {
      status: string;
      errorMessage?: string;
    };

    expect(result.status).toBe('failed');
    expect(result.errorMessage).toBe('missing INSTAGRAM_DEFAULT_IMAGE_URL');
  });

  it('throws for an unknown postId', async () => {
    const { mcp } = freshTools();
    await expect(mcp.call('content_publish_post', { postId: 'nope' })).rejects.toThrow(
      /No post found/
    );
  });
});
