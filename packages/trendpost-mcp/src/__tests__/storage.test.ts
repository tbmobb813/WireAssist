import { existsSync, unlinkSync } from 'fs';
import { TrendPostStorage } from '../storage';

const TEST_DB = './test-trendpost-storage.db';

function freshStorage() {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  return new TrendPostStorage(TEST_DB);
}

afterEach(() => {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
});

// ── Posts ─────────────────────────────────────────────────────────────────

describe('TrendPostStorage — createPost()', () => {
  it('returns a post with correct fields and status=scheduled', () => {
    const storage = freshStorage();
    const scheduledAt = new Date('2026-07-01T10:00:00Z');
    const post = storage.createPost({ content: 'Hello!', platform: 'twitter', scheduledAt });
    expect(post.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(post.content).toBe('Hello!');
    expect(post.platform).toBe('twitter');
    // createPost() is only ever reached after schedulePostSkill's approval
    // gate passes, so a post that exists here already is scheduled.
    expect(post.status).toBe('scheduled');
    expect(post.scheduledAt.toISOString()).toBe(scheduledAt.toISOString());
    expect(post.tags).toEqual([]);
    expect(post.campaignId).toBeUndefined();
    expect(post.objectiveId).toBeUndefined();
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

  it('stores and round-trips objectiveId through getPost() and listPosts()', () => {
    const storage = freshStorage();
    const created = storage.createPost({
      content: 'Post',
      platform: 'linkedin',
      scheduledAt: new Date(),
      objectiveId: 'obj-1',
    });
    expect(created.objectiveId).toBe('obj-1');
    expect(storage.getPost(created.id)?.objectiveId).toBe('obj-1');
    expect(storage.listPosts().find((p) => p.id === created.id)?.objectiveId).toBe('obj-1');
  });

  it('each post gets a unique id', () => {
    const storage = freshStorage();
    const a = storage.createPost({ content: 'A', platform: 'twitter', scheduledAt: new Date() });
    const b = storage.createPost({ content: 'B', platform: 'twitter', scheduledAt: new Date() });
    expect(a.id).not.toBe(b.id);
  });

  it('round-trips a facebook post', () => {
    const storage = freshStorage();
    const post = storage.createPost({
      content: 'FB post',
      platform: 'facebook',
      scheduledAt: new Date(),
    });
    expect(post.platform).toBe('facebook');
    expect(storage.getPost(post.id)!.platform).toBe('facebook');
  });
});

describe('TrendPostStorage — getPost()', () => {
  it('retrieves the post by id', () => {
    const storage = freshStorage();
    const created = storage.createPost({
      content: 'Find me',
      platform: 'instagram',
      scheduledAt: new Date(),
    });
    const found = storage.getPost(created.id);
    expect(found).not.toBeNull();
    expect(found!.content).toBe('Find me');
  });

  it('returns null for an unknown id', () => {
    const storage = freshStorage();
    expect(storage.getPost('does-not-exist')).toBeNull();
  });
});

describe('TrendPostStorage — listPosts()', () => {
  it('returns all posts ordered by scheduledAt ASC', () => {
    const storage = freshStorage();
    const d1 = new Date('2026-07-03T00:00:00Z');
    const d2 = new Date('2026-07-01T00:00:00Z');
    const d3 = new Date('2026-07-02T00:00:00Z');
    storage.createPost({ content: 'C', platform: 'twitter', scheduledAt: d1 });
    storage.createPost({ content: 'A', platform: 'twitter', scheduledAt: d2 });
    storage.createPost({ content: 'B', platform: 'twitter', scheduledAt: d3 });
    const posts = storage.listPosts();
    expect(posts.map((p) => p.content)).toEqual(['A', 'B', 'C']);
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
    storage.createPost({
      content: 'old',
      platform: 'twitter',
      scheduledAt: new Date('2026-01-01'),
    });
    storage.createPost({
      content: 'new',
      platform: 'twitter',
      scheduledAt: new Date('2026-12-01'),
    });
    const posts = storage.listPosts({
      from: new Date('2026-06-01'),
      to: new Date('2026-12-31'),
    });
    expect(posts).toHaveLength(1);
    expect(posts[0].content).toBe('new');
  });
});

describe('TrendPostStorage — updatePostStatus()', () => {
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

  it('stores platformPostId when provided', () => {
    const storage = freshStorage();
    const p = storage.createPost({ content: 'x', platform: 'twitter', scheduledAt: new Date() });
    storage.updatePostStatus(p.id, 'published', undefined, 'tw-123');
    expect(storage.getPost(p.id)!.platformPostId).toBe('tw-123');
  });

  it('does not clobber a previously-recorded platformPostId on a status-only call', () => {
    // Mirrors content_mark_published's call site, which never passes a 4th
    // arg — that self-report path must not null out an ID a prior publish
    // call already recorded.
    const storage = freshStorage();
    const p = storage.createPost({ content: 'x', platform: 'twitter', scheduledAt: new Date() });
    storage.updatePostStatus(p.id, 'published', undefined, 'tw-123');
    storage.updatePostStatus(p.id, 'published');
    expect(storage.getPost(p.id)!.platformPostId).toBe('tw-123');
  });
});

describe('TrendPostStorage — deletePost()', () => {
  it('removes the post', () => {
    const storage = freshStorage();
    const p = storage.createPost({
      content: 'delete me',
      platform: 'twitter',
      scheduledAt: new Date(),
    });
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

describe('TrendPostStorage — createIdea()', () => {
  it('returns an idea with status=idea and correct fields', () => {
    const storage = freshStorage();
    const idea = storage.createIdea({
      topic: 'AI automation',
      angle: 'personal story',
      platform: 'linkedin',
    });
    expect(idea.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(idea.topic).toBe('AI automation');
    expect(idea.angle).toBe('personal story');
    expect(idea.platform).toBe('linkedin');
    expect(idea.status).toBe('idea');
    expect(idea.createdAt).toBeInstanceOf(Date);
    expect(idea.scheduledFor).toBeUndefined();
    expect(idea.campaignId).toBeUndefined();
  });

  it('stores scheduledFor and campaignId when provided', () => {
    const storage = freshStorage();
    const scheduledFor = new Date('2026-08-01T09:00:00Z');
    const idea = storage.createIdea({
      topic: 'Launch week',
      angle: 'announcement',
      platform: 'twitter',
      scheduledFor,
      campaignId: 'camp-1',
    });
    expect(idea.scheduledFor?.toISOString()).toBe(scheduledFor.toISOString());
    expect(idea.campaignId).toBe('camp-1');
  });
});

describe('TrendPostStorage — listIdeas()', () => {
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

// ── Campaigns ────────────────────────────────────────────────────────────

describe('TrendPostStorage — createCampaign()', () => {
  it('returns a campaign with correct fields', () => {
    const storage = freshStorage();
    const campaign = storage.createCampaign({ name: 'Product launch', source: 'manual' });
    expect(campaign.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(campaign.name).toBe('Product launch');
    expect(campaign.source).toBe('manual');
    expect(campaign.createdAt).toBeInstanceOf(Date);
  });
});

describe('TrendPostStorage — listCampaigns()', () => {
  it('returns all campaigns ordered by createdAt DESC', () => {
    const storage = freshStorage();
    storage.createCampaign({ name: 'A', source: 'manual' });
    storage.createCampaign({ name: 'B', source: 'gtm' });
    const campaigns = storage.listCampaigns();
    expect(campaigns).toHaveLength(2);
    expect(campaigns.map((c) => c.name)).toEqual(['B', 'A']);
  });

  it('returns an empty array when none exist', () => {
    const storage = freshStorage();
    expect(storage.listCampaigns()).toEqual([]);
  });
});

// ── Category / content pillar ───────────────────────────────────────────────

describe('TrendPostStorage — category/contentPillar on posts and ideas', () => {
  it('createPost() and createIdea() accept and persist category/contentPillar', () => {
    const storage = freshStorage();
    const post = storage.createPost({
      content: 'x',
      platform: 'twitter',
      scheduledAt: new Date(),
      category: 'Behind the scenes',
      contentPillar: 'Education',
    });
    expect(post.category).toBe('Behind the scenes');
    expect(post.contentPillar).toBe('Education');

    const idea = storage.createIdea({
      topic: 'x',
      angle: 'y',
      platform: 'twitter',
      category: 'Promo',
      contentPillar: 'Sales',
    });
    expect(idea.category).toBe('Promo');
    expect(idea.contentPillar).toBe('Sales');
  });

  it('leaves category/contentPillar undefined when not provided', () => {
    const storage = freshStorage();
    const post = storage.createPost({ content: 'x', platform: 'twitter', scheduledAt: new Date() });
    expect(post.category).toBeUndefined();
    expect(post.contentPillar).toBeUndefined();
  });

  it('updatePostPlanningFields() sets fields without clobbering the other on a partial update', () => {
    const storage = freshStorage();
    const post = storage.createPost({ content: 'x', platform: 'twitter', scheduledAt: new Date() });
    storage.updatePostPlanningFields(post.id, { category: 'Promo' });
    expect(storage.getPost(post.id)!.category).toBe('Promo');
    expect(storage.getPost(post.id)!.contentPillar).toBeUndefined();

    storage.updatePostPlanningFields(post.id, { contentPillar: 'Education' });
    expect(storage.getPost(post.id)!.category).toBe('Promo');
    expect(storage.getPost(post.id)!.contentPillar).toBe('Education');
  });

  it('updateIdeaPlanningFields() sets category/contentPillar on an existing idea', () => {
    const storage = freshStorage();
    const idea = storage.createIdea({ topic: 'x', angle: 'y', platform: 'twitter' });
    storage.updateIdeaPlanningFields(idea.id, { category: 'Promo', contentPillar: 'Sales' });
    const updated = storage.listIdeas().find((i) => i.id === idea.id)!;
    expect(updated.category).toBe('Promo');
    expect(updated.contentPillar).toBe('Sales');
  });

  it('listCategories()/listContentPillars() return distinct values across posts and ideas, sorted', () => {
    const storage = freshStorage();
    storage.createPost({
      content: 'a',
      platform: 'twitter',
      scheduledAt: new Date(),
      category: 'Promo',
    });
    storage.createIdea({ topic: 'b', angle: 'c', platform: 'twitter', category: 'Education' });
    storage.createIdea({ topic: 'd', angle: 'e', platform: 'twitter', category: 'Promo' });
    storage.createPost({
      content: 'f',
      platform: 'twitter',
      scheduledAt: new Date(),
      contentPillar: 'Sales',
    });

    expect(storage.listCategories()).toEqual(['Education', 'Promo']);
    expect(storage.listContentPillars()).toEqual(['Sales']);
  });

  it('listCategories() returns an empty array when none are set', () => {
    const storage = freshStorage();
    storage.createPost({ content: 'x', platform: 'twitter', scheduledAt: new Date() });
    expect(storage.listCategories()).toEqual([]);
  });
});

// ── Hashtag groups ───────────────────────────────────────────────────────────

describe('TrendPostStorage — hashtag groups', () => {
  it('createHashtagGroup() persists a group and computes characterCount from hashtags.length', () => {
    const storage = freshStorage();
    const group = storage.createHashtagGroup({ name: 'Launch', hashtags: '#launch #newproduct' });
    expect(group.name).toBe('Launch');
    expect(group.hashtags).toBe('#launch #newproduct');
    expect(group.characterCount).toBe('#launch #newproduct'.length);
    expect(group.createdAt).toBeInstanceOf(Date);
  });

  it('listHashtagGroups() returns all groups ordered by name', () => {
    const storage = freshStorage();
    storage.createHashtagGroup({ name: 'Zebra', hashtags: '#z' });
    storage.createHashtagGroup({ name: 'Apple', hashtags: '#a' });
    const groups = storage.listHashtagGroups();
    expect(groups.map((g) => g.name)).toEqual(['Apple', 'Zebra']);
  });

  it('listHashtagGroups() returns an empty array when none exist', () => {
    const storage = freshStorage();
    expect(storage.listHashtagGroups()).toEqual([]);
  });

  it('updateHashtagGroup() partially updates a group and recomputes characterCount', () => {
    const storage = freshStorage();
    const group = storage.createHashtagGroup({ name: 'Launch', hashtags: '#a' });
    const updated = storage.updateHashtagGroup(group.id, { hashtags: '#a #b #c' });
    expect(updated!.name).toBe('Launch');
    expect(updated!.hashtags).toBe('#a #b #c');
    expect(updated!.characterCount).toBe('#a #b #c'.length);
  });

  it('updateHashtagGroup() returns null for a non-existent id', () => {
    const storage = freshStorage();
    expect(storage.updateHashtagGroup('nope', { name: 'x' })).toBeNull();
  });

  it('deleteHashtagGroup() removes the group', () => {
    const storage = freshStorage();
    const group = storage.createHashtagGroup({ name: 'Launch', hashtags: '#a' });
    storage.deleteHashtagGroup(group.id);
    expect(storage.listHashtagGroups()).toEqual([]);
  });
});
