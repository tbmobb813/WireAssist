import {
  RESEARCH_TOOL_SCHEMAS,
  READ_ONLY_RESEARCH_TOOLS,
  RESEARCH_SKILL_TOOLS,
} from '../tool-schemas';

describe('RESEARCH_SKILL_TOOLS', () => {
  it('is disjoint from READ_ONLY_RESEARCH_TOOLS — skill-tools are never valid useTool()/MCP calls', () => {
    for (const name of RESEARCH_SKILL_TOOLS) {
      expect(READ_ONLY_RESEARCH_TOOLS.has(name)).toBe(false);
    }
  });

  it('every skill-tool name has a matching schema entry', () => {
    for (const name of RESEARCH_SKILL_TOOLS) {
      expect(RESEARCH_TOOL_SCHEMAS).toHaveProperty(name);
    }
  });

  it('research_topic_skill never exposes offerContentDraft on its model-callable schema', () => {
    const schema = RESEARCH_TOOL_SCHEMAS.research_topic_skill;
    const properties = (schema.inputSchema as { properties?: Record<string, unknown> }).properties;
    expect(properties).not.toHaveProperty('offerContentDraft');
  });
});
