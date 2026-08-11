import type { AgentRole } from '../agents/types';
import type { Skill, SkillChain } from './types';

export type SkillResolution =
  | { kind: 'skill'; skill: Skill }
  | { kind: 'chain'; chain: SkillChain };

function key(role: AgentRole, name: string): string {
  return `${role}:${name}`;
}

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();
  private chains: Map<string, SkillChain> = new Map();

  registerSkill(skill: Skill): void {
    const k = key(skill.role, skill.name);
    if (this.skills.has(k) || this.chains.has(k)) {
      throw new Error(`SkillRegistry: "${k}" is already registered`);
    }
    this.skills.set(k, skill);
  }

  registerChain(chain: SkillChain): void {
    const k = key(chain.role, chain.name);
    if (this.skills.has(k) || this.chains.has(k)) {
      throw new Error(`SkillRegistry: "${k}" is already registered`);
    }
    this.chains.set(k, chain);
  }

  getSkill(role: AgentRole, name: string): Skill | undefined {
    return this.skills.get(key(role, name));
  }

  getChain(role: AgentRole, name: string): SkillChain | undefined {
    return this.chains.get(key(role, name));
  }

  // Chains are checked first — a Skill can never share a key with a Chain
  // (enforced at registration), so precedence only matters for lookups
  // against a registry populated before that guard existed.
  resolve(role: AgentRole, name: string): SkillResolution | undefined {
    const chain = this.getChain(role, name);
    if (chain) return { kind: 'chain', chain };

    const skill = this.getSkill(role, name);
    if (skill) return { kind: 'skill', skill };

    return undefined;
  }
}
