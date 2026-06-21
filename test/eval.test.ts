import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { createSchema, indexVault } from '../src/db.js';
import { loadVault } from '../src/vault.js';
import { evalVault, type GoldenQuery } from '../src/eval.js';

const ROOT = path.join(fileURLToPath(import.meta.url), '../..');
const SAMPLE_VAULT = path.join(ROOT, 'examples/sample-vault');
const GOLDEN = JSON.parse(
  readFileSync(path.join(ROOT, 'examples/golden-queries.json'), 'utf8'),
) as GoldenQuery[];

// The real ~844-note vault is a git submodule; absent on a shallow clone.
const VENDOR_VAULT = path.join(ROOT, 'vendor/grandma2-manual-vault');
const VENDOR_PRESENT = existsSync(path.join(VENDOR_VAULT, '.brain/manifest.yaml'));
const VENDOR_GOLDEN = JSON.parse(
  readFileSync(path.join(ROOT, 'examples/golden-queries.vendor.json'), 'utf8'),
) as GoldenQuery[];

test('eval: in-memory keyword search recalls every golden answer', async () => {
  const model = await loadVault(SAMPLE_VAULT);
  const report = evalVault(model, undefined, GOLDEN);
  assert.equal(report.results.length, GOLDEN.length);
  for (const r of report.results) {
    assert.equal(r.retriever, 'search');
    assert.equal(r.recall_at_k, 1, `recall<1 for "${r.query}" (got ${r.hit_ids.join(', ')})`);
    assert.ok(r.mrr > 0);
  }
  assert.equal(report.mean_recall, 1);
});

test('eval: DB-backed FTS recalls every golden answer', async () => {
  const model = await loadVault(SAMPLE_VAULT);
  const db = new Database(':memory:');
  createSchema(db);
  indexVault(model, db);
  const report = evalVault(model, db, GOLDEN);
  db.close();
  for (const r of report.results) {
    assert.equal(r.retriever, 'searchFts');
    assert.equal(r.recall_at_k, 1, `recall<1 for "${r.query}" (got ${r.hit_ids.join(', ')})`);
  }
  assert.equal(report.mean_recall, 1);
  assert.ok(report.mean_mrr > 0);
});

test('eval: section-level retriever runs over the golden set', async () => {
  const model = await loadVault(SAMPLE_VAULT);
  const report = evalVault(model, undefined, GOLDEN, { sections: true });
  assert.equal(report.results.length, GOLDEN.length);
  for (const r of report.results) assert.equal(r.retriever, 'searchSectionsInMemory');
  // At least one query should surface some section hit.
  assert.ok(report.results.some((r) => r.hit_ids.length > 0));
});

// Regression gate against the real vault. Thresholds sit below the measured
// baseline (FTS recall 0.917 / MRR 0.854) so a retrieval regression trips them.
// Skips cleanly when the submodule isn't checked out.
test('eval: vendor vault meets the retrieval baseline (FTS + in-memory)', { skip: !VENDOR_PRESENT }, async () => {
  const model = await loadVault(VENDOR_VAULT);
  const db = new Database(':memory:');
  createSchema(db);
  indexVault(model, db);
  const fts = evalVault(model, db, VENDOR_GOLDEN);
  db.close();
  assert.ok(fts.mean_recall >= 0.8, `FTS mean_recall ${fts.mean_recall} < 0.8`);
  assert.ok(fts.mean_mrr >= 0.7, `FTS mean_mrr ${fts.mean_mrr} < 0.7`);

  const mem = evalVault(model, undefined, VENDOR_GOLDEN);
  assert.ok(mem.mean_recall >= 0.8, `in-memory mean_recall ${mem.mean_recall} < 0.8`);
  assert.ok(mem.mean_mrr >= 0.7, `in-memory mean_mrr ${mem.mean_mrr} < 0.7`);
});

