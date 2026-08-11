import type { AgentTask } from '../agents/types';
import type { SkillRegistry } from './registry';
import type { SkillAgentHandle } from './types';

export class SkillExecutor {
  constructor(private registry: SkillRegistry) {}

  async run(agent: SkillAgentHandle, task: AgentTask): Promise<void> {
    const name = (task.input as { type?: string }).type;
    if (!name) {
      throw new Error(`SkillExecutor: task ${task.id} has no input.type to resolve`);
    }

    const resolution = this.registry.resolve(task.agentRole, name);
    if (!resolution) {
      throw new Error(
        `SkillExecutor: no skill or chain registered for "${task.agentRole}:${name}"`
      );
    }

    if (resolution.kind === 'skill') {
      await resolution.skill.execute({ agent, task, input: task.input });
      return;
    }

    let previousOutput: unknown = task.input;
    for (const step of resolution.chain.steps) {
      if (step.continueIf && !step.continueIf(previousOutput)) {
        return;
      }

      const skill = this.registry.getSkill(resolution.chain.role, step.skill);
      if (!skill) {
        throw new Error(
          `SkillExecutor: chain "${resolution.chain.role}:${resolution.chain.name}" references unregistered skill "${step.skill}"`
        );
      }

      const input = step.mapInput ? step.mapInput(previousOutput, task) : previousOutput;
      previousOutput = await skill.execute({ agent, task, input });
    }
  }
}
