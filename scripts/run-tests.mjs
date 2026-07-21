#!/usr/bin/env node
// Cross-platform test runner: enumerates test/*.test.ts via fs (no shell glob),
// then runs them under node --test with the tsx loader. Node's --test only gained
// glob support in 20.14 (this project's floor is lower), and cmd.exe/npm on Windows
// does not expand `test/*.test.ts`, so the previous script found zero files on
// Windows. This enumerator works identically on every platform.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const files = readdirSync('test')
  .filter((f) => f.endsWith('.test.ts'))
  .map((f) => `test/${f}`);

if (files.length === 0) {
  process.stderr.write('run-tests: no test/*.test.ts files found\n');
  process.exit(1);
}

const r = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...files], {
  stdio: 'inherit',
});
process.exit(r.status ?? 1);
