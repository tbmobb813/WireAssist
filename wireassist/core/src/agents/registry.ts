import { AgentRole } from './types';

// Minimal interface — BaseAgent imports from here to avoid circular deps
export interface IAgent {
  role: AgentRole;
}

export class AgentRegistry {
  private agents: Map<AgentRole, IAgent> = new Map();

  register(agent: IAgent): void {
    this.agents.set(agent.role, agent);
  }

  get(role: AgentRole): IAgent | undefined {
    return this.agents.get(role);
  }

  all(): IAgent[] {
    return Array.from(this.agents.values());
  }
}
