import type Database from 'better-sqlite3';
import type { VaultModel, SearchHit, SectionHit } from './types.js';
import { search, searchSectionsInMemory } from './retrieve.js';
import { searchFts, searchSections } from './db.js';

/** One labelled query in a golden set: which note/section ids should rank in the top k. */
export interface GoldenQuery {
  query: string;
  expected_ids: string[];
  k?: number;
}

/** Per-query retrieval score. */
export interface QueryEval {
  query: string;
  retriever: 'search' | 'searchFts' | 'searchSections' | 'searchSectionsInMemory';
  k: number;
  recall_at_k: number; // fraction of expected_ids present in the top-k
  mrr: number; // reciprocal rank of the first expected hit (0 if none)
  hit_ids: string[];
}

/** Aggregate report over a golden set. */
export interface EvalReport {
  results: QueryEval[];
  mean_recall: number;
  mean_mrr: number;
}

function recallAtK(ids: string[], expected: string[], k: number): number {
  if (!expected.length) return 0;
  const top = new Set(ids.slice(0, k));
  const found = expected.filter((e) => top.has(e)).length;
  return found / expected.length;
}

function reciprocalRank(ids: string[], expected: string[]): number {
  const want = new Set(expected);
  for (let i = 0; i < ids.length; i++) {
    if (want.has(ids[i])) return 1 / (i + 1);
  }
  return 0;
}

/**
 * Score a golden query set against the brain's retrievers. Pass a `db` to evaluate the
 * SQLite/FTS path; omit it to evaluate the in-memory keyword path. `sections: true` scores
 * the section-level retrievers instead of note-level.
 */
export function evalVault(
  model: VaultModel,
  db: Database.Database | undefined,
  queries: GoldenQuery[],
  opts: { sections?: boolean } = {},
): EvalReport {
  const exclude = model.manifest.retrieval?.exclude_types ?? [];
  const results: QueryEval[] = queries.map((q) => {
    const k = q.k ?? 10;
    let hits: SearchHit[] | SectionHit[];
    let retriever: QueryEval['retriever'];
    if (opts.sections) {
      hits = db ? searchSections(db, q.query, k, exclude) : searchSectionsInMemory(model, q.query, k);
      retriever = db ? 'searchSections' : 'searchSectionsInMemory';
    } else {
      hits = db ? searchFts(db, q.query, k, exclude) : search(model, q.query, k);
      retriever = db ? 'searchFts' : 'search';
    }
    const ids = hits.map((h) => h.id);
    return {
      query: q.query,
      retriever,
      k,
      recall_at_k: recallAtK(ids, q.expected_ids, k),
      mrr: reciprocalRank(ids, q.expected_ids),
      hit_ids: ids,
    };
  });

  const n = results.length || 1;
  return {
    results,
    mean_recall: results.reduce((s, r) => s + r.recall_at_k, 0) / n,
    mean_mrr: results.reduce((s, r) => s + r.mrr, 0) / n,
  };
}
