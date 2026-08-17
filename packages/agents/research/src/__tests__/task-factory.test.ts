import { ResearchTasks } from '../task-factory';

describe('ResearchTasks.researchTopic()', () => {
  it('produces a valid task shape', () => {
    const t = ResearchTasks.researchTopic('AI trends');
    expect(t.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(t.agentRole).toBe('research');
    expect(t.status).toBe('queued');
    expect(t.approvalRequired).toBe(true);
    expect((t.input as { type: string }).type).toBe('research_topic');
  });

  it('includes query and defaults to quick depth with 5 results', () => {
    const t = ResearchTasks.researchTopic('typescript tips');
    const input = t.input as { query: string; depth: string; resultCount: number };
    expect(input.query).toBe('typescript tips');
    expect(input.depth).toBe('quick');
    expect(input.resultCount).toBe(5);
  });

  it('uses 10 results for deep depth', () => {
    const t = ResearchTasks.researchTopic('market research', 'deep');
    const input = t.input as { depth: string; resultCount: number };
    expect(input.depth).toBe('deep');
    expect(input.resultCount).toBe(10);
  });

  it('includes query in description', () => {
    const t = ResearchTasks.researchTopic('SaaS pricing strategies');
    expect(t.description).toContain('SaaS pricing strategies');
  });
});

describe('ResearchTasks.synthesizeFindings()', () => {
  it('produces a valid task shape', () => {
    const t = ResearchTasks.synthesizeFindings('competitor analysis');
    expect(t.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(t.agentRole).toBe('research');
    expect(t.approvalRequired).toBe(true);
    expect((t.input as { type: string }).type).toBe('synthesize_findings');
  });

  it('stores topic in input', () => {
    const t = ResearchTasks.synthesizeFindings('AI tools for productivity');
    expect((t.input as { topic: string }).topic).toBe('AI tools for productivity');
  });

  it('includes topic in description', () => {
    const t = ResearchTasks.synthesizeFindings('market size');
    expect(t.description).toContain('market size');
  });
});

describe('ResearchTasks — unique ids', () => {
  it('every task gets a unique uuid', () => {
    const ids = [
      ResearchTasks.researchTopic('a').id,
      ResearchTasks.researchTopic('b').id,
      ResearchTasks.synthesizeFindings('c').id,
      ResearchTasks.synthesizeFindings('d').id,
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('ResearchTasks.freeform()', () => {
  it('produces a valid task shape', () => {
    const t = ResearchTasks.freeform('what have we found on competitor pricing?');
    expect(t.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(t.agentRole).toBe('research');
    expect(t.status).toBe('queued');
    expect(t.approvalRequired).toBe(false);
    expect((t.input as { type: string }).type).toBe('freeform');
  });

  it('carries the prompt in both description and input', () => {
    const t = ResearchTasks.freeform('look up X and synthesize with prior findings');
    expect(t.description).toBe('look up X and synthesize with prior findings');
    expect((t.input as { prompt: string }).prompt).toBe(
      'look up X and synthesize with prior findings'
    );
  });

  it('leaves history undefined when not provided', () => {
    const t = ResearchTasks.freeform('a question');
    expect((t.input as { history?: unknown }).history).toBeUndefined();
  });

  it('carries history through when provided', () => {
    const history = [{ role: 'user' as const, content: 'earlier question' }];
    const t = ResearchTasks.freeform('follow-up', history);
    expect((t.input as { history?: unknown }).history).toEqual(history);
  });
});

describe('ResearchTasks — objectiveId passthrough', () => {
  it('passes objectiveId through when provided, and leaves it undefined otherwise', () => {
    expect(ResearchTasks.researchTopic('q', 'quick', undefined, 'obj-1').objectiveId).toBe('obj-1');
    expect(ResearchTasks.researchTopic('q').objectiveId).toBeUndefined();

    expect(ResearchTasks.synthesizeFindings('t', 'obj-1').objectiveId).toBe('obj-1');
    expect(ResearchTasks.synthesizeFindings('t').objectiveId).toBeUndefined();

    expect(ResearchTasks.researchAndSynthesize('q', 'quick', 'obj-1').objectiveId).toBe('obj-1');
    expect(ResearchTasks.researchAndSynthesize('q').objectiveId).toBeUndefined();

    expect(ResearchTasks.freeform('p', undefined, 'obj-1').objectiveId).toBe('obj-1');
    expect(ResearchTasks.freeform('p').objectiveId).toBeUndefined();
  });
});
