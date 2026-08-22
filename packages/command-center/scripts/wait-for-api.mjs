#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { apiOrigin } from './ports.mjs';

const healthUrl = `${apiOrigin()}/health`;
execSync(`npx wait-on -t 60000 "${healthUrl}"`, { stdio: 'inherit' });
