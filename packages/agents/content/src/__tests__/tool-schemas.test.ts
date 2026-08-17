import {
  CONTENT_TOOL_SCHEMAS,
  READ_ONLY_CONTENT_TOOLS,
  CONTENT_SKILL_TOOLS,
} from '../tool-schemas';

describe('CONTENT_SKILL_TOOLS', () => {
  it('is disjoint from READ_ONLY_CONTENT_TOOLS — skill-tools are never valid useTool()/MCP calls', () => {
    for (const name of CONTENT_SKILL_TOOLS) {
      expect(READ_ONLY_CONTENT_TOOLS.has(name)).toBe(false);
    }
  });

  it('every skill-tool name has a matching schema entry', () => {
    for (const name of CONTENT_SKILL_TOOLS) {
      expect(CONTENT_TOOL_SCHEMAS).toHaveProperty(name);
    }
  });

  it('mirrors every registered content skill except freeform', () => {
    expect([...CONTENT_SKILL_TOOLS].sort()).toEqual(
      [
        'generate_post_skill',
        'generate_plan_skill',
        'generate_plan_from_timeline_skill',
        'schedule_post_skill',
        'analyze_post_skill',
        'list_scheduled_skill',
      ].sort()
    );
  });
});
