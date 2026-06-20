import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { createSchema, indexVault, searchFts, searchSections } from '../src/db.js';
import { loadVault } from '../src/vault.js';

const SAMPLE_VAULT = path.join(fileURLToPath(import.meta.url), '../../examples/sample-vault');

function freshDb(): Database.Database {
  const db = new Database(':memory:');
  createSchema(db);
  return db;
}

test('indexes sample vault and reports stats', async () => {
  const db = freshDb();
  const vault = await loadVault(SAMPLE_VAULT);
  const stats = indexVault(vault, db);
  assert.ok(stats.total > 0, `expected notes, got ${stats.total}`);
  assert.equal(stats.updated, stats.total, 'first pass should update all notes');
  assert.ok(stats.links >= 0);
  db.close();
});

test('FTS5 search finds relevant note for "store preset"', async () => {
  const db = freshDb();
  const vault = await loadVault(SAMPLE_VAULT);
  indexVault(vault, db);
  const hits = searchFts(db, 'store preset', 5);
  assert.ok(hits.length > 0, 'expected at least one FTS hit');
  const titles = hits.map((h) => h.title.toLowerCase());
  assert.ok(
    titles.some((t) => t.includes('store') || t.includes('preset')),
    `expected store/preset in titles, got: ${titles.join(', ')}`,
  );
  db.close();
});

test('incremental reindex skips unchanged notes', async () => {
  const db = freshDb();
  const vault = await loadVault(SAMPLE_VAULT);
  const first = indexVault(vault, db);
  const second = indexVault(vault, db);
  assert.equal(second.updated, 0, 'second pass should update nothing');
  assert.equal(second.total, first.total);
  db.close();
});

test('link rows inserted for notes with outlinks', async () => {
  const db = freshDb();
  const vault = await loadVault(SAMPLE_VAULT);
  indexVault(vault, db);
  const linkCount = (db.prepare('SELECT COUNT(*) as c FROM links').get() as { c: number }).c;
  const vaultLinks = vault.notes.reduce((acc, n) => acc + n.outlinks.length, 0);
  assert.equal(linkCount, vaultLinks);
  db.close();
});

test('reindex prunes notes removed from the vault', async () => {
  const db = freshDb();
  const vault = await loadVault(SAMPLE_VAULT);
  indexVault(vault, db);
  const dropped = vault.notes[0];
  const count = (sql: string, p: string) =>
    (db.prepare(sql).get(p) as { c: number }).c;

  const stats = indexVault({ ...vault, notes: vault.notes.slice(1) }, db);
  assert.equal(stats.removed, 1, 'one note should be pruned');
  assert.equal(count('SELECT COUNT(*) c FROM notes WHERE id = ?', dropped.id), 0);
  assert.equal(count('SELECT COUNT(*) c FROM notes_fts WHERE id = ?', dropped.id), 0);
  assert.equal(count('SELECT COUNT(*) c FROM links WHERE source_id = ?', dropped.id), 0);
  db.close();
});

test('indexVault populates chunks and searchSections finds a section', async () => {
  const db = freshDb();
  const vault = await loadVault(SAMPLE_VAULT);
  indexVault(vault, db);
  const chunkCount = (db.prepare('SELECT COUNT(*) c FROM chunks').get() as { c: number }).c;
  assert.ok(chunkCount >= vault.notes.length, `expected >=${vault.notes.length} chunks, got ${chunkCount}`);
  const hits = searchSections(db, 'store', 5, vault.manifest.retrieval?.exclude_types ?? []);
  assert.ok(hits.length > 0, 'expected a section hit for "store"');
  assert.ok(
    hits.some((h) => h.path === 'Keywords/Store'),
    `expected a Keywords/Store section, got ${hits.map((h) => h.path).join(', ')}`,
  );
  db.close();
});

test('reindex prunes chunks for removed notes', async () => {
  const db = freshDb();
  const vault = await loadVault(SAMPLE_VAULT);
  indexVault(vault, db);
  const dropped = vault.notes[0];
  indexVault({ ...vault, notes: vault.notes.slice(1) }, db);
  const left = (
    db.prepare('SELECT COUNT(*) c FROM chunks WHERE note_id = ?').get(dropped.id) as { c: number }
  ).c;
  assert.equal(left, 0, 'chunks for the removed note should be pruned');
  db.close();
});

test('searchFts honors includeTypes (facet filter)', async () => {
  const db = freshDb();
  const vault = await loadVault(SAMPLE_VAULT);
  indexVault(vault, db);
  const hits = searchFts(db, 'preset', 20, [], ['section']);
  assert.ok(hits.length > 0, 'expected at least one section hit for "preset"');
  const byPath = new Map(vault.notes.map((n) => [n.path, n.type]));
  for (const h of hits) {
    assert.equal(byPath.get(h.path), 'section', `expected only section hits, got ${h.path}`);
  }
  db.close();
});

test('searchFts honors exclude_types', async () => {
  const db = freshDb();
  const vault = await loadVault(SAMPLE_VAULT);
  const moc = vault.notes[0];
  moc.type = 'moc';
  indexVault(vault, db);
  const q = moc.title;
  assert.ok(
    !searchFts(db, q, 10, ['moc']).some((h) => h.id === moc.id),
    'moc-typed note must be excluded',
  );
  assert.ok(
    searchFts(db, q, 10, []).some((h) => h.id === moc.id),
    'moc-typed note present when nothing excluded',
  );
  db.close();
});
