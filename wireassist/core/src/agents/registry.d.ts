import { AgentRole } from './types';
export interface IAgent {
  role: AgentRole;
}
export declare class AgentRegistry {
  private agents;
  register(agent: IAgent): void;
  get(role: AgentRole): IAgent | undefined;
  all(): IAgent[];
}
//# sourceMappingURL=registry.d.ts.map
