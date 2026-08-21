import { SkillExecutor } from '../executor';
import { SkillRegistry } from '../registry';
import type { AgentTask } from '../../agents/types';
import type { Skill, SkillAgentHandle } from '../types';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-1',
    agentRole: 'admin',
    description: 'test task',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'do_thing' },
    approvalRequired: false,
    ...overrides,
  };
}

function makeAgentHandle(): SkillAgentHandle {
  return {
    think: jest.fn().mockResolvedValue(''),
    useTool: jest.fn().mockResolvedValue(undefined),
    loadContext: jest.fn().mockResolvedValue(''),
    remember: jest.fn(),
    proposeAction: jest.fn().mockResolvedValue(true),
    emit: jest.fn(),
    runToolLoop: jest.fn().mockResolvedValue(''),
    listDecisions: jest.fn().mockReturnValue([]),
    listPending: jest.fn().mockReturnValue([]),
    listMemories: jest.fn().mockReturnValue([]),
  };
}

describe('SkillExecutor.run() — single skill', () => {
  it('resolves task.input.type and executes the matching skill', async () => {
    const registry = new SkillRegistry();
    const execute = jest.fn().mockResolvedValue('done');
    const skill: Skill = { name: 'do_thing', role: 'admin', description: 'x', execute };
    registry.registerSkill(skill);
    const executor = new SkillExecutor(registry);
    const agent = makeAgentHandle();
    const task = makeTask();

    await executor.run(agent, task);

    expect(execute).toHaveBeenCalledWith({ agent, task, input: task.input });
  });

  it('throws when task.input.type has no registered skill or chain', async () => {
    const executor = new SkillExecutor(new SkillRegistry());
    await expect(executor.run(makeAgentHandle(), makeTask())).rejects.toThrow(
      /no skill or chain registered/
    );
  });

  it('throws when task.input has no type', async () => {
    const executor = new SkillExecutor(new SkillRegistry());
    await expect(executor.run(makeAgentHandle(), makeTask({ input: {} }))).rejects.toThrow(
      /no input.type/
    );
  });
});

describe('SkillExecutor.run() — chain', () => {
  it('threads previousOutput between steps via mapInput', async () => {
    const registry = new SkillRegistry();
    const stepA: Skill = {
      name: 'step_a',
      role: 'admin',
      description: 'x',
      execute: async () => 'a-output',
    };
    const stepB = jest.fn().mockResolvedValue('b-output');
    const stepBSkill: Skill = { name: 'step_b', role: 'admin', description: 'x', execute: stepB };
    registry.registerSkill(stepA);
    registry.registerSkill(stepBSkill);
    registry.registerChain({
      name: 'my_chain',
      role: 'admin',
      description: 'x',
      steps: [{ skill: 'step_a' }, { skill: 'step_b', mapInput: (prev) => ({ from: prev }) }],
    });

    const executor = new SkillExecutor(registry);
    const agent = makeAgentHandle();
    const task = makeTask({ input: { type: 'my_chain' } });

    await executor.run(agent, task);

    expect(stepB).toHaveBeenCalledWith({ agent, task, input: { from: 'a-output' } });
  });

  it('halts the chain early when continueIf returns false', async () => {
    const registry = new SkillRegistry();
    const stepA: Skill = {
      name: 'step_a',
      role: 'admin',
      description: 'x',
      execute: async () => 'rejected',
    };
    const stepB = jest.fn().mockResolvedValue('unreachable');
    const stepBSkill: Skill = { name: 'step_b', role: 'admin', description: 'x', execute: stepB };
    registry.registerSkill(stepA);
    registry.registerSkill(stepBSkill);
    registry.registerChain({
      name: 'my_chain',
      role: 'admin',
      description: 'x',
      steps: [{ skill: 'step_a' }, { skill: 'step_b', continueIf: (prev) => prev !== 'rejected' }],
    });

    const executor = new SkillExecutor(registry);
    await executor.run(makeAgentHandle(), makeTask({ input: { type: 'my_chain' } }));

    expect(stepB).not.toHaveBeenCalled();
  });

  it('throws when a chain references an unregistered skill', async () => {
    const registry = new SkillRegistry();
    registry.registerChain({
      name: 'broken_chain',
      role: 'admin',
      description: 'x',
      steps: [{ skill: 'missing_skill' }],
    });
    const executor = new SkillExecutor(registry);
    await expect(
      executor.run(makeAgentHandle(), makeTask({ input: { type: 'broken_chain' } }))
    ).rejects.toThrow(/unregistered skill/);
  });
});
