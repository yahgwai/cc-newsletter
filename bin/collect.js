#!/usr/bin/env node
import { spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tsx = join(__dirname, '..', 'node_modules', '.bin', 'tsx');
const cli = join(__dirname, '..', 'src', 'cli.ts');
const result = spawnSync(tsx, [cli, ...process.argv.slice(2)], {
  stdio: 'inherit', cwd: process.cwd()
});
process.exit(result.status ?? 1);
