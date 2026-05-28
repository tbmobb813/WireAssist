#!/usr/bin/env node
/**
 * Frees a TCP port before dev:api (avoids EADDRINUSE from a stale API process).
 * Usage: node scripts/free-dev-port.mjs [port]
 */
import { execSync } from 'node:child_process';

import { getApiPort } from './ports.mjs';

const port = process.argv[2] ?? getApiPort();

try {
  execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' });
} catch {
  // Port not in use — nothing to do
}
