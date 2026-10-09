import { isRawCaptureEnabled } from './diagnostics';

const levelPriorities: Record<string, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const env = typeof process !== 'undefined' ? process.env.LOG_LEVEL : undefined;
const LOG_LEVEL = (env || 'info').toLowerCase();

function shouldLog(level: keyof typeof levelPriorities) {
  return levelPriorities[level] <= (levelPriorities[LOG_LEVEL] ?? levelPriorities.info);
}

function formatPrefix(level: string) {
  const ts = new Date().toISOString();
  return `[wireassist:${level}] ${ts}`;
}

export const logger = {
  // For text that may contain private content (the raw reply from a model
  // that failed to parse can include email senders and subjects). Written
  // only while diagnostic logging is switched on in Settings (which turns
  // itself off after a while) — or, as before, when LOG_LEVEL=debug.
  raw: (...args: unknown[]) => {
    if (!isRawCaptureEnabled() && !shouldLog('debug')) return;
    // eslint-disable-next-line no-console
    console.log(formatPrefix('raw'), ...args);
  },
  debug: (...args: unknown[]) => {
    if (!shouldLog('debug')) return;
    // eslint-disable-next-line no-console
    console.debug(formatPrefix('debug'), ...args);
  },
  info: (...args: unknown[]) => {
    if (!shouldLog('info')) return;
    // eslint-disable-next-line no-console
    console.log(formatPrefix('info'), ...args);
  },
  warn: (...args: unknown[]) => {
    if (!shouldLog('warn')) return;
    // eslint-disable-next-line no-console
    console.warn(formatPrefix('warn'), ...args);
  },
  error: (...args: unknown[]) => {
    if (!shouldLog('error')) return;
    // eslint-disable-next-line no-console
    console.error(formatPrefix('error'), ...args);
  },
};

export default logger;
