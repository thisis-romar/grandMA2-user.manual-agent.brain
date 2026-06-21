import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadVault } from '../src/vault.js';
import { ancestry, relations } from '../src/graph.js';

const SAMPLE_VAULT = path.join(fileURLToPath(import.meta.url), '../../examples/sample-vault');
// sample manifest: relations.section_ref = { from: page, to: section, kind: parent }
const PAGE = 'Pages/Presets/Create Presets';
const SECTION = 'Sections/Presets';

test('relations returns the outgoing typed edge (page -> parent section)', async () => {
  const model = await loadVault(SAMPLE_VAULT);
  const rels = relations(model, PAGE);
  const parent = rels.find((r) => r.kind === 'parent' && r.direction === 'out');
  assert.ok(parent, `expected outgoing parent edge, got ${JSON.stringify(rels)}`);
  assert.equal(parent.note.path, SECTION);
});

test('relations returns the incoming typed edge (section <- child page)', async () => {
  const model = await loadVault(SAMPLE_VAULT);
  const rels = relations(model, SECTION);
  const child = rels.find((r) => r.kind === 'parent' && r.direction === 'in');
  assert.ok(child, `expected incoming parent edge, got ${JSON.stringify(rels)}`);
  assert.equal(child.note.path, PAGE);
});

test('relations honors the kind filter', async () => {
  const model = await loadVault(SAMPLE_VAULT);
  assert.ok(relations(model, SECTION, 'parent').length > 0, 'parent kind should match');
  assert.equal(relations(model, SECTION, 'no-such-kind').length, 0, 'unknown kind = empty');
});

test('relations on an unknown id returns empty', async () => {
  const model = await loadVault(SAMPLE_VAULT);
  assert.deepEqual(relations(model, 'Does/Not/Exist'), []);
});

test('ancestry walks the parent chain (page -> section)', async () => {
  const model = await loadVault(SAMPLE_VAULT);
  const chain = ancestry(model, PAGE).map((n) => n.path);
  assert.deepEqual(chain, [SECTION], `expected [${SECTION}], got ${JSON.stringify(chain)}`);
});

test('ancestry on a root note (no parent) is empty', async () => {
  const model = await loadVault(SAMPLE_VAULT);
  assert.deepEqual(ancestry(model, SECTION), []);
});
