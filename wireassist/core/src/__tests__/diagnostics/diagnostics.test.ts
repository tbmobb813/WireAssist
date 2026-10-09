import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  CAPTURE_WINDOW_MINUTES,
  getDiagnostics,
  isRawCaptureEnabled,
  setRawCapture,
} from '../../diagnostics';
import { logger } from '../../logger';

const MINUTE = 60_000;

describe('diagnostics (raw reply capture switch)', () => {
  let home: string;
  const previousHome = process.env.WIREASSIST_HOME;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'wa-diag-'));
    process.env.WIREASSIST_HOME = home;
  });

  afterEach(() => {
    if (previousHome === undefined) delete process.env.WIREASSIST_HOME;
    else process.env.WIREASSIST_HOME = previousHome;
    rmSync(home, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  // Far enough apart that the in-memory cache never masks a change.
  const later = (base: number, minutes: number) => base + minutes * MINUTE;

  it('is off by default', () => {
    const now = Date.now();
    expect(isRawCaptureEnabled(now)).toBe(false);
    expect(getDiagnostics(now)).toEqual({
      rawCapture: false,
      expiresAt: null,
      windowMinutes: CAPTURE_WINDOW_MINUTES,
    });
  });

  it('turns on for the capture window and reports when it ends', () => {
    const now = Date.now();
    const status = setRawCapture(true, now);
    expect(status.rawCapture).toBe(true);
    expect(status.expiresAt).toBe(new Date(now + CAPTURE_WINDOW_MINUTES * MINUTE).toISOString());
    expect(isRawCaptureEnabled(now)).toBe(true);
  });

  it('turns itself off after the window', () => {
    const now = Date.now();
    setRawCapture(true, now);
    expect(isRawCaptureEnabled(later(now, CAPTURE_WINDOW_MINUTES - 1))).toBe(true);
    expect(isRawCaptureEnabled(later(now, CAPTURE_WINDOW_MINUTES + 1))).toBe(false);
    expect(getDiagnostics(later(now, CAPTURE_WINDOW_MINUTES + 1)).expiresAt).toBeNull();
  });

  it('can be switched off early', () => {
    const now = Date.now();
    setRawCapture(true, now);
    const status = setRawCapture(false, later(now, 1));
    expect(status.rawCapture).toBe(false);
    expect(isRawCaptureEnabled(later(now, 2))).toBe(false);
  });

  it('survives a restart: the state is read back from the file', () => {
    const now = Date.now();
    setRawCapture(true, now);
    // A fresh read well past the cache TTL, as another process would do.
    expect(isRawCaptureEnabled(now + 10_000)).toBe(true);
  });

  it('fails safe (off) when the file is corrupt', () => {
    const now = Date.now();
    mkdirSync(join(home, '.wireassist'), { recursive: true });
    writeFileSync(join(home, '.wireassist', 'diagnostics.json'), '{not json');
    expect(isRawCaptureEnabled(now)).toBe(false);
  });

  it('follows WIREASSIST_HOME rather than a path fixed at import time', () => {
    const now = Date.now();
    setRawCapture(true, now);
    const other = mkdtempSync(join(tmpdir(), 'wa-diag-other-'));
    try {
      process.env.WIREASSIST_HOME = other;
      expect(isRawCaptureEnabled(now)).toBe(false);
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  });

  describe('logger.raw()', () => {
    it('writes nothing while the switch is off', () => {
      const log = jest.spyOn(console, 'log').mockImplementation(() => {});
      logger.raw('reply text');
      expect(log).not.toHaveBeenCalled();
    });

    it('writes while the switch is on, tagged as raw', () => {
      const log = jest.spyOn(console, 'log').mockImplementation(() => {});
      setRawCapture(true);
      logger.raw('reply text');
      expect(log).toHaveBeenCalledTimes(1);
      expect(String(log.mock.calls[0][0])).toContain('[wireassist:raw]');
      expect(log.mock.calls[0]).toContain('reply text');
    });

    it('goes quiet again once switched off', () => {
      const log = jest.spyOn(console, 'log').mockImplementation(() => {});
      setRawCapture(true);
      setRawCapture(false);
      logger.raw('reply text');
      expect(log).not.toHaveBeenCalled();
    });
  });
});
