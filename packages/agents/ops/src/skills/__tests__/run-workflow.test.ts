import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { AgentTask, SkillAgentHandle } from '@wireassist/core';

jest.mock('../../context-loader', () => ({
  loadWorkflow: jest.fn(),
  parseSheetRef: jest.fn().mockReturnValue(null),
  parsePublishTarget: jest.fn().mockReturnValue(null),
}));

import { loadWorkflow } from '../../context-loader';
import { setWorkflowSettings } from '../../workflow-settings';
import { runWorkflowSkill } from '../run-workflow';

const RAW_WORKFLOW = [
  '## Inputs',
  '- Variant naming convention: _SETTING: JNix pastes current convention here_',
  '- Printify base costs: _SETTING_PERIODIC: link or paste current cost sheet_',
].join('\n');

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-ops-run-1',
    agentRole: 'strategy',
    description: 'Run nixlevel-listing',
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    input: { type: 'run_workflow', workflow: 'nixlevel-listing', brief: 'a candle' },
    approvalRequired: true,
    ...overrides,
  };
}

function makeAgentHandle(overrides: Partial<SkillAgentHandle> = {}): SkillAgentHandle {
  return {
    think: jest.fn().mockResolvedValue('VERDICT: PROCEED'),
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

describe('runWorkflowSkill — settings merge and Diagnose enforcement', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'wireassist-ops-run-workflow-'));
    process.env.WIREASSIST_OPS_SETTINGS_FILE = join(tempDir, 'ops-workflow-settings.json');
    process.env.WIREASSIST_OPS_TRUST_FILE = join(tempDir, 'ops-trust.json');
    (loadWorkflow as jest.Mock).mockReturnValue(RAW_WORKFLOW);
  });

  afterEach(() => {
    delete process.env.WIREASSIST_OPS_SETTINGS_FILE;
    delete process.env.WIREASSIST_OPS_TRUST_FILE;
    rmSync(tempDir, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  it('feeds the model saved settings merged into the workflow text, not the raw placeholders', async () => {
    setWorkflowSettings('nixlevel-listing', { 'Variant naming convention': 'Scent - Size' });
    const think = jest.fn().mockResolvedValue('VERDICT: PROCEED');
    const agent = makeAgentHandle({ think });

    await runWorkflowSkill.execute({ agent, task: makeTask(), input: makeTask().input as any });

    const firstPrompt = think.mock.calls[0][0] as string;
    expect(firstPrompt).toContain('- Variant naming convention: Scent - Size');
    expect(firstPrompt).not.toContain('_SETTING: JNix pastes current convention here_');
    // A genuinely unfilled setting still shows its real placeholder — the
    // model needs to actually see the gap to correctly block on it.
    expect(firstPrompt).toContain('_SETTING_PERIODIC: link or paste current cost sheet_');
  });

  it('adds a staleness note to Diagnose when a periodic setting was last confirmed over 60 days ago', async () => {
    setWorkflowSettings('nixlevel-listing', { 'Printify base costs': '$4.20/unit' });
    // setWorkflowSettings() always stamps "now" — rewrite it to 90 days ago
    // directly in the settings store so the test doesn't depend on real time.
    const path = process.env.WIREASSIST_OPS_SETTINGS_FILE as string;
    const fsActual: typeof import('fs') = jest.requireActual('fs');
    const stored = JSON.parse(fsActual.readFileSync(path, 'utf-8'));
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    stored['nixlevel-listing']['Printify base costs'].updatedAt = ninetyDaysAgo;
    fsActual.writeFileSync(path, JSON.stringify(stored));

    const think = jest.fn().mockResolvedValue('VERDICT: PROCEED');
    const agent = makeAgentHandle({ think });

    await runWorkflowSkill.execute({ agent, task: makeTask(), input: makeTask().input as any });

    const diagnosePrompt = think.mock.calls[0][0] as string;
    expect(diagnosePrompt).toContain('"Printify base costs" was last confirmed');
    expect(diagnosePrompt).toContain('90 days ago');
  });

  it('adds no staleness note for a periodic setting confirmed recently', async () => {
    setWorkflowSettings('nixlevel-listing', { 'Printify base costs': '$4.20/unit' });
    const think = jest.fn().mockResolvedValue('VERDICT: PROCEED');
    const agent = makeAgentHandle({ think });

    await runWorkflowSkill.execute({ agent, task: makeTask(), input: makeTask().input as any });

    const diagnosePrompt = think.mock.calls[0][0] as string;
    expect(diagnosePrompt).not.toContain('was last confirmed');
  });

  it('instructs the model never to invent a value for a genuinely-missing setting, and to name it when blocking', async () => {
    const think = jest.fn().mockResolvedValue('VERDICT: PROCEED');
    const agent = makeAgentHandle({ think });

    await runWorkflowSkill.execute({ agent, task: makeTask(), input: makeTask().input as any });

    const diagnosePrompt = think.mock.calls[0][0] as string;
    expect(diagnosePrompt).toContain('never invent a plausible-sounding value');
    expect(diagnosePrompt).toContain('name the exact label(s) verbatim');
    expect(diagnosePrompt).toContain('Workflow settings');
  });

  it('stops after Diagnose and emits agent:ops_blocked when the model returns VERDICT: BLOCKED', async () => {
    const think = jest.fn().mockResolvedValueOnce('VERDICT: BLOCKED — Printify base costs missing');
    const emit = jest.fn();
    const agent = makeAgentHandle({ think, emit });

    await runWorkflowSkill.execute({ agent, task: makeTask(), input: makeTask().input as any });

    expect(think).toHaveBeenCalledTimes(1); // never reaches assemble/take_action/assess
    expect(emit).toHaveBeenCalledWith(
      'agent:ops_blocked',
      expect.objectContaining({ diagnosis: expect.stringContaining('Printify base costs missing') })
    );
  });
});
