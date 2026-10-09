import { DISPATCH_TOOL_NAMES, buildChatDispatchToolSchemas } from '../chat-dispatch';

describe('DISPATCH_TOOL_NAMES', () => {
  it('lists exactly the 11 dispatch tool names', () => {
    expect([...DISPATCH_TOOL_NAMES].sort()).toEqual(
      [
        'dispatch_content_post',
        'dispatch_content_plan',
        'dispatch_content_campaign',
        'dispatch_content_freeform',
        'dispatch_research_topic',
        'dispatch_research_freeform',
        'dispatch_ops_workflow',
        'dispatch_ops_freeform',
        'dispatch_gtm_freeform',
        'redirect_to_gtm_wizard',
        'dispatch_github_freeform',
      ].sort()
    );
  });
});

describe('buildChatDispatchToolSchemas', () => {
  const schemas = buildChatDispatchToolSchemas();

  it('has one schema per name in DISPATCH_TOOL_NAMES, no more, no less', () => {
    expect(Object.keys(schemas).sort()).toEqual([...DISPATCH_TOOL_NAMES].sort());
  });

  it("every schema's own name field matches its key", () => {
    for (const [key, schema] of Object.entries(schemas)) {
      expect(schema.name).toBe(key);
    }
  });

  it('every schema has a non-empty description and a valid inputSchema object', () => {
    for (const schema of Object.values(schemas)) {
      expect(schema.description.length).toBeGreaterThan(0);
      expect(schema.inputSchema).toMatchObject({ type: 'object' });
    }
  });

  it('dispatch_content_post requires topic, platform, and account', () => {
    const s = schemas.dispatch_content_post.inputSchema as { required: string[] };
    expect(s.required).toEqual(['topic', 'platform', 'account']);
  });

  it('dispatch_content_plan and dispatch_content_campaign require account', () => {
    const plan = schemas.dispatch_content_plan.inputSchema as { required: string[] };
    const campaign = schemas.dispatch_content_campaign.inputSchema as { required: string[] };
    expect(plan.required).toEqual(['account']);
    expect(campaign.required).toEqual(['account']);
  });

  it('dispatch_ops_workflow requires workflow and brief', () => {
    const s = schemas.dispatch_ops_workflow.inputSchema as { required: string[] };
    expect(s.required).toEqual(['workflow', 'brief']);
  });

  it('redirect_to_gtm_wizard takes no input fields', () => {
    const s = schemas.redirect_to_gtm_wizard.inputSchema as { properties: object };
    expect(Object.keys(s.properties)).toHaveLength(0);
  });

  it('every *_freeform tool requires a prompt string', () => {
    const freeformNames = [...DISPATCH_TOOL_NAMES].filter((n) => n.endsWith('_freeform'));
    expect(freeformNames.length).toBeGreaterThan(0);
    for (const name of freeformNames) {
      const s = schemas[name].inputSchema as { required: string[] };
      expect(s.required).toEqual(['prompt']);
    }
  });
});

describe('live lookups are routed to the freeform research dispatch', () => {
  const schemas = buildChatDispatchToolSchemas();

  // The topic dispatch has no recency filter and ends in a "store findings"
  // approval; a live lookup (price, news) sent there returned stale pages and
  // an approval card. These descriptions are the only routing signal the
  // model gets, so pin them.
  it('tells the model live lookups belong on dispatch_research_freeform', () => {
    expect(schemas.dispatch_research_freeform.description).toMatch(/live lookup/i);
    expect(schemas.dispatch_research_freeform.description).toMatch(/news/i);
  });

  it('tells the model NOT to use dispatch_research_topic for live lookups', () => {
    expect(schemas.dispatch_research_topic.description).toMatch(/NOT for live lookups/);
    expect(schemas.dispatch_research_topic.description).not.toMatch(
      /OR use this for a specific fact/
    );
  });
});
