import { loadOpsContext, listWorkflows, loadWorkflow, parseSheetRef } from '../context-loader';
import { createWorkflowRunTask, createOpsFreeformTask } from '../task-factory';

describe('context-loader', () => {
  it('loads SOUL, IDENTITY and USER files', () => {
    const ctx = loadOpsContext();
    expect(ctx.soul).toContain('DATA');
    expect(ctx.identity).toContain('NixOps');
    expect(ctx.user).toContain('JNix');
  });

  it('lists and loads workflows', () => {
    const workflows = listWorkflows();
    expect(workflows).toContain('nixlevel-listing');
    expect(loadWorkflow('nixlevel-listing')).toContain('Definition of Done');
  });

  it('rejects path traversal in workflow names', () => {
    expect(() => loadWorkflow('../SOUL')).toThrow(/Invalid workflow name/);
  });

  it('throws a helpful error for unknown workflows', () => {
    expect(() => loadWorkflow('nope')).toThrow(/Unknown workflow/);
  });
});

describe('parseSheetRef', () => {
  it('parses a spreadsheet id and range from a Sheet line', () => {
    const md = '**Trust stage:** 2\n\n**Sheet:** 1a2B3cD4eFgH | Costs!A1:D100\n';
    expect(parseSheetRef(md)).toEqual({ spreadsheetId: '1a2B3cD4eFgH', range: 'Costs!A1:D100' });
  });

  it('trims surrounding whitespace from the range', () => {
    const md = '**Sheet:**   1a2B3cD4eFgH   |   Costs!A1:D100   \n';
    expect(parseSheetRef(md)).toEqual({ spreadsheetId: '1a2B3cD4eFgH', range: 'Costs!A1:D100' });
  });

  it('returns null when no Sheet line is present', () => {
    expect(parseSheetRef('**Trust stage:** 2\n\nNo sheet here.')).toBeNull();
  });

  it('returns null for a malformed Sheet line missing the separator', () => {
    expect(parseSheetRef('**Sheet:** 1a2B3cD4eFgH Costs!A1:D100')).toBeNull();
  });
});

describe('task-factory', () => {
  it('creates a queued workflow task requiring approval', () => {
    const task = createWorkflowRunTask({ workflow: 'nixlevel-listing', brief: 'test hoodie' });
    expect(task.status).toBe('queued');
    expect(task.approvalRequired).toBe(true);
    expect(task.agentRole).toBe('strategy');
    expect(task.input).toMatchObject({ type: 'run_workflow', workflow: 'nixlevel-listing' });
  });

  it('creates a freeform task', () => {
    const task = createOpsFreeformTask({ prompt: 'status?' });
    expect(task.input).toMatchObject({ type: 'freeform', prompt: 'status?' });
  });

  it('carries history through on a freeform task when provided', () => {
    const history = [{ role: 'user' as const, content: 'earlier question' }];
    const task = createOpsFreeformTask({ prompt: 'status?', history });
    expect(task.input).toMatchObject({ type: 'freeform', prompt: 'status?', history });
  });
});
