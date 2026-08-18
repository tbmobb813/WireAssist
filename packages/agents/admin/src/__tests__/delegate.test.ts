import type { AgentTask } from '@wireassist/core';
import {
  isValidDelegationTarget,
  buildDelegatedFreeformTask,
  delegationGuardError,
  buildDelegateToolSchema,
  roleLabel,
  MAX_DELEGATION_DEPTH,
} from '../delegate';

function sourceTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'src-task-1',
    agentRole: 'admin',
    description: 'source task',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: {},
    approvalRequired: false,
    ...overrides,
  };
}

describe('isValidDelegationTarget', () => {
  it('accepts every role except the calling agent itself', () => {
    for (const role of ['admin', 'content', 'research', 'strategy', 'gtm', 'github']) {
      expect(isValidDelegationTarget(role, 'admin')).toBe(role !== 'admin');
    }
  });

  it('rejects self-delegation for a non-admin caller too', () => {
    expect(isValidDelegationTarget('content', 'content')).toBe(false);
    expect(isValidDelegationTarget('research', 'content')).toBe(true);
  });

  it('rejects garbage input', () => {
    expect(isValidDelegationTarget('not-a-role', 'admin')).toBe(false);
    expect(isValidDelegationTarget(undefined, 'admin')).toBe(false);
    expect(isValidDelegationTarget(123, 'admin')).toBe(false);
    expect(isValidDelegationTarget(null, 'admin')).toBe(false);
  });
});

describe('roleLabel', () => {
  it('returns a human-readable label for every role, including admin', () => {
    expect(roleLabel('admin')).toBe('Admin');
    expect(roleLabel('content')).toBe('Content');
    expect(roleLabel('research')).toBe('Research');
    expect(roleLabel('strategy')).toBe('NixOps');
    expect(roleLabel('gtm')).toBe('GTM');
    expect(roleLabel('github')).toBe('GitHub Dev');
  });
});

describe('buildDelegateToolSchema', () => {
  it('excludes the calling agent from its own target enum', () => {
    const schema = buildDelegateToolSchema('content');
    const enumValues = (schema.inputSchema.properties as any).targetRole.enum as string[];
    expect(enumValues).not.toContain('content');
    expect(enumValues).toEqual(
      expect.arrayContaining(['admin', 'research', 'strategy', 'gtm', 'github'])
    );
    expect(enumValues).toHaveLength(5);
  });
});

describe('delegationGuardError', () => {
  it('allows a fresh chain', () => {
    expect(delegationGuardError(undefined, 'content')).toBeNull();
    expect(delegationGuardError([], 'content')).toBeNull();
  });

  it('allows a chain under the depth cap with no cycle', () => {
    expect(delegationGuardError(['admin'], 'content')).toBeNull();
  });

  it('rejects a target already in the chain (cycle)', () => {
    const err = delegationGuardError(['admin', 'research'], 'admin');
    expect(err).toMatch(/already part of this chain/);
  });

  it('rejects once the chain hits MAX_DELEGATION_DEPTH', () => {
    const chain = Array.from({ length: MAX_DELEGATION_DEPTH }, (_, i) =>
      i === 0 ? 'admin' : 'research'
    ) as AgentTask['delegationChain'];
    const err = delegationGuardError(chain, 'gtm');
    expect(err).toMatch(/already passed through/);
  });
});

describe('buildDelegatedFreeformTask', () => {
  it('produces the same shape every agent freeform task factory produces', () => {
    const history = [{ role: 'user' as const, content: 'earlier turn' }];
    const source = sourceTask({ agentRole: 'admin', objectiveId: 'obj-1' });
    const task = buildDelegatedFreeformTask(source, 'content', 'write a launch post', history);

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

  it('appends the source agent role to an empty chain', () => {
    const source = sourceTask({ agentRole: 'admin' });
    const task = buildDelegatedFreeformTask(source, 'research', 'find competitor pricing');
    expect(task.delegationChain).toEqual(['admin']);
  });

  it('appends to an existing chain rather than replacing it', () => {
    const source = sourceTask({ agentRole: 'research', delegationChain: ['admin'] });
    const task = buildDelegatedFreeformTask(source, 'content', 'draft the post');
    expect(task.delegationChain).toEqual(['admin', 'research']);
  });

  it('works with no history and no objectiveId', () => {
    const source = sourceTask({ agentRole: 'admin' });
    const task = buildDelegatedFreeformTask(source, 'research', 'find competitor pricing');

    expect(task.agentRole).toBe('research');
    expect(task.input).toEqual({
      type: 'freeform',
      prompt: 'find competitor pricing',
      history: undefined,
    });
    expect(task.objectiveId).toBeUndefined();
  });

  it('generates a distinct id per call', () => {
    const source = sourceTask({ agentRole: 'admin' });
    const a = buildDelegatedFreeformTask(source, 'gtm', 'x');
    const b = buildDelegatedFreeformTask(source, 'gtm', 'x');
    expect(a.id).not.toBe(b.id);
  });
});
