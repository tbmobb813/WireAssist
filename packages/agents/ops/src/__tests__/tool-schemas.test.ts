import { OPS_TOOL_SCHEMAS, READ_ONLY_OPS_TOOLS, OPS_SKILL_TOOLS } from '../tool-schemas';

describe('OPS_SKILL_TOOLS', () => {
  it('is disjoint from READ_ONLY_OPS_TOOLS — skill-tools are never valid useTool()/MCP calls', () => {
    for (const name of OPS_SKILL_TOOLS) {
      expect(READ_ONLY_OPS_TOOLS.has(name)).toBe(false);
    }
  });

  it('every skill-tool name has a matching schema entry', () => {
    for (const name of OPS_SKILL_TOOLS) {
      expect(OPS_TOOL_SCHEMAS).toHaveProperty(name);
    }
  });

  it('list_workflows is read-only and has a matching schema entry', () => {
    expect(READ_ONLY_OPS_TOOLS.has('list_workflows')).toBe(true);
    expect(OPS_TOOL_SCHEMAS).toHaveProperty('list_workflows');
  });
});
