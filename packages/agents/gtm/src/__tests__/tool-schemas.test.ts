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

  it('contains exactly generate_gtm_skill, generate_psych_skill, and propose_skill_skill', () => {
    expect([...GTM_SKILL_TOOLS].sort()).toEqual(
      ['generate_gtm_skill', 'generate_psych_skill', 'propose_skill_skill'].sort()
    );
  });

  it('READ_ONLY_GTM_TOOLS is empty — GTM has no raw MCP tools today', () => {
    expect(READ_ONLY_GTM_TOOLS.size).toBe(0);
  });

  it('each product-strategy schema requires a product with at least a name', () => {
    for (const name of ['generate_gtm_skill', 'generate_psych_skill']) {
      const schema = GTM_TOOL_SCHEMAS[name].inputSchema as {
        required: string[];
        properties: { product: { required: string[] } };
      };
      expect(schema.required).toEqual(['product']);
      expect(schema.properties.product.required).toEqual(['name']);
    }
  });

  it("propose_skill_skill's schema requires a request string, not a product", () => {
    const schema = GTM_TOOL_SCHEMAS.propose_skill_skill.inputSchema as { required: string[] };
    expect(schema.required).toEqual(['request']);
  });
});
