#!/usr/bin/env node
/**
 * Frees a TCP port before dev (avoids EADDRINUSE from a stale process).
 * Usage: node scripts/free-dev-port.mjs [port | api | web]
 *   api — API_PORT (default 3002)
 *   web — WEB_PORT (default 3001)
 *   <number> — explicit port
 */
import { execSync } from 'node:child_process';

import { getApiPort, getWebPort } from './ports.mjs';

function resolvePorts(target) {
  if (target === 'api') return [getApiPort()];
  if (target === 'web') return [getWebPort()];
  if (target) return [target];
  return [getApiPort()];
}

const target = process.argv[2] ?? 'api';

for (const port of resolvePorts(target)) {
  try {
    execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' });
  } catch {
    // Port not in use — nothing to do
  }
}
