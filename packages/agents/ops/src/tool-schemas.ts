import type { ProviderToolDefinition } from '@wireassist/core';

// LLM-facing name/description/input_schema for every tool NixOps can be
// authorized to call. NixOpsAgent's constructor filters this down to
// whatever's actually in config.tools — being listed here never grants
// authorization on its own (useTool() still checks config.tools).
export const OPS_TOOL_SCHEMAS: Record<string, ProviderToolDefinition> = {
  sheets_read: {
    name: 'sheets_read',
    description: 'Read a range of cells from a Google Sheet.',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: { type: 'string' },
        range: { type: 'string', description: 'A1 notation, e.g. "Sheet1!A1:C10".' },
      },
      required: ['spreadsheetId', 'range'],
    },
  },
  // ── Local, read-only (no external API) ──────────────────────────
  list_workflows: {
    name: 'list_workflows',
    description:
      'List every registered NixOps workflow, each with its exact name and a one-sentence "useWhen" trigger description. Call this before run_workflow_skill if you are not certain of the exact workflow name, or when two workflows could plausibly fit the brief — read useWhen to pick the right one rather than guessing from the name alone.',
    inputSchema: { type: 'object', properties: {} },
  },
  // ── Skill, exposed as a composable tool (dispatched via invokeSkill(),
  // not useTool() — see NixOpsAgent.executeToolCall()). Runs the full DATA
  // loop (diagnose -> assemble -> take_action -> assess) behind one call
  // and self-gates its own delivery with an internal proposeAction() call,
  // so it executes immediately at this outer level rather than being
  // approval-gated a second time. Named with a `_skill` suffix to stay
  // visually distinct from raw MCP tool names above.
  run_workflow_skill: {
    name: 'run_workflow_skill',
    description:
      'Run a named NixOps workflow through the full DATA loop (diagnose, assemble, take action, assess) and propose delivering the result. Call list_workflows first if you are not certain of the exact workflow name.',
    inputSchema: {
      type: 'object',
      properties: {
        workflow: { type: 'string', description: 'Exact workflow name from list_workflows.' },
        brief: { type: 'string', description: 'What this run should accomplish.' },
      },
      required: ['workflow', 'brief'],
    },
  },
};

// Tool names that only ever read data — safe to execute immediately in the
// chat tool loop without going through the approval queue.
export const READ_ONLY_OPS_TOOLS = new Set<string>(['sheets_read', 'list_workflows']);

// Skill-tool names dispatched via invokeSkill() rather than useTool() — see
// NixOpsAgent.executeToolCall(). Kept separate from READ_ONLY_OPS_TOOLS
// since these are never valid useTool()/MCP calls.
export const OPS_SKILL_TOOLS = new Set<string>(['run_workflow_skill']);
