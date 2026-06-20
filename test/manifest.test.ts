import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest } from '../src/manifest.js';
import type { Manifest } from '../src/types.js';

const minimal = {
  vault: { name: 't' },
  links: { id_field: 'slug' },
  taxonomy: { folders: { 'Pages/': 'page' } },
  frontmatter: { all: ['type', 'slug'] },
} as unknown as Manifest;

test('validateManifest rejects a manifest missing sections', () => {
  assert.throws(() => validateManifest({} as unknown as Manifest), /missing/);
});

test('validateManifest rejects an unsupported spec_version', () => {
  assert.throws(
    () => validateManifest({ ...minimal, spec_version: 2 } as Manifest),
    /unsupported manifest spec_version 2/,
  );
});

test('validateManifest accepts spec_version 1 and an absent spec_version', () => {
  assert.doesNotThrow(() => validateManifest({ ...minimal, spec_version: 1 } as Manifest));
  assert.doesNotThrow(() => validateManifest(minimal));
});
