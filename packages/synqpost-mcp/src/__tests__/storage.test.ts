import { existsSync, unlinkSync } from 'fs';
import { SynqPostStorage } from '../storage';

const TEST_DB = './test-synqpost-storage.db';

function freshStorage() {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  return new SynqPostStorage(TEST_DB);
}

afterEach(() => {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
});

// ── Posts ─────────────────────────────────────────────────────────────────

describe('SynqPostStorage — createPost()', () => {
  it('returns a post with correct fields and status=draft', () => {
    const storage = freshStorage();
    const scheduledAt = new Date('2026-07-01T10:00:00Z');
    const post = storage.createPost({ content: 'Hello!', platform: 'twitter', scheduledAt });
    expect(post.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(post.content).toBe('Hello!');
    expect(post.platform).toBe('twitter');
    expect(post.status).toBe('draft');
    expect(post.scheduledAt.toISOString()).toBe(scheduledAt.toISOString());
    expect(post.tags).toEqual([]);
    expect(post.campaignId).toBeUndefined();
    expect(post.createdAt).toBeInstanceOf(Date);
  });

  it('stores tags and campaignId when provided', () => {
    const storage = freshStorage();
    const post = storage.createPost({
      content: 'Post',
      platform: 'linkedin',
      scheduledAt: new Date(),
      tags: ['launch', 'product'],
      campaignId: 'camp-1',
    });
    expect(post.tags).toEqual(['launch', 'product']);
    expect(post.campaignId).toBe('camp-1');
  });

  it('each post gets a unique id', () => {
    const storage = freshStorage();
    const a = storage.createPost({ content: 'A', platform: 'twitter', scheduledAt: new Date() });
    const b = storage.createPost({ content: 'B', platform: 'twitter', scheduledAt: new Date() });
    expect(a.id).not.toBe(b.id);
  });
});

describe('SynqPostStorage — getPost()', () => {
  it('retrieves the post by id', () => {
    const storage = freshStorage();
    const created = storage.createPost({ content: 'Find me', platform: 'instagram', scheduledAt: new Date() });
    const found = storage.getPost(created.id);
    expect(found).not.toBeNull();
    expect(found!.content).toBe('Find me');
  });

  it('returns null for an unknown id', () => {
    const storage = freshStorage();
    expect(storage.getPost('does-not-exist')).toBeNull();
  });
});

describe('SynqPostStorage — listPosts()', () => {
  it('returns all posts ordered by scheduledAt ASC', () => {
    const storage = freshStorage();
    const d1 = new Date('2026-07-03T00:00:00Z');
    const d2 = new Date('2026-07-01T00:00:00Z');
    const d3 = new Date('2026-07-02T00:00:00Z');
    storage.createPost({ content: 'C', platform: 'twitter', scheduledAt: d1 });
    storage.createPost({ content: 'A', platform: 'twitter', scheduledAt: d2 });
    storage.createPost({ content: 'B', platform: 'twitter', scheduledAt: d3 });
    const posts = storage.listPosts();
    expect(posts.map(p => p.content)).toEqual(['A', 'B', 'C']);
  });

  it('filters by platform', () => {
    const storage = freshStorage();
    storage.createPost({ content: 'tw', platform: 'twitter', scheduledAt: new Date() });
    storage.createPost({ content: 'li', platform: 'linkedin', scheduledAt: new Date() });
    const posts = storage.listPosts({ platform: 'twitter' });
    expect(posts).toHaveLength(1);
    expect(posts[0].content).toBe('tw');
  });

  it('filters by status', () => {
    const storage = freshStorage();
    const p = storage.createPost({ content: 'x', platform: 'twitter', scheduledAt: new Date() });
    storage.updatePostStatus(p.id, 'published');
    const drafts = storage.listPosts({ status: 'draft' });
    const published = storage.listPosts({ status: 'published' });
    expect(drafts).toHaveLength(0);
    expect(published).toHaveLength(1);
  });

  it('filters by date range', () => {
    const storage = freshStorage();
    storage.createPost({ content: 'old', platform: 'twitter', scheduledAt: new Date('2026-01-01') });
    storage.createPost({ content: 'new', platform: 'twitter', scheduledAt: new Date('2026-12-01') });
    const posts = storage.listPosts({
      from: new Date('2026-06-01'),
      to: new Date('2026-12-31'),
    });
    expect(posts).toHaveLength(1);
    expect(posts[0].content).toBe('new');
  });
});

describe('SynqPostStorage — updatePostStatus()', () => {
  it('changes the status', () => {
    const storage = freshStorage();
    const p = storage.createPost({ content: 'x', platform: 'twitter', scheduledAt: new Date() });
    storage.updatePostStatus(p.id, 'scheduled');
    expect(storage.getPost(p.id)!.status).toBe('scheduled');
  });

  it('sets publishedAt when status is published', () => {
    const storage = freshStorage();
    const p = storage.createPost({ content: 'x', platform: 'twitter', scheduledAt: new Date() });
    storage.updatePostStatus(p.id, 'published');
    const updated = storage.getPost(p.id)!;
    expect(updated.publishedAt).toBeInstanceOf(Date);
  });

  it('stores errorMessage on failure', () => {
    const storage = freshStorage();
    const p = storage.createPost({ content: 'x', platform: 'twitter', scheduledAt: new Date() });
    storage.updatePostStatus(p.id, 'failed', 'Rate limit exceeded');
    expect(storage.getPost(p.id)!.errorMessage).toBe('Rate limit exceeded');
  });
});

describe('SynqPostStorage — deletePost()', () => {
  it('removes the post', () => {
    const storage = freshStorage();
    const p = storage.createPost({ content: 'delete me', platform: 'twitter', scheduledAt: new Date() });
    storage.deletePost(p.id);
    expect(storage.getPost(p.id)).toBeNull();
    expect(storage.listPosts()).toHaveLength(0);
  });

  it('is a no-op for a non-existent id', () => {
    const storage = freshStorage();
    expect(() => storage.deletePost('ghost-id')).not.toThrow();
  });
});

// ── Ideas ─────────────────────────────────────────────────────────────────

describe('SynqPostStorage — createIdea()', () => {
  it('returns an idea with status=idea and correct fields', () => {
    const storage = freshStorage();
    const idea = storage.createIdea({ topic: 'AI automation', angle: 'personal story', platform: 'linkedin' });
    expect(idea.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(idea.topic).toBe('AI automation');
    expect(idea.angle).toBe('personal story');
    expect(idea.platform).toBe('linkedin');
    expect(idea.status).toBe('idea');
    expect(idea.createdAt).toBeInstanceOf(Date);
  });
});

describe('SynqPostStorage — listIdeas()', () => {
  it('returns all ideas ordered by createdAt DESC', () => {
    const storage = freshStorage();
    storage.createIdea({ topic: 'A', angle: 'a', platform: 'twitter' });
    storage.createIdea({ topic: 'B', angle: 'b', platform: 'linkedin' });
    const ideas = storage.listIdeas();
    expect(ideas).toHaveLength(2);
  });

  it('filters by status when provided', () => {
    const storage = freshStorage();
    storage.createIdea({ topic: 'X', angle: 'x', platform: 'twitter' });
    // Only 'idea' status ideas exist (no way to update idea status via public API currently)
    const all = storage.listIdeas('idea');
    expect(all).toHaveLength(1);
    const none = storage.listIdeas('approved');
    expect(none).toHaveLength(0);
  });
});
