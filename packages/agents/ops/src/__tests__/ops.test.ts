import { loadOpsContext, listWorkflows, loadWorkflow } from '../context-loader';
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
});
