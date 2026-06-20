import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadVault } from '../src/vault.js';

const SAMPLE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'examples', 'sample-vault');

test('loads notes with stable ids, types and summaries', async () => {
  const m = await loadVault(SAMPLE);
  assert.equal(m.notes.length, 3);
  const store = m.byId.get('key_keyword_store')!;
  assert.equal(store.type, 'keyword');
  assert.equal(store.summary, 'The Store keyword saves data into the show file.');
});

test('resolves wikilinks into outlinks and backlinks', async () => {
  const m = await loadVault(SAMPLE);
  const create = m.byPath.get('Pages/Presets/Create Presets')!;
  assert.ok(create.outlinks.includes('Keywords/Store'));
  assert.ok((m.backlinks.get('Keywords/Store') ?? []).includes('Pages/Presets/Create Presets'));
});

test('extracts typed relations from frontmatter', async () => {
  const m = await loadVault(SAMPLE);
  const create = m.byPath.get('Pages/Presets/Create Presets')!;
  assert.deepEqual(create.relations, [{ kind: 'parent', to: 'Sections/Presets' }]);
});
