import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadVault } from '../src/vault.js';
import { search } from '../src/retrieve.js';
import { neighbours } from '../src/graph.js';

const SAMPLE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'examples', 'sample-vault');

test('search finds the Store note for "store a preset"', async () => {
  const m = await loadVault(SAMPLE);
  const hits = search(m, 'store a preset');
  assert.ok(hits.length > 0);
  assert.ok(hits.some((h) => h.path === 'Keywords/Store'));
});

test('neighbours traverses the link graph', async () => {
  const m = await loadVault(SAMPLE);
  const nb = neighbours(m, 'key_keyword_store', 1).map((n) => n.path);
  assert.ok(nb.includes('Pages/Presets/Create Presets'));
});
