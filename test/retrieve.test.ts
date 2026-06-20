import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadVault } from '../src/vault.js';
import { focusedSnippet, search } from '../src/retrieve.js';
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

test('search hits filtered by includeTypes only return that type', async () => {
  const m = await loadVault(SAMPLE);
  const hits = search(m, 'preset', 10, ['section']);
  assert.ok(hits.length > 0, 'expected at least one section hit');
  for (const h of hits) {
    const note = m.byId.get(h.id) ?? m.byPath.get(h.path);
    assert.equal(note?.type, 'section', `expected only section hits, got ${note?.type}`);
  }
});

test('focusedSnippet highlights matched query terms', async () => {
  const snip = focusedSnippet('Press STORE to store a preset in the editor.', 'store preset');
  assert.ok(snip, 'expected a snippet');
  assert.match(snip, /\*\*[Ss]tore\*\*/, `expected bolded store, got: ${snip}`);
  assert.match(snip, /\*\*preset\*\*/, `expected bolded preset, got: ${snip}`);
});

test('focusedSnippet returns undefined when nothing matches', () => {
  assert.equal(focusedSnippet('completely unrelated text', 'xyzzy'), undefined);
});
