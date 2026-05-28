import { ContentTasks } from '../task-factory';

describe('ContentTasks.generatePost()', () => {
  it('produces a valid task shape', () => {
    const t = ContentTasks.generatePost('AI trends', 'linkedin');
    expect(t.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(t.agentRole).toBe('content');
    expect(t.status).toBe('queued');
    expect(t.approvalRequired).toBe(true);
    expect((t.input as { type: string }).type).toBe('generate_post');
  });

  it('includes topic, platform, and optional tone', () => {
    const t = ContentTasks.generatePost('productivity', 'twitter', 'direct');
    const input = t.input as { topic: string; platform: string; tone: string };
    expect(input.topic).toBe('productivity');
    expect(input.platform).toBe('twitter');
    expect(input.tone).toBe('direct');
  });

  it('leaves tone undefined when not provided', () => {
    const t = ContentTasks.generatePost('topic', 'instagram');
    expect((t.input as { tone?: string }).tone).toBeUndefined();
  });

  it('includes platform in description', () => {
    const t = ContentTasks.generatePost('AI', 'threads');
    expect(t.description).toContain('threads');
  });
});

describe('ContentTasks.generatePlan()', () => {
  it('defaults to weeksAhead=1 and postsPerWeek=3', () => {
    const t = ContentTasks.generatePlan(['linkedin', 'twitter']);
    const input = t.input as { weeksAhead: number; postsPerWeek: number };
    expect(input.weeksAhead).toBe(1);
    expect(input.postsPerWeek).toBe(3);
    expect(t.approvalRequired).toBe(true);
  });

  it('passes custom weeksAhead and postsPerWeek', () => {
    const t = ContentTasks.generatePlan(['instagram'], 2, 5);
    const input = t.input as { weeksAhead: number; postsPerWeek: number };
    expect(input.weeksAhead).toBe(2);
    expect(input.postsPerWeek).toBe(5);
  });

  it('stores all platforms in input', () => {
    const t = ContentTasks.generatePlan(['linkedin', 'twitter', 'instagram']);
    expect((t.input as { platforms: string[] }).platforms).toEqual(['linkedin', 'twitter', 'instagram']);
  });

  it('has input type generate_plan', () => {
    const t = ContentTasks.generatePlan(['linkedin']);
    expect((t.input as { type: string }).type).toBe('generate_plan');
  });
});

describe('ContentTasks.schedulePost()', () => {
  const at = '2026-06-15T10:00:00Z';

  it('produces correct task shape', () => {
    const t = ContentTasks.schedulePost('Hello world', 'twitter', at);
    expect(t.agentRole).toBe('content');
    expect(t.approvalRequired).toBe(true);
    const input = t.input as { type: string; content: string; platform: string; scheduledAt: string };
    expect(input.type).toBe('schedule_post');
    expect(input.content).toBe('Hello world');
    expect(input.platform).toBe('twitter');
    expect(input.scheduledAt).toBe(at);
  });

  it('includes tags when provided', () => {
    const t = ContentTasks.schedulePost('Post', 'linkedin', at, ['launch', 'product']);
    expect((t.input as { tags: string[] }).tags).toEqual(['launch', 'product']);
  });

  it('description mentions platform and date', () => {
    const t = ContentTasks.schedulePost('Post', 'instagram', at);
    expect(t.description).toContain('instagram');
  });
});

describe('ContentTasks.analyzePost()', () => {
  it('does NOT require approval', () => {
    const t = ContentTasks.analyzePost('Some post content', 'linkedin');
    expect(t.approvalRequired).toBe(false);
  });

  it('has input type analyze_post', () => {
    const t = ContentTasks.analyzePost('content', 'twitter');
    expect((t.input as { type: string }).type).toBe('analyze_post');
  });

  it('stores content and platform', () => {
    const t = ContentTasks.analyzePost('my post', 'threads');
    const input = t.input as { content: string; platform: string };
    expect(input.content).toBe('my post');
    expect(input.platform).toBe('threads');
  });
});

describe('ContentTasks.listScheduled()', () => {
  it('does NOT require approval', () => {
    const t = ContentTasks.listScheduled();
    expect(t.approvalRequired).toBe(false);
  });

  it('defaults daysAhead to 14', () => {
    const t = ContentTasks.listScheduled();
    expect((t.input as { daysAhead: number }).daysAhead).toBe(14);
  });

  it('passes custom daysAhead', () => {
    const t = ContentTasks.listScheduled(7);
    expect((t.input as { daysAhead: number }).daysAhead).toBe(7);
  });

  it('has input type list_scheduled', () => {
    const t = ContentTasks.listScheduled();
    expect((t.input as { type: string }).type).toBe('list_scheduled');
  });
});

describe('ContentTasks — unique ids', () => {
  it('every task gets a unique uuid id', () => {
    const ids = [
      ContentTasks.generatePost('t', 'linkedin').id,
      ContentTasks.generatePost('t', 'linkedin').id,
      ContentTasks.generatePlan(['twitter']).id,
      ContentTasks.schedulePost('p', 'twitter', '2026-01-01').id,
      ContentTasks.analyzePost('p', 'instagram').id,
      ContentTasks.listScheduled().id,
    ];
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
