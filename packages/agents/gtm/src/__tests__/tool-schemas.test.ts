import { GTM_TOOL_SCHEMAS, READ_ONLY_GTM_TOOLS, GTM_SKILL_TOOLS } from '../tool-schemas';

describe('GTM_SKILL_TOOLS', () => {
  it('is disjoint from READ_ONLY_GTM_TOOLS — skill-tools are never valid useTool()/MCP calls', () => {
    for (const name of GTM_SKILL_TOOLS) {
      expect(READ_ONLY_GTM_TOOLS.has(name)).toBe(false);
    }
  });

  it('every skill-tool name has a matching schema entry', () => {
    for (const name of GTM_SKILL_TOOLS) {
      expect(GTM_TOOL_SCHEMAS).toHaveProperty(name);
    }
  });

  it('contains exactly generate_gtm_skill and generate_psych_skill', () => {
    expect([...GTM_SKILL_TOOLS].sort()).toEqual(['generate_gtm_skill', 'generate_psych_skill']);
  });

  it('READ_ONLY_GTM_TOOLS is empty — GTM has no raw MCP tools today', () => {
    expect(READ_ONLY_GTM_TOOLS.size).toBe(0);
  });

  it('each schema requires a product with at least a name', () => {
    for (const name of GTM_SKILL_TOOLS) {
      const schema = GTM_TOOL_SCHEMAS[name].inputSchema as {
        required: string[];
        properties: { product: { required: string[] } };
      };
      expect(schema.required).toEqual(['product']);
      expect(schema.properties.product.required).toEqual(['name']);
    }
  });
});
