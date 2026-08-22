import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  getWorkflowSettings,
  getWorkflowSettingsMeta,
  getWorkflowSettingLabels,
  setWorkflowSettings,
  applyWorkflowSettings,
} from '../workflow-settings';

// Isolated settings file per test, same pattern as nixops-agent.test.ts's
// WIREASSIST_OPS_TRUST_FILE override — deterministic regardless of any real
// ~/.wireassist state on the host.
let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'wireassist-ops-workflow-settings-'));
  process.env.WIREASSIST_OPS_SETTINGS_FILE = join(tempDir, 'ops-workflow-settings.json');
});

afterEach(() => {
  delete process.env.WIREASSIST_OPS_SETTINGS_FILE;
  rmSync(tempDir, { recursive: true, force: true });
});

describe('getWorkflowSettings() / setWorkflowSettings()', () => {
  it('returns an empty object for a workflow with no saved settings', () => {
    expect(getWorkflowSettings('nixlevel-listing')).toEqual({});
  });

  it('persists and retrieves settings for a workflow', () => {
    setWorkflowSettings('nixlevel-listing', { 'Variant naming convention': 'Scent - Size' });
    expect(getWorkflowSettings('nixlevel-listing')).toEqual({
      'Variant naming convention': 'Scent - Size',
    });
  });

  it('merges new values into existing settings rather than replacing them', () => {
    setWorkflowSettings('nixlevel-listing', { 'Variant naming convention': 'Scent - Size' });
    setWorkflowSettings('nixlevel-listing', { 'Printify base costs': 'see cost-sheet link' });
    expect(getWorkflowSettings('nixlevel-listing')).toEqual({
      'Variant naming convention': 'Scent - Size',
      'Printify base costs': 'see cost-sheet link',
    });
  });

  it('keeps settings scoped per workflow', () => {
    setWorkflowSettings('nixlevel-listing', { 'Variant naming convention': 'Scent - Size' });
    setWorkflowSettings('courier-route-log', { 'Fuel cost basis': '$3.50/gal, 22mpg' });
    expect(getWorkflowSettings('nixlevel-listing')).toEqual({
      'Variant naming convention': 'Scent - Size',
    });
    expect(getWorkflowSettings('courier-route-log')).toEqual({
      'Fuel cost basis': '$3.50/gal, 22mpg',
    });
  });

  it('survives being read again after the file already exists (persistence across "restarts")', () => {
    setWorkflowSettings('nixlevel-listing', { 'Variant naming convention': 'Scent - Size' });
    // A fresh read (no in-memory cache to fall back on) — proves this reads
    // from disk, not just from whatever setWorkflowSettings held in scope.
    expect(getWorkflowSettings('nixlevel-listing')).toEqual({
      'Variant naming convention': 'Scent - Size',
    });
  });
});

describe('applyWorkflowSettings()', () => {
  const markdown = [
    '## Inputs',
    '- Existing listing example to mirror: _SETTING: JNix pastes one best-performing listing here_',
    '- Variant naming convention: _SETTING: JNix pastes current convention here_',
    '- Printify base costs: _SETTING: link or paste current cost sheet_',
    '- Any current campaign: _TODO: JNix notes it here, or leaves blank if none_',
  ].join('\n');

  it('leaves the markdown unchanged when no settings are saved', () => {
    expect(applyWorkflowSettings(markdown, 'nixlevel-listing')).toBe(markdown);
  });

  it('substitutes a saved setting into its placeholder, leaving others untouched', () => {
    setWorkflowSettings('nixlevel-listing', {
      'Variant naming convention': 'Scent - Size (e.g. Lavender - 8oz)',
    });

    const result = applyWorkflowSettings(markdown, 'nixlevel-listing');

    expect(result).toContain('- Variant naming convention: Scent - Size (e.g. Lavender - 8oz)');
    expect(result).toContain(
      '- Existing listing example to mirror: _SETTING: JNix pastes one best-performing listing here_'
    );
    expect(result).toContain('- Printify base costs: _SETTING: link or paste current cost sheet_');
  });

  it('substitutes multiple saved settings at once', () => {
    setWorkflowSettings('nixlevel-listing', {
      'Variant naming convention': 'Scent - Size',
      'Printify base costs': 'See NixLevel cost sheet, tab 2026',
    });

    const result = applyWorkflowSettings(markdown, 'nixlevel-listing');

    expect(result).toContain('- Variant naming convention: Scent - Size');
    expect(result).toContain('- Printify base costs: See NixLevel cost sheet, tab 2026');
    expect(result).toContain(
      '- Existing listing example to mirror: _SETTING: JNix pastes one best-performing listing here_'
    );
  });

  it('never touches a _TODO:_ placeholder, even if its label happens to match a saved setting key', () => {
    setWorkflowSettings('nixlevel-listing', { 'Any current campaign': 'Back to school 2026' });

    const result = applyWorkflowSettings(markdown, 'nixlevel-listing');

    expect(result).toContain(
      '- Any current campaign: _TODO: JNix notes it here, or leaves blank if none_'
    );
  });

  it('does not mutate settings for other workflows', () => {
    setWorkflowSettings('courier-route-log', { 'Fuel cost basis': '$3.50/gal' });
    expect(applyWorkflowSettings(markdown, 'nixlevel-listing')).toBe(markdown);
  });

  it('is safe against regex metacharacters in a label', () => {
    const weirdMarkdown = '- Cost (per unit)?: _SETTING: JNix fills this in_';
    setWorkflowSettings('nixlevel-listing', { 'Cost (per unit)?': '$4.20' });
    expect(applyWorkflowSettings(weirdMarkdown, 'nixlevel-listing')).toBe(
      '- Cost (per unit)?: $4.20'
    );
  });

  it('is safe against the _SETTING_PERIODIC:_ tag too, substituting it the same way as _SETTING:_', () => {
    const periodicMarkdown = '- Printify base costs: _SETTING_PERIODIC: link or paste cost sheet_';
    setWorkflowSettings('nixlevel-listing', { 'Printify base costs': '$4.20/unit' });
    expect(applyWorkflowSettings(periodicMarkdown, 'nixlevel-listing')).toBe(
      '- Printify base costs: $4.20/unit'
    );
  });

  it('never writes back to the workflow file on disk — this is a pure in-memory substitution', () => {
    // Regression guard for the actual persistence bug: an earlier version of
    // this module wrote the substituted value into the workflow .md file
    // itself. That file lives inside the app's own source tree, which is
    // rebuilt from git on every deploy — writing to it was silently undone
    // on every redeploy. This module must never touch that file at all.
    const fsModule: typeof import('fs') = jest.requireActual('fs');
    const writeSpy = jest.spyOn(fsModule, 'writeFileSync');
    setWorkflowSettings('nixlevel-listing', { 'Variant naming convention': 'Scent - Size' });
    applyWorkflowSettings(markdown, 'nixlevel-listing');

    // The only writeFileSync call should be the JSON settings store itself
    // (under tempDir), never a path containing "context/workflows".
    for (const call of writeSpy.mock.calls) {
      expect(String(call[0])).not.toContain('context/workflows');
    }
    writeSpy.mockRestore();
  });
});

describe('getWorkflowSettingsMeta()', () => {
  it('returns an updatedAt timestamp for every saved setting', () => {
    const before = new Date();
    setWorkflowSettings('nixlevel-listing', { 'Printify base costs': '$4.20/unit' });
    const meta = getWorkflowSettingsMeta('nixlevel-listing');
    expect(meta['Printify base costs']).toBeDefined();
    expect(new Date(meta['Printify base costs'].updatedAt).getTime()).toBeGreaterThanOrEqual(
      before.getTime()
    );
  });

  it('returns an empty object for a workflow with no saved settings', () => {
    expect(getWorkflowSettingsMeta('nixlevel-listing')).toEqual({});
  });

  it('reads old on-disk entries stored as bare strings (pre-updatedAt shape) without throwing', () => {
    const { writeFileSync, mkdirSync } = jest.requireActual('fs') as typeof import('fs');
    const { dirname } = jest.requireActual('path') as typeof import('path');
    const path = process.env.WIREASSIST_OPS_SETTINGS_FILE as string;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      JSON.stringify({ 'nixlevel-listing': { 'Printify base costs': '$3.00/unit' } })
    );
    expect(getWorkflowSettings('nixlevel-listing')).toEqual({
      'Printify base costs': '$3.00/unit',
    });
    expect(getWorkflowSettingsMeta('nixlevel-listing')['Printify base costs'].updatedAt).toBe('');
  });
});

describe('getWorkflowSettingLabels()', () => {
  it('flags a _SETTING_PERIODIC:_ field as periodic and a plain _SETTING:_ field as not', () => {
    const labels = getWorkflowSettingLabels('nixlevel-listing');
    expect(labels).toContainEqual({ label: 'Printify base costs', periodic: true });
    expect(labels).toContainEqual({ label: 'Variant naming convention', periodic: false });
  });

  it('returns an empty array for an unknown workflow rather than throwing', () => {
    expect(getWorkflowSettingLabels('does-not-exist')).toEqual([]);
  });

  it('reads the raw file, so periodic-ness is stable even after the setting is filled and its placeholder disappears from the merged preview', () => {
    setWorkflowSettings('nixlevel-listing', { 'Printify base costs': '$4.20/unit' });
    const labels = getWorkflowSettingLabels('nixlevel-listing');
    expect(labels).toContainEqual({ label: 'Printify base costs', periodic: true });
  });
});
