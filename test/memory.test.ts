import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { loadVault } from '../src/vault.js';
import { writeNote } from '../src/memory.js';
import { createSchema, searchFts } from '../src/db.js';

const MANIFEST = `spec_version: 1
vault:
  name: tmp
links: { style: wikilink, resolution: path-qualified, id_field: slug }
taxonomy:
  folders:
    Notes/: note
frontmatter:
  all: [type, slug]
  by_type: {}
retrieval:
  summary_field: summary
`;

function tmpVault(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'vb-mem-'));
  mkdirSync(path.join(root, '.brain'), { recursive: true });
  writeFileSync(path.join(root, '.brain', 'manifest.yaml'), MANIFEST);
  return root;
}

test('writeNote neutralizes path traversal in title (stays in vault)', async () => {
  const root = tmpVault();
  const model = await loadVault(root);
  const file = await writeNote(model, { type: 'note', title: '../../etc/passwd', body: 'x' });
  const full = path.resolve(root, file);
  assert.ok(full.startsWith(path.resolve(root) + path.sep), `wrote outside vault: ${full}`);
  assert.match(file, /^Notes\//, `expected note under Notes/, got ${file}`);
});

test('writeNote rejects a title with no usable filename characters', async () => {
  const root = tmpVault();
  const model = await loadVault(root);
  await assert.rejects(
    () => writeNote(model, { type: 'note', title: '../', body: 'x' }),
    /no usable filename/i,
  );
});

test('writeNote with db indexes the note for immediate search', async () => {
  const root = tmpVault();
  const model = await loadVault(root);
  const db = new Database(':memory:');
  createSchema(db);
  await writeNote(
    model,
    { type: 'note', title: 'Telnet Setup', body: 'enable telnet on port 30000', summary: 'telnet' },
    db,
  );
  const hits = searchFts(db, 'telnet', 10);
  assert.ok(
    hits.some((h) => h.id === 'telnet-setup'),
    `expected telnet-setup in results, got: ${hits.map((h) => h.id).join(', ')}`,
  );
  db.close();
});
