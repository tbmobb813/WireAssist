import {
  PortfolioStore,
  WipLimitError,
  IllegalTransitionError,
  currentIsoWeek,
} from '../../portfolio/store';
import { unlinkSync, existsSync } from 'fs';

const TEST_DB = './test-portfolio.db';

describe('PortfolioStore', () => {
  let store: PortfolioStore;

  beforeEach(() => {
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    store = new PortfolioStore(TEST_DB);
  });

  afterEach(() => {
    store.close();
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  });

  describe('projects', () => {
    it('creates a project defaulting to paused', async () => {
      const id = await store.createProject({ name: 'RiskForm', lane: 'product' });
      const p = await store.getProject(id);
      expect(p?.status).toBe('paused');
      expect(p?.name).toBe('RiskForm');
    });

    it('enforces the active WIP limit on create', async () => {
      await store.createProject({ name: 'A', lane: 'product', status: 'active' });
      await store.createProject({ name: 'B', lane: 'client', status: 'active' });
      await expect(
        store.createProject({ name: 'C', lane: 'product', status: 'active' })
      ).rejects.toThrow(WipLimitError);
    });

    it('enforces the WIP limit on transition to active', async () => {
      await store.createProject({ name: 'A', lane: 'product', status: 'active' });
      await store.createProject({ name: 'B', lane: 'client', status: 'active' });
      const c = await store.createProject({ name: 'C', lane: 'product' });
      await expect(store.transition(c, 'active')).rejects.toThrow(WipLimitError);
    });

    it('frees WIP capacity when a project is paused', async () => {
      const a = await store.createProject({ name: 'A', lane: 'product', status: 'active' });
      await store.createProject({ name: 'B', lane: 'client', status: 'active' });
      await store.transition(a, 'paused', 'resume: finish CLI');
      const c = await store.createProject({ name: 'C', lane: 'product' });
      await expect(store.transition(c, 'active')).resolves.toBeUndefined();
      expect((await store.getProject(a))?.resumeNote).toBe('resume: finish CLI');
    });

    it('rejects illegal transitions', async () => {
      const id = await store.createProject({ name: 'A', lane: 'product', status: 'active' });
      await store.transition(id, 'done');
      await expect(store.transition(id, 'active')).rejects.toThrow(IllegalTransitionError);
    });

    it('rejects icebox -> done (must pass through paused/active)', async () => {
      const id = await store.createProject({ name: 'A', lane: 'product', status: 'icebox' });
      await expect(store.transition(id, 'done')).rejects.toThrow(IllegalTransitionError);
    });

    it('lists by status', async () => {
      await store.createProject({ name: 'A', lane: 'product', status: 'active' });
      await store.createProject({ name: 'B', lane: 'product', status: 'icebox' });
      expect((await store.listProjects({ status: 'active' })).length).toBe(1);
      expect((await store.listProjects()).length).toBe(2);
    });
  });

  describe('events (append-only ledger)', () => {
    it('records create and transition events', async () => {
      const id = await store.createProject({ name: 'A', lane: 'product', status: 'active' });
      await store.transition(id, 'paused');
      const events = await store.listEvents({ projectId: id });
      const types = events.map((e) => e.type);
      expect(types).toContain('project.created');
      expect(types).toContain('project.transitioned');
      const t = events.find((e) => e.type === 'project.transitioned');
      expect(t?.payload).toEqual({ from: 'active', to: 'paused' });
    });

    it('exposes no mutation API for events', () => {
      const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(store));
      expect(proto.some((m) => /event/i.test(m) && /(update|delete|remove)/i.test(m))).toBe(false);
    });
  });

  describe('weekly focus', () => {
    it('requires an active project', async () => {
      const id = await store.createProject({ name: 'A', lane: 'product' }); // paused
      await expect(
        store.setWeeklyFocus({ productProjectId: id, careerMilestone: 'Apply to 2 DC roles' })
      ).rejects.toThrow(/active/);
    });

    it('sets and reads the current week, and upserts on repeat', async () => {
      const id = await store.createProject({ name: 'A', lane: 'product', status: 'active' });
      const first = await store.setWeeklyFocus({
        productProjectId: id,
        careerMilestone: 'Messer 3 modules',
      });
      const second = await store.setWeeklyFocus({
        productProjectId: id,
        careerMilestone: 'Messer 5 modules',
      });
      expect(second.careerMilestone).toBe('Messer 5 modules');
      expect(second.isoWeek).toBe(currentIsoWeek());
      // Upsert preserves original created_at; return value must match DB.
      expect(second.createdAt).toBe(first.createdAt);
      const focus = await store.getWeeklyFocus();
      expect(focus?.careerMilestone).toBe('Messer 5 modules');
      expect(focus?.createdAt).toBe(first.createdAt);
    });

    it('today() returns focus null when unset — the dashboard gate condition', async () => {
      const t = await store.today();
      expect(t.focus).toBeNull();
      expect(t.active).toEqual([]);
    });
  });

  describe('currentIsoWeek', () => {
    it('computes ISO-8601 edge cases correctly', () => {
      expect(currentIsoWeek(new Date('2026-01-01'))).toBe('2026-W01'); // Thu
      expect(currentIsoWeek(new Date('2027-01-01'))).toBe('2026-W53'); // Fri -> prev ISO year
      expect(currentIsoWeek(new Date('2026-07-03'))).toBe('2026-W27');
    });
  });
});
