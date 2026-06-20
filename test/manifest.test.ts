import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest } from '../src/manifest.js';
import type { Manifest } from '../src/types.js';

test('validateManifest rejects a manifest missing sections', () => {
  assert.throws(() => validateManifest({} as unknown as Manifest), /missing/);
});
