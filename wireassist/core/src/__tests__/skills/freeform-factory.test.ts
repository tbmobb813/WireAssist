import type { AgentTask } from '../../agents/types';
import type { SkillAgentHandle } from '../../skills/types';
import { createFreeformSkill } from '../../skills/freeform-factory';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-f1',
    agentRole: 'admin',
    description: 'fallback description',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'freeform' },
    approvalRequired: false,
    ...overrides,
  };
}

function makeAgentHandle(overrides: Partial<SkillAgentHandle> = {}): SkillAgentHandle {
  return {
    think: jest.fn(),
    useTool: jest.fn(),
    loadContext: jest.fn().mockResolvedValue(''),
    remember: jest.fn(),
    proposeAction: jest.fn().mockResolvedValue(true),
    emit: jest.fn(),
    runToolLoop: jest.fn().mockResolvedValue('the response'),
    listDecisions: jest.fn().mockReturnValue([]),
    listPending: jest.fn().mockReturnValue([]),
    ...overrides,
  };
}

describe('createFreeformSkill()', () => {
  it('produces a skill named "freeform" with the configured role and description', () => {
    const skill = createFreeformSkill({ role: 'content', description: 'Open-ended chat.' });
    expect(skill.name).toBe('freeform');
    expect(skill.role).toBe('content');
    expect(skill.description).toBe('Open-ended chat.');
  });

  it('uses input.prompt when type is "freeform", falling back to task.description otherwise', async () => {
    const loadContext = jest.fn().mockResolvedValue('');
    const agent = makeAgentHandle({ loadContext });
    const skill = createFreeformSkill({ role: 'admin', description: 'x' });

    await skill.execute({ agent, task: makeTask(), input: { type: 'freeform', prompt: 'hi' } });
    expect(loadContext).toHaveBeenCalledWith('hi');

    await skill.execute({ agent, task: makeTask(), input: {} });
    expect(loadContext).toHaveBeenCalledWith('fallback description');
  });

  it('passes maxIterations through to runToolLoop only when configured', async () => {
    const runToolLoop = jest.fn().mockResolvedValue('r');
    const agent = makeAgentHandle({ runToolLoop });

    await createFreeformSkill({ role: 'admin', description: 'x', maxIterations: 12 }).execute({
      agent,
      task: makeTask(),
      input: {},
    });
    expect(runToolLoop.mock.calls[0][2]).toEqual(expect.objectContaining({ maxIterations: 12 }));

    runToolLoop.mockClear();
    await createFreeformSkill({ role: 'admin', description: 'x' }).execute({
      agent,
      task: makeTask(),
      input: {},
    });
    expect(runToolLoop.mock.calls[0][2]).not.toHaveProperty('maxIterations');
  });

  it("passes loadContext()'s result straight through as extraContext", async () => {
    const runToolLoop = jest.fn().mockResolvedValue('r');
    const agent = makeAgentHandle({
      loadContext: jest.fn().mockResolvedValue('some context'),
      runToolLoop,
    });

    await createFreeformSkill({ role: 'admin', description: 'x' }).execute({
      agent,
      task: makeTask(),
      input: {},
    });

    expect(runToolLoop.mock.calls[0][2]).toEqual(
      expect.objectContaining({ extraContext: 'some context' })
    );
  });

  it('emits agent:freeform_response with {taskId, response} by default', async () => {
    const agent = makeAgentHandle();
    const task = makeTask();

    await createFreeformSkill({ role: 'admin', description: 'x' }).execute({
      agent,
      task,
      input: {},
    });

    expect(agent.emit).toHaveBeenCalledWith('agent:freeform_response', {
      taskId: task.id,
      response: 'the response',
    });
  });

  it('honors a custom resolvePrompt override', async () => {
    const loadContext = jest.fn().mockResolvedValue('');
    const runToolLoop = jest.fn().mockResolvedValue('r');
    const agent = makeAgentHandle({ loadContext, runToolLoop });
    const resolvePrompt = jest.fn().mockReturnValue('custom prompt');

    await createFreeformSkill({ role: 'strategy', description: 'x', resolvePrompt }).execute({
      agent,
      task: makeTask(),
      input: { prompt: 'ignored without type:freeform' },
    });

    expect(loadContext).toHaveBeenCalledWith('custom prompt');
    expect(runToolLoop.mock.calls[0][1]).toBe('custom prompt');
  });

  it('honors a custom buildCompletionEvent override', async () => {
    const agent = makeAgentHandle();
    const task = makeTask({ agentRole: 'strategy' });

    await createFreeformSkill({
      role: 'strategy',
      description: 'x',
      buildCompletionEvent: ({ task, response }) => ({
        event: 'agent:ops_freeform_response',
        payload: { agentRole: task.agentRole, taskId: task.id, response },
      }),
    }).execute({ agent, task, input: {} });

    expect(agent.emit).toHaveBeenCalledWith('agent:ops_freeform_response', {
      agentRole: 'strategy',
      taskId: task.id,
      response: 'the response',
    });
  });

  it('calls onBeforeEmit before emitting, with the resolved response', async () => {
    const agent = makeAgentHandle();
    const task = makeTask();
    const calls: string[] = [];
    (agent.emit as jest.Mock).mockImplementation(() => calls.push('emit'));
    const onBeforeEmit = jest.fn((_t, response: string) => {
      task.output = { response };
      calls.push('onBeforeEmit');
    });

    await createFreeformSkill({ role: 'strategy', description: 'x', onBeforeEmit }).execute({
      agent,
      task,
      input: {},
    });

    expect(onBeforeEmit).toHaveBeenCalledWith(task, 'the response');
    expect(task.output).toEqual({ response: 'the response' });
    expect(calls).toEqual(['onBeforeEmit', 'emit']);
  });
});
