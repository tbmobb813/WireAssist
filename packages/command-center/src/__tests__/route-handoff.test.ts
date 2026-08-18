import type { AgentTask } from '@wireassist/core';
import { routeHandoffTask } from '../lib/route-handoff';

function makeTask(agentRole: AgentTask['agentRole']): AgentTask {
  return {
    id: 't1',
    agentRole,
    description: 'test',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: {},
    approvalRequired: true,
  };
}

describe('routeHandoffTask()', () => {
  it('routes to the queue matching task.agentRole', () => {
    const content = jest.fn();
    const research = jest.fn();
    const task = makeTask('content');

    const routed = routeHandoffTask(task, { content, research });

    expect(routed).toBe(true);
    expect(content).toHaveBeenCalledWith(task);
    expect(research).not.toHaveBeenCalled();
  });

  it('returns false and does not throw when no queue is registered for the role', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const content = jest.fn();
    const task = makeTask('gtm');

    const routed = routeHandoffTask(task, { content });

    expect(routed).toBe(false);
    expect(content).not.toHaveBeenCalled();
    // route-handoff.ts logs via @wireassist/core's logger, which prefixes
    // every console.error call with a `[wireassist:error] <timestamp>`
    // first argument — the actual message is the second argument.
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('gtm'));
    consoleErrorSpy.mockRestore();
  });

  it.each(['content', 'research', 'strategy', 'gtm', 'admin'] as const)(
    'routes the %s role when all five queues are wired',
    (role) => {
      const queues = {
        content: jest.fn(),
        research: jest.fn(),
        strategy: jest.fn(),
        gtm: jest.fn(),
        admin: jest.fn(),
      };
      const task = makeTask(role);

      expect(routeHandoffTask(task, queues)).toBe(true);
      expect(queues[role]).toHaveBeenCalledWith(task);
    }
  );
});
