#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { getWebPort } from './ports.mjs';

const mode = process.argv[2] === 'start' ? 'start' : 'dev';
const port = getWebPort();
const args = [mode, '--port', port, '--hostname', '0.0.0.0'];

const result = spawnSync('next', args, { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
