import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.join(fileURLToPath(import.meta.url), '../..');

// Force deterministic provenance values without relying on a live session
// transcript or a developer's git pin.
const FORCED = {
  CLAUDE_MODEL: 'Claude Opus 4.8',
  CLAUDE_CODE_VERSION: '9.9.9',
  CLAUDE_CODE_SESSION_ID: 'test-session-123',
  CLAUDE_CODE_ENTRYPOINT: 'test',
  CLAUDE_CONFIG_DIR: path.join(os.tmpdir(), 'vb-no-transcript'),
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
};

function runScript(rel: string, env: Record<string, string>): string {
  return execFileSync('sh', [path.join(ROOT, rel)], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '', HOME: os.tmpdir(), ...env },
  });
}

test('commit-trailers.sh emits the four trailers with forced values', () => {
  const out = runScript('scripts/commit-trailers.sh', FORCED);
  assert.match(out, /^Co-authored-by: Claude Opus 4\.8 <noreply@anthropic\.com>$/m);
  assert.match(out, /^Generated-with: Claude Code 9\.9\.9$/m);
  assert.match(out, /^Claude-Session: test-session-123$/m);
  assert.match(out, /^Claude-Entrypoint: test$/m);
});

test('pr-trailers.sh wraps the same fields in a collapsed details block', () => {
  const out = runScript('scripts/pr-trailers.sh', FORCED);
  assert.match(out, /^<details>$/m);
  assert.match(out, /^<summary>Provenance<\/summary>$/m);
  assert.match(out, /```/); // fenced block keeps line breaks on GitHub
  assert.match(out, /^Co-authored-by: Claude Opus 4\.8 <noreply@anthropic\.com>$/m);
  assert.match(out, /^Generated-with: Claude Code 9\.9\.9$/m);
  assert.match(out, /^Claude-Session: test-session-123$/m);
  assert.match(out, /^Claude-Entrypoint: test$/m);
  assert.match(out, /<\/details>\s*$/);
});

test('both scripts degrade to nothing when no context is detectable', () => {
  // No model, no version/session/entrypoint, no transcript, no git pin.
  const bare = {
    CLAUDE_CONFIG_DIR: path.join(os.tmpdir(), 'vb-no-transcript'),
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
  };
  assert.equal(runScript('scripts/commit-trailers.sh', bare).trim(), '');
  assert.equal(runScript('scripts/pr-trailers.sh', bare).trim(), '');
});

test('prepare-commit-msg is additive: fills missing fields without duplicating', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-hook-'));
  const msg = path.join(dir, 'COMMIT_EDITMSG');
  // Simulate a harness-injected co-author + session URL already present.
  fs.writeFileSync(
    msg,
    'Subject\n\nBody.\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>\n' +
      'Claude-Session: https://claude.ai/code/session_011xUg\n',
  );
  execFileSync('sh', [path.join(ROOT, '.husky/prepare-commit-msg'), msg], {
    cwd: ROOT,
    env: { PATH: process.env.PATH ?? '', HOME: os.tmpdir(), ...FORCED },
  });
  const out = fs.readFileSync(msg, 'utf8');
  // Existing co-author kept, not duplicated.
  assert.equal((out.match(/co-authored-by:/gi) ?? []).length, 1);
  // Missing fields added.
  assert.match(out, /^Generated-with: Claude Code 9\.9\.9$/m);
  assert.match(out, /^Claude-Entrypoint: test$/m);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('prepare-commit-msg adds all four trailers to a clean message', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-hook-'));
  const msg = path.join(dir, 'COMMIT_EDITMSG');
  fs.writeFileSync(msg, 'Subject\n\nBody.\n');
  execFileSync('sh', [path.join(ROOT, '.husky/prepare-commit-msg'), msg], {
    cwd: ROOT,
    env: { PATH: process.env.PATH ?? '', HOME: os.tmpdir(), ...FORCED },
  });
  const out = fs.readFileSync(msg, 'utf8');
  assert.match(out, /^Co-authored-by: Claude Opus 4\.8 <noreply@anthropic\.com>$/m);
  assert.match(out, /^Generated-with: Claude Code 9\.9\.9$/m);
  assert.match(out, /^Claude-Session: test-session-123$/m);
  assert.match(out, /^Claude-Entrypoint: test$/m);
  fs.rmSync(dir, { recursive: true, force: true });
});
