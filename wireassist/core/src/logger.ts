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
