import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
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
