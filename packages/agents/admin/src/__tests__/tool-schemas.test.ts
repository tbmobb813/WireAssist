import { ADMIN_TOOL_SCHEMAS, READ_ONLY_ADMIN_TOOLS, ADMIN_SKILL_TOOLS } from '../tool-schemas';

describe('ADMIN_SKILL_TOOLS', () => {
  it('is disjoint from READ_ONLY_ADMIN_TOOLS — skill-tools are never valid useTool()/MCP calls', () => {
    for (const name of ADMIN_SKILL_TOOLS) {
      expect(READ_ONLY_ADMIN_TOOLS.has(name)).toBe(false);
    }
  });

  it('every skill-tool name has a matching schema entry', () => {
    for (const name of ADMIN_SKILL_TOOLS) {
      expect(ADMIN_TOOL_SCHEMAS).toHaveProperty(name);
    }
  });
});
