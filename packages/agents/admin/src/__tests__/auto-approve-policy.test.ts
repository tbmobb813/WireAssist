import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

let tempDir: string;
let policy: typeof import('../auto-approve-policy');

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'wireassist-auto-approve-'));
  process.env.WIREASSIST_ADMIN_AUTO_APPROVE_FILE = join(tempDir, 'admin-auto-approve.json');
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  policy = require('../auto-approve-policy');
});

afterEach(() => {
  delete process.env.WIREASSIST_ADMIN_AUTO_APPROVE_FILE;
  rmSync(tempDir, { recursive: true, force: true });
});

describe('isAutoApproveEligibleType()', () => {
  it('accepts label_thread actions whose label matches an ignore/low-priority pattern', () => {
    expect(
      policy.isAutoApproveEligibleType({
        type: 'gmail_label_thread',
        payload: { labelName: 'IGNORED' },
      })
    ).toBe(true);
    expect(
      policy.isAutoApproveEligibleType({
        type: 'gmail_label_thread',
        payload: { labelName: 'low-priority' },
      })
    ).toBe(true);
  });

  it('rejects label_thread actions for any other label', () => {
    expect(
      policy.isAutoApproveEligibleType({
        type: 'gmail_label_thread',
        payload: { labelName: 'URGENT' },
      })
    ).toBe(false);
  });

  it.each([
    'gmail_send',
    'gmail_create_draft',
    'gmail_archive_thread',
    'gmail_trash_thread',
    'gmail_mark_spam',
    'calendar_create_event',
    'calendar_update_event',
    'calendar_delete_event',
    'calendar_respond_to_event',
    'sheets_append',
    'sheets_update',
  ])('always rejects %s regardless of payload', (type) => {
    expect(policy.isAutoApproveEligibleType({ type, payload: { labelName: 'IGNORED' } })).toBe(
      false
    );
  });
});

describe('recordDecision() / isEligibleForAutoApproval()', () => {
  it('is not eligible before any decisions are recorded', () => {
    expect(policy.isEligibleForAutoApproval('a@example.com')).toBe(false);
  });

  it('is not eligible below the approval threshold', () => {
    policy.recordDecision('a@example.com', true);
    policy.recordDecision('a@example.com', true);
    expect(policy.isEligibleForAutoApproval('a@example.com')).toBe(false);
  });

  it('becomes eligible once consecutive approvals hit the threshold', () => {
    for (let i = 0; i < policy.AUTO_APPROVE_THRESHOLD; i++) {
      policy.recordDecision('a@example.com', true);
    }
    expect(policy.isEligibleForAutoApproval('a@example.com')).toBe(true);
  });

  it('resets the streak and revokes eligibility on a rejection', () => {
    for (let i = 0; i < policy.AUTO_APPROVE_THRESHOLD; i++) {
      policy.recordDecision('a@example.com', true);
    }
    expect(policy.isEligibleForAutoApproval('a@example.com')).toBe(true);

    policy.recordDecision('a@example.com', false);
    expect(policy.isEligibleForAutoApproval('a@example.com')).toBe(false);
  });

  it('tracks senders independently', () => {
    for (let i = 0; i < policy.AUTO_APPROVE_THRESHOLD; i++) {
      policy.recordDecision('a@example.com', true);
    }
    expect(policy.isEligibleForAutoApproval('a@example.com')).toBe(true);
    expect(policy.isEligibleForAutoApproval('b@example.com')).toBe(false);
  });

  it('normalizes "Name <email>" senders to the bare, lowercased email', () => {
    for (let i = 0; i < policy.AUTO_APPROVE_THRESHOLD; i++) {
      policy.recordDecision('Alice Example <Alice@Example.com>', true);
    }
    expect(policy.isEligibleForAutoApproval('alice@example.com')).toBe(true);
    expect(policy.isEligibleForAutoApproval('someone <ALICE@EXAMPLE.COM>')).toBe(true);
  });

  it('persists across a fresh module load (same file)', () => {
    for (let i = 0; i < policy.AUTO_APPROVE_THRESHOLD; i++) {
      policy.recordDecision('a@example.com', true);
    }
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const reloaded = require('../auto-approve-policy');
    expect(reloaded.isEligibleForAutoApproval('a@example.com')).toBe(true);
  });
});

describe('setAutoApproveOverride()', () => {
  it('forces eligibility on even without any approval history', () => {
    expect(policy.isEligibleForAutoApproval('new@example.com')).toBe(false);
    policy.setAutoApproveOverride('new@example.com', true);
    expect(policy.isEligibleForAutoApproval('new@example.com')).toBe(true);
  });

  it('forces eligibility off even after crossing the threshold', () => {
    for (let i = 0; i < policy.AUTO_APPROVE_THRESHOLD; i++) {
      policy.recordDecision('a@example.com', true);
    }
    policy.setAutoApproveOverride('a@example.com', false);
    expect(policy.isEligibleForAutoApproval('a@example.com')).toBe(false);
  });

  it('clearing the override (null) falls back to the derived value', () => {
    policy.setAutoApproveOverride('a@example.com', true);
    policy.setAutoApproveOverride('a@example.com', null);
    expect(policy.isEligibleForAutoApproval('a@example.com')).toBe(false);
  });
});

describe('listAutoApproveRecords()', () => {
  it('returns all tracked senders keyed by normalized address', () => {
    policy.recordDecision('a@example.com', true);
    policy.recordDecision('b@example.com', false);
    const records = policy.listAutoApproveRecords();
    expect(Object.keys(records).sort()).toEqual(['a@example.com', 'b@example.com']);
  });
});
