import { ObjectiveStore } from '../../objectives/store';
import { unlinkSync, existsSync } from 'fs';

const TEST_DB = './test-objectives.db';

describe('ObjectiveStore', () => {
  let store: ObjectiveStore;

  beforeEach(() => {
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    store = new ObjectiveStore(TEST_DB);
  });

  afterEach(() => {
    store.close();
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  });

  describe('objectives', () => {
    it('creates an objective defaulting to active', async () => {
      const id = await store.createObjective({ title: 'Launch StatusWatch v2' });
      const o = await store.getObjective(id);
      expect(o?.status).toBe('active');
      expect(o?.title).toBe('Launch StatusWatch v2');
      expect(o?.description).toBeNull();
    });

    it('stores an optional description', async () => {
      const id = await store.createObjective({
        title: 'Launch StatusWatch v2',
        description: 'Get to 10 paying customers',
      });
      expect((await store.getObjective(id))?.description).toBe('Get to 10 paying customers');
    });

    it('lists by status', async () => {
      await store.createObjective({ title: 'A', status: 'active' });
      await store.createObjective({ title: 'B', status: 'paused' });
      expect((await store.listObjectives({ status: 'active' })).length).toBe(1);
      expect((await store.listObjectives()).length).toBe(2);
    });

    it('returns null for an unknown id', async () => {
      expect(await store.getObjective('nope')).toBeNull();
    });
  });

  describe('transition', () => {
    it('allows any status to any other — unconstrained by design', async () => {
      const id = await store.createObjective({ title: 'A', status: 'completed' });
      await expect(store.transition(id, 'active')).resolves.toBeUndefined();
      expect((await store.getObjective(id))?.status).toBe('active');
    });

    it('records an objective.transitioned event', async () => {
      const id = await store.createObjective({ title: 'A' });
      await store.transition(id, 'paused');
      const events = await store.listEvents({ objectiveId: id });
      const t = events.find((e) => e.type === 'objective.transitioned');
      expect(t?.payload).toEqual({ from: 'active', to: 'paused' });
    });

    it('throws for an unknown id', async () => {
      await expect(store.transition('nope', 'paused')).rejects.toThrow(/not found/i);
    });
  });

  describe('updateObjective', () => {
    it('updates title/description without an event', async () => {
      const id = await store.createObjective({ title: 'A' });
      const updated = await store.updateObjective(id, { title: 'B', description: 'new desc' });
      expect(updated.title).toBe('B');
      expect(updated.description).toBe('new desc');
      const events = await store.listEvents({ objectiveId: id });
      expect(events.some((e) => e.type.startsWith('objective.updated'))).toBe(false);
    });
  });

  describe('events (append-only ledger)', () => {
    it('records a create event', async () => {
      const id = await store.createObjective({ title: 'A' });
      const events = await store.listEvents({ objectiveId: id });
      expect(events.map((e) => e.type)).toContain('objective.created');
    });

    it('exposes no mutation API for events', () => {
      const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(store));
      expect(proto.some((m) => /event/i.test(m) && /(update|delete|remove)/i.test(m))).toBe(false);
    });

    it('recordAgentEvent() appends an externally-triggered event, queryable by objectiveId', async () => {
      const id = await store.createObjective({ title: 'A' });
      await store.recordAgentEvent('agent.task_started', id, {
        agentRole: 'content',
        taskId: 't1',
      });
      const events = await store.listEvents({ objectiveId: id });
      const e = events.find((ev) => ev.type === 'agent.task_started');
      expect(e?.payload).toEqual({ agentRole: 'content', taskId: 't1' });
    });

    it("listEvents scoped by objectiveId does not leak another objective's events", async () => {
      const a = await store.createObjective({ title: 'A' });
      const b = await store.createObjective({ title: 'B' });
      await store.recordAgentEvent('agent.task_started', a, { taskId: 't-a' });
      await store.recordAgentEvent('agent.task_started', b, { taskId: 't-b' });
      const eventsForA = await store.listEvents({ objectiveId: a });
      expect(eventsForA.every((e) => e.objectiveId === a)).toBe(true);
      expect(eventsForA.some((e) => e.payload?.taskId === 't-b')).toBe(false);
    });
  });
});
