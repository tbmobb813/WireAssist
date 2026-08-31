import type { AgentTask, SkillAgentHandle } from '@wireassist/core';
import { marketGapDiscoverySkill } from '../market-gap-discovery';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-mgd-1',
    agentRole: 'research',
    description: 'Market-gap discovery',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'market_gap_discovery' },
    approvalRequired: true,
    ...overrides,
  };
}

function makeAgentHandle(overrides: Partial<SkillAgentHandle> = {}): SkillAgentHandle {
  return {
    think: jest
      .fn()
      .mockResolvedValueOnce('expand output\nNICHES: niche one; niche two; niche three')
      .mockResolvedValueOnce('reddit search summary')
      .mockResolvedValueOnce('pain points output')
      .mockResolvedValueOnce('gap analysis output\nTOP CONCEPT: Widget Pro'),
    useTool: jest.fn().mockResolvedValue({
      results: [{ title: 'A reddit thread', url: 'https://reddit.com/a', description: 'desc' }],
    }),
    loadContext: jest.fn().mockResolvedValue(''),
    remember: jest.fn(),
    proposeAction: jest.fn().mockResolvedValue(true),
    emit: jest.fn(),
    runToolLoop: jest.fn().mockResolvedValue(''),
    listDecisions: jest.fn().mockReturnValue([]),
    listPending: jest.fn().mockReturnValue([]),
    listOrphanedApprovals: jest.fn().mockReturnValue([]),
    listMemories: jest.fn().mockReturnValue([]),
    ...overrides,
  };
}

describe('marketGapDiscoverySkill', () => {
  it('runs all 4 stages and searches Reddit once per parsed niche', async () => {
    const useTool = jest.fn().mockResolvedValue({ results: [] });
    const agent = makeAgentHandle({ useTool });

    await marketGapDiscoverySkill.execute({ agent, task: makeTask(), input: {} });

    expect(agent.think).toHaveBeenCalledTimes(4);
    // 3 niches parsed from "NICHES: niche one; niche two; niche three"
    expect(useTool).toHaveBeenCalledTimes(3);
    expect(useTool).toHaveBeenCalledWith(
      'brave_search',
      expect.objectContaining({ query: expect.stringContaining('site:reddit.com') })
    );
  });

  it('builds Reddit queries with the first-person pain-point phrase bank', async () => {
    const useTool = jest.fn().mockResolvedValue({ results: [] });
    const agent = makeAgentHandle({ useTool });

    await marketGapDiscoverySkill.execute({ agent, task: makeTask(), input: {} });

    const firstCallQuery = useTool.mock.calls[0][1].query as string;
    expect(firstCallQuery).toContain('intext:"i feel"');
    expect(firstCallQuery).toContain('intext:"pain point"');
    expect(firstCallQuery).toContain('inurl:comments|inurl:thread');
  });

  it("defaults marketFocus to NixLevel's established product type when not given", async () => {
    const think = jest
      .fn()
      .mockResolvedValueOnce('expand\nNICHES: a')
      .mockResolvedValueOnce('search')
      .mockResolvedValueOnce('pain points')
      .mockResolvedValueOnce('gaps\nTOP CONCEPT: X');
    const agent = makeAgentHandle({ think });

    await marketGapDiscoverySkill.execute({ agent, task: makeTask(), input: {} });

    const expandPrompt = think.mock.calls[0][0] as string;
    expect(expandPrompt).toContain('digital printables and physical print-on-demand products');
  });

  it('does not degrade snippet-only signal into fabricated full-thread claims — extraction stage is told the limitation', async () => {
    const think = jest
      .fn()
      .mockResolvedValueOnce('expand\nNICHES: a')
      .mockResolvedValueOnce('search')
      .mockResolvedValueOnce('pain points')
      .mockResolvedValueOnce('gaps\nTOP CONCEPT: X');
    const agent = makeAgentHandle({ think });

    await marketGapDiscoverySkill.execute({ agent, task: makeTask(), input: {} });

    const extractPrompt = think.mock.calls[2][0] as string;
    expect(extractPrompt).toContain("only have each result's title, URL, and a short description");
    expect(extractPrompt).toContain('never invent or extrapolate');
  });

  it('does not propose an ops handoff when offerOpsHandoff is not set', async () => {
    const agent = makeAgentHandle();

    await marketGapDiscoverySkill.execute({ agent, task: makeTask(), input: {} });

    expect(agent.proposeAction).toHaveBeenCalledTimes(1); // only "store findings"
    expect(agent.emit).not.toHaveBeenCalledWith('agent:handoff_requested', expect.anything());
  });

  it('proposes a second approval for the ops handoff, using the parsed TOP CONCEPT', async () => {
    const proposeAction = jest.fn().mockResolvedValue(true);
    const agent = makeAgentHandle({ proposeAction });

    await marketGapDiscoverySkill.execute({
      agent,
      task: makeTask(),
      input: { offerOpsHandoff: { workflow: 'nixlevel-listing' } },
    });

    expect(proposeAction).toHaveBeenCalledTimes(2);
    expect(proposeAction).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.stringContaining('Widget Pro'),
      expect.objectContaining({ workflow: 'nixlevel-listing' })
    );
  });

  it('emits agent:handoff_requested with a well-formed NixOps task once the handoff approval is granted', async () => {
    const agent = makeAgentHandle();

    await marketGapDiscoverySkill.execute({
      agent,
      task: makeTask(),
      input: { offerOpsHandoff: { workflow: 'nixlevel-listing' } },
    });

    const handoffCall = (agent.emit as jest.Mock).mock.calls.find(
      (c) => c[0] === 'agent:handoff_requested' && c[1].task.input.type === 'run_workflow'
    );
    expect(handoffCall).toBeDefined();
    const brief = handoffCall[1].task.input.brief as string;
    expect(brief).toContain('Widget Pro');
    expect(brief).toContain('does not excuse a genuinely missing shop setting');
  });

  it('does not emit a handoff when no TOP CONCEPT line was parsed', async () => {
    const think = jest
      .fn()
      .mockResolvedValueOnce('expand\nNICHES: a')
      .mockResolvedValueOnce('search')
      .mockResolvedValueOnce('pain points')
      .mockResolvedValueOnce('gap analysis with no parseable top-concept line');
    const agent = makeAgentHandle({ think });

    await marketGapDiscoverySkill.execute({
      agent,
      task: makeTask(),
      input: { offerOpsHandoff: { workflow: 'nixlevel-listing' } },
    });

    expect(agent.proposeAction).toHaveBeenCalledTimes(1); // only "store findings", no handoff offer
    expect(agent.emit).not.toHaveBeenCalledWith('agent:handoff_requested', expect.anything());
  });

  it('continues (does not throw) when a niche search fails', async () => {
    const useTool = jest.fn().mockRejectedValue(new Error('brave_search down'));
    const agent = makeAgentHandle({ useTool });

    await expect(
      marketGapDiscoverySkill.execute({ agent, task: makeTask(), input: {} })
    ).resolves.not.toThrow();
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:market_gap_search_failed',
      expect.objectContaining({ error: expect.stringContaining('brave_search down') })
    );
  });
});
