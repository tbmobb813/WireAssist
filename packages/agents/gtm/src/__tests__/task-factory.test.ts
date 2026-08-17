import { GtmTasks } from '../task-factory';
import type { GtmProductInput } from '../types';

const product: GtmProductInput = {
  name: 'StatusWatch',
  cat: 'SaaS',
  problem: 'DevOps teams waste hours figuring out if an outage is their code or a vendor',
  benefit: 'Instant clarity during outages',
  diff: 'Calm by default — smart alert filtering reduces noise',
  buyer: 'DevOps engineers at Series A-B startups',
  segment: '10-100 person startups',
  comp: 'StatusGator ($89/mo)',
  channels: 'r/devops, Hacker News',
  pain: 'Too many false alerts',
  price: '$49/month',
  model: 'SaaS subscription',
  free: '14-day free trial',
  goal: '10 paying customers in 30 days',
  current: 'Nothing yet',
  budget: '$0 for now',
};

describe('GtmTasks.generateStrategy()', () => {
  it('produces a valid task shape', () => {
    const t = GtmTasks.generateStrategy(product);
    expect(t.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(t.agentRole).toBe('gtm');
    expect(t.status).toBe('queued');
    expect(t.approvalRequired).toBe(false);
    expect((t.input as { type: string }).type).toBe('generate_gtm');
  });

  it('carries the full product payload', () => {
    const t = GtmTasks.generateStrategy(product);
    expect((t.input as { product: GtmProductInput }).product).toEqual(product);
  });

  it('description references the product name', () => {
    const t = GtmTasks.generateStrategy(product);
    expect(t.description).toContain('StatusWatch');
  });

  it('leaves offerContentDraft undefined when not provided', () => {
    const t = GtmTasks.generateStrategy(product);
    expect((t.input as { offerContentDraft?: unknown }).offerContentDraft).toBeUndefined();
  });

  it('carries offerContentDraft through when provided', () => {
    const t = GtmTasks.generateStrategy(product, { platform: 'linkedin', tone: 'direct' });
    expect((t.input as { offerContentDraft?: unknown }).offerContentDraft).toEqual({
      platform: 'linkedin',
      tone: 'direct',
    });
  });

  it('leaves offerContentCalendar undefined when not provided', () => {
    const t = GtmTasks.generateStrategy(product);
    expect((t.input as { offerContentCalendar?: unknown }).offerContentCalendar).toBeUndefined();
  });

  it('carries offerContentCalendar through when provided', () => {
    const t = GtmTasks.generateStrategy(product, undefined, { platforms: ['linkedin', 'twitter'] });
    expect((t.input as { offerContentCalendar?: unknown }).offerContentCalendar).toEqual({
      platforms: ['linkedin', 'twitter'],
    });
  });
});

describe('GtmTasks.generatePsychTactics()', () => {
  it('produces a valid task shape', () => {
    const t = GtmTasks.generatePsychTactics(product);
    expect(t.agentRole).toBe('gtm');
    expect(t.approvalRequired).toBe(false);
    expect((t.input as { type: string }).type).toBe('generate_psych');
  });

  it('carries the full product payload', () => {
    const t = GtmTasks.generatePsychTactics(product);
    expect((t.input as { product: GtmProductInput }).product).toEqual(product);
  });
});

describe('GtmTasks.freeform()', () => {
  it('produces a valid task shape', () => {
    const t = GtmTasks.freeform('what pricing model fits a PLG SaaS?');
    expect(t.agentRole).toBe('gtm');
    expect(t.approvalRequired).toBe(false);
    expect(t.description).toBe('what pricing model fits a PLG SaaS?');
    expect((t.input as { type: string }).type).toBe('freeform');
    expect((t.input as { prompt: string }).prompt).toBe('what pricing model fits a PLG SaaS?');
  });

  it('leaves history undefined when not provided', () => {
    const t = GtmTasks.freeform('a question');
    expect((t.input as { history?: unknown }).history).toBeUndefined();
  });

  it('carries history through when provided', () => {
    const history = [{ role: 'user' as const, content: 'earlier turn' }];
    const t = GtmTasks.freeform('a question', history);
    expect((t.input as { history?: unknown }).history).toEqual(history);
  });
});

describe('GtmTasks — unique ids', () => {
  it('every task gets a unique uuid id', () => {
    const ids = [
      GtmTasks.generateStrategy(product).id,
      GtmTasks.generateStrategy(product).id,
      GtmTasks.generatePsychTactics(product).id,
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
