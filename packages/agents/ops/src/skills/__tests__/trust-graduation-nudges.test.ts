import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { AgentTask, SkillAgentHandle } from '@wireassist/core';
import { findGraduationCandidates, trustGraduationNudgesSkill } from '../trust-graduation-nudges';
import { getTrustStage, setTrustStage } from '../../trust-stage';
import { listWorkflows } from '../../context-loader';

// Mocked so execute()'s tests can use fake workflow names without touching
// real files under context/workflows/ — setTrustStage() writes to the real
// file when a candidate is approved, so a real name here would mutate repo
// state as a side effect of running the test suite.
jest.mock('../../context-loader');
const mockedListWorkflows = listWorkflows as jest.MockedFunction<typeof listWorkflows>;

function decision(overrides: {
  action?: string;
  workflow?: string | undefined;
  status: 'approved' | 'rejected';
}) {
  return {
    action: overrides.action ?? 'deliver_workflow_output',
    payload: overrides.workflow === undefined ? {} : { workflow: overrides.workflow },
    status: overrides.status,
  };
}

describe('findGraduationCandidates()', () => {
  it('excludes a workflow with fewer than 3 resolved decisions', () => {
    const decisions = [
      decision({ workflow: 'test-workflow-alpha', status: 'approved' }),
      decision({ workflow: 'test-workflow-alpha', status: 'approved' }),
    ];
    expect(findGraduationCandidates(decisions)).toEqual([]);
  });

  it('flags a workflow whose most recent 3 decisions are all approved', () => {
    const decisions = [
      decision({ workflow: 'test-workflow-alpha', status: 'approved' }),
      decision({ workflow: 'test-workflow-alpha', status: 'approved' }),
      decision({ workflow: 'test-workflow-alpha', status: 'approved' }),
    ];
    expect(findGraduationCandidates(decisions)).toEqual([
      { workflow: 'test-workflow-alpha', streak: 3 },
    ]);
  });

  it('excludes a workflow whose streak was broken by a rejection', () => {
    const decisions = [
      decision({ workflow: 'test-workflow-alpha', status: 'approved' }),
      decision({ workflow: 'test-workflow-alpha', status: 'rejected' }),
      decision({ workflow: 'test-workflow-alpha', status: 'approved' }),
    ];
    expect(findGraduationCandidates(decisions)).toEqual([]);
  });

  it('ignores decisions whose action is not deliver_workflow_output', () => {
    const decisions = [
      decision({ action: 'something_else', workflow: 'test-workflow-alpha', status: 'approved' }),
      decision({ action: 'something_else', workflow: 'test-workflow-alpha', status: 'approved' }),
      decision({ action: 'something_else', workflow: 'test-workflow-alpha', status: 'approved' }),
    ];
    expect(findGraduationCandidates(decisions)).toEqual([]);
  });

  it('ignores decisions with a non-string or missing payload.workflow', () => {
    const decisions = [
      decision({ workflow: undefined, status: 'approved' }),
      decision({ workflow: undefined, status: 'approved' }),
      decision({ workflow: undefined, status: 'approved' }),
    ];
    expect(findGraduationCandidates(decisions)).toEqual([]);
  });

  it('tracks multiple workflows independently', () => {
    const decisions = [
      decision({ workflow: 'test-workflow-alpha', status: 'approved' }),
      decision({ workflow: 'test-workflow-beta', status: 'rejected' }),
      decision({ workflow: 'test-workflow-alpha', status: 'approved' }),
      decision({ workflow: 'test-workflow-beta', status: 'rejected' }),
      decision({ workflow: 'test-workflow-alpha', status: 'approved' }),
      decision({ workflow: 'test-workflow-beta', status: 'rejected' }),
    ];
    expect(findGraduationCandidates(decisions)).toEqual([
      { workflow: 'test-workflow-alpha', streak: 3 },
    ]);
  });
});

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-ops-1',
    agentRole: 'strategy',
    description: 'Trust graduation nudges',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'trust_graduation_nudges' },
    approvalRequired: true,
    ...overrides,
  };
}

function makeAgentHandle(overrides: Partial<SkillAgentHandle> = {}): SkillAgentHandle {
  return {
    think: jest.fn().mockResolvedValue('Summary.'),
    useTool: jest.fn(),
    loadContext: jest.fn().mockResolvedValue(''),
    remember: jest.fn(),
    proposeAction: jest.fn().mockResolvedValue(true),
    emit: jest.fn(),
    runToolLoop: jest.fn().mockResolvedValue(''),
    listDecisions: jest.fn().mockReturnValue([]),
    listPending: jest.fn().mockReturnValue([]),
    listMemories: jest.fn().mockReturnValue([]),
    ...overrides,
  };
}

describe('trustGraduationNudgesSkill.execute()', () => {
  // Uses the real trust-stage module against an isolated temp file (same
  // approach admin-agent.test.ts uses for auto-approve-policy.ts) so
  // setTrustStage()'s actual persistence is exercised, not mocked.
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'wireassist-ops-trust-'));
    process.env.WIREASSIST_OPS_TRUST_FILE = join(tempDir, 'ops-trust.json');
    // Covers every fake workflow name used by the tests below by default —
    // individual tests override this when they need to test the "workflow
    // no longer exists" filter specifically.
    mockedListWorkflows.mockReturnValue([
      'test-workflow-alpha',
      'test-workflow-beta',
      'test-workflow-already-graduated',
    ]);
  });

  afterEach(() => {
    delete process.env.WIREASSIST_OPS_TRUST_FILE;
    rmSync(tempDir, { recursive: true, force: true });
    jest.resetAllMocks();
  });

  const streakFor = (workflow: string) => [
    decision({ workflow, status: 'approved' }),
    decision({ workflow, status: 'approved' }),
    decision({ workflow, status: 'approved' }),
  ];

  it('emits the empty-state summary and never calls proposeAction when there are no candidates', async () => {
    const agent = makeAgentHandle({ listDecisions: jest.fn().mockReturnValue([]) });

    await trustGraduationNudgesSkill.execute({ agent, task: makeTask(), input: {} });

    expect(agent.proposeAction).not.toHaveBeenCalled();
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:trust_graduation_nudges_complete',
      expect.objectContaining({
        summary: 'No workflows are ready to graduate trust stage yet.',
        candidates: [],
      })
    );
  });

  it('proposes graduation and advances the trust stage when approved', async () => {
    const proposeAction = jest.fn().mockResolvedValue(true);
    const agent = makeAgentHandle({
      listDecisions: jest.fn().mockReturnValue(streakFor('test-workflow-alpha')),
      proposeAction,
    });

    await trustGraduationNudgesSkill.execute({ agent, task: makeTask(), input: {} });

    expect(proposeAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('Graduate workflow "test-workflow-alpha" to trust stage 3'),
      expect.objectContaining({
        workflow: 'test-workflow-alpha',
        currentStage: 2,
        targetStage: 3,
        streak: 3,
      })
    );
    expect(getTrustStage('test-workflow-alpha')).toBe(3);
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:trust_graduation_nudges_complete',
      expect.objectContaining({
        candidates: [{ workflow: 'test-workflow-alpha', streak: 3, approved: true }],
      })
    );
  });

  it('leaves the trust stage unchanged when the graduation proposal is declined', async () => {
    const proposeAction = jest.fn().mockResolvedValue(false);
    const agent = makeAgentHandle({
      listDecisions: jest.fn().mockReturnValue(streakFor('test-workflow-alpha')),
      proposeAction,
    });

    await trustGraduationNudgesSkill.execute({ agent, task: makeTask(), input: {} });

    expect(getTrustStage('test-workflow-alpha')).toBe(2);
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:trust_graduation_nudges_complete',
      expect.objectContaining({
        candidates: [{ workflow: 'test-workflow-alpha', streak: 3, approved: false }],
      })
    );
  });

  it('never proposes graduation for a workflow already at trust stage 3', async () => {
    // A nonexistent workflow name — setTrustStage()'s syncWorkflowFile() no-ops
    // when the workflow markdown file doesn't exist, so this can't touch any
    // real file under context/workflows/.
    setTrustStage('test-workflow-already-graduated', 3);
    const proposeAction = jest.fn().mockResolvedValue(true);
    const agent = makeAgentHandle({
      listDecisions: jest.fn().mockReturnValue(streakFor('test-workflow-already-graduated')),
      proposeAction,
    });

    await trustGraduationNudgesSkill.execute({ agent, task: makeTask(), input: {} });

    expect(proposeAction).not.toHaveBeenCalled();
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:trust_graduation_nudges_complete',
      expect.objectContaining({ candidates: [] })
    );
  });

  it('never proposes graduation for a workflow that no longer exists (renamed/deleted since its approval history)', async () => {
    mockedListWorkflows.mockReturnValue(['some-other-workflow']);
    const proposeAction = jest.fn().mockResolvedValue(true);
    const agent = makeAgentHandle({
      listDecisions: jest.fn().mockReturnValue(streakFor('test-workflow-deleted')),
      proposeAction,
    });

    await trustGraduationNudgesSkill.execute({ agent, task: makeTask(), input: {} });

    expect(proposeAction).not.toHaveBeenCalled();
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:trust_graduation_nudges_complete',
      expect.objectContaining({ candidates: [] })
    );
  });

  it('handles multiple independent candidates in one run', async () => {
    const proposeAction = jest
      .fn()
      .mockResolvedValueOnce(true) // test-workflow-alpha: approved
      .mockResolvedValueOnce(false); // test-workflow-beta: declined
    const agent = makeAgentHandle({
      listDecisions: jest
        .fn()
        .mockReturnValue([...streakFor('test-workflow-alpha'), ...streakFor('test-workflow-beta')]),
      proposeAction,
    });

    await trustGraduationNudgesSkill.execute({ agent, task: makeTask(), input: {} });

    expect(getTrustStage('test-workflow-alpha')).toBe(3);
    expect(getTrustStage('test-workflow-beta')).toBe(2);
    expect(agent.emit).toHaveBeenCalledWith(
      'agent:trust_graduation_nudges_complete',
      expect.objectContaining({
        candidates: [
          { workflow: 'test-workflow-alpha', streak: 3, approved: true },
          { workflow: 'test-workflow-beta', streak: 3, approved: false },
        ],
      })
    );
  });
});
