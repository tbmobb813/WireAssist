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
};

// Tool names that only ever read data — safe to execute immediately in the
// chat tool loop without going through the approval queue.
export const READ_ONLY_OPS_TOOLS = new Set<string>(['sheets_read']);
