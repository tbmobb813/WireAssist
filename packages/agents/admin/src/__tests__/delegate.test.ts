import { isDelegatableRole, buildDelegatedFreeformTask, roleLabel } from '../delegate';

describe('isDelegatableRole', () => {
  it('accepts every valid delegatable role', () => {
    for (const role of ['content', 'research', 'strategy', 'gtm', 'github']) {
      expect(isDelegatableRole(role)).toBe(true);
    }
  });

  it('rejects admin (self-delegation) and garbage input', () => {
    expect(isDelegatableRole('admin')).toBe(false);
    expect(isDelegatableRole('not-a-role')).toBe(false);
    expect(isDelegatableRole(undefined)).toBe(false);
    expect(isDelegatableRole(123)).toBe(false);
    expect(isDelegatableRole(null)).toBe(false);
  });
});

describe('roleLabel', () => {
  it('returns a human-readable label for every delegatable role', () => {
    expect(roleLabel('content')).toBe('Content');
    expect(roleLabel('research')).toBe('Research');
    expect(roleLabel('strategy')).toBe('NixOps');
    expect(roleLabel('gtm')).toBe('GTM');
    expect(roleLabel('github')).toBe('GitHub Dev');
  });
});

describe('buildDelegatedFreeformTask', () => {
  it('produces the same shape every agent freeform task factory produces', () => {
    const history = [{ role: 'user' as const, content: 'earlier turn' }];
    const task = buildDelegatedFreeformTask('content', 'write a launch post', history, 'obj-1');

    expect(task.agentRole).toBe('content');
    expect(task.description).toBe('write a launch post');
    expect(task.status).toBe('queued');
    expect(task.approvalRequired).toBe(false);
    expect(task.objectiveId).toBe('obj-1');
    expect(task.input).toEqual({ type: 'freeform', prompt: 'write a launch post', history });
    expect(typeof task.id).toBe('string');
    expect(task.id.length).toBeGreaterThan(0);
    expect(task.createdAt).toBeInstanceOf(Date);
    expect(task.updatedAt).toBeInstanceOf(Date);
  });

  it('works with no history and no objectiveId', () => {
    const task = buildDelegatedFreeformTask('research', 'find competitor pricing');

    expect(task.agentRole).toBe('research');
    expect(task.input).toEqual({
      type: 'freeform',
      prompt: 'find competitor pricing',
      history: undefined,
    });
    expect(task.objectiveId).toBeUndefined();
  });

  it('generates a distinct id per call', () => {
    const a = buildDelegatedFreeformTask('gtm', 'x');
    const b = buildDelegatedFreeformTask('gtm', 'x');
    expect(a.id).not.toBe(b.id);
  });
});
