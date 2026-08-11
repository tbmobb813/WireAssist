import { SkillRegistry } from '../registry';
import type { Skill, SkillChain } from '../types';

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    name: 'do_thing',
    role: 'admin',
    description: 'does a thing',
    execute: async () => undefined,
    ...overrides,
  };
}

function makeChain(overrides: Partial<SkillChain> = {}): SkillChain {
  return {
    name: 'do_things',
    role: 'admin',
    description: 'does several things',
    steps: [{ skill: 'do_thing' }],
    ...overrides,
  };
}

describe('SkillRegistry.registerSkill() / getSkill()', () => {
  it('registers and retrieves a skill by role + name', () => {
    const registry = new SkillRegistry();
    const skill = makeSkill();
    registry.registerSkill(skill);
    expect(registry.getSkill('admin', 'do_thing')).toBe(skill);
  });

  it('returns undefined for an unregistered skill', () => {
    const registry = new SkillRegistry();
    expect(registry.getSkill('admin', 'nope')).toBeUndefined();
  });

  it('scopes skills by role — same name, different role, does not collide', () => {
    const registry = new SkillRegistry();
    const adminSkill = makeSkill({ role: 'admin' });
    const contentSkill = makeSkill({ role: 'content' });
    registry.registerSkill(adminSkill);
    registry.registerSkill(contentSkill);
    expect(registry.getSkill('admin', 'do_thing')).toBe(adminSkill);
    expect(registry.getSkill('content', 'do_thing')).toBe(contentSkill);
  });

  it('throws when registering a skill under a key that already has a skill', () => {
    const registry = new SkillRegistry();
    registry.registerSkill(makeSkill());
    expect(() => registry.registerSkill(makeSkill())).toThrow(/already registered/);
  });

  it('throws when registering a skill under a key that already has a chain', () => {
    const registry = new SkillRegistry();
    registry.registerChain(makeChain({ name: 'shared_key' }));
    expect(() => registry.registerSkill(makeSkill({ name: 'shared_key' }))).toThrow(
      /already registered/
    );
  });
});

describe('SkillRegistry.registerChain() / getChain()', () => {
  it('registers and retrieves a chain by role + name', () => {
    const registry = new SkillRegistry();
    const chain = makeChain();
    registry.registerChain(chain);
    expect(registry.getChain('admin', 'do_things')).toBe(chain);
  });

  it('throws when registering a chain under a key that already has a chain', () => {
    const registry = new SkillRegistry();
    registry.registerChain(makeChain());
    expect(() => registry.registerChain(makeChain())).toThrow(/already registered/);
  });

  it('throws when registering a chain under a key that already has a skill', () => {
    const registry = new SkillRegistry();
    registry.registerSkill(makeSkill({ name: 'shared_key' }));
    expect(() => registry.registerChain(makeChain({ name: 'shared_key' }))).toThrow(
      /already registered/
    );
  });
});

describe('SkillRegistry.resolve()', () => {
  it('resolves a registered skill as kind "skill"', () => {
    const registry = new SkillRegistry();
    const skill = makeSkill();
    registry.registerSkill(skill);
    expect(registry.resolve('admin', 'do_thing')).toEqual({ kind: 'skill', skill });
  });

  it('resolves a registered chain as kind "chain"', () => {
    const registry = new SkillRegistry();
    const chain = makeChain();
    registry.registerChain(chain);
    expect(registry.resolve('admin', 'do_things')).toEqual({ kind: 'chain', chain });
  });

  it('returns undefined when nothing is registered for that role + name', () => {
    const registry = new SkillRegistry();
    expect(registry.resolve('admin', 'nope')).toBeUndefined();
  });
});
