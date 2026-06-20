import type { SearchHit, VaultModel } from './types.js';

const STOP = new Set([
  'the', 'a', 'an', 'to', 'of', 'in', 'and', 'or', 'is', 'for', 'on', 'with', 'as', 'by', 'at',
  'it', 'this', 'that', 'how', 'do', 'you',
]);

function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length > 1 && !STOP.has(t));
}

function countOcc(haystack: string, term: string): number {
  let i = 0;
  let c = 0;
  while ((i = haystack.indexOf(term, i)) >= 0) {
    c++;
    i += term.length;
  }
  return c;
}

function firstLine(body: string): string {
  const l = body
    .split('\n')
    .map((s) => s.trim())
    .find((s) => s && !s.startsWith('#') && !s.startsWith('>') && !s.startsWith('!'));
  return (l ?? '').slice(0, 160);
}

/**
 * In-memory keyword search across title (boosted), summary/aliases, and body.
 * This is the P0 retriever; semantic (vector) recall is added in P2.
 */
export function search(model: VaultModel, query: string, k = 10): SearchHit[] {
  const terms = [...new Set(tokenize(query))];
  if (!terms.length) return [];
  const exclude = new Set(model.manifest.retrieval?.exclude_types ?? []);
  const hits: SearchHit[] = [];
  for (const n of model.notes) {
    if (exclude.has(n.type)) continue;
    const title = n.title.toLowerCase();
    const summary = n.summary.toLowerCase();
    const body = n.body.toLowerCase();
    const aliases = n.aliases.map((a) => a.toLowerCase());
    let score = 0;
    for (const t of terms) {
      if (title.includes(t)) score += 5;
      if (summary.includes(t)) score += 3;
      if (aliases.some((a) => a.includes(t))) score += 3;
      score += Math.min(countOcc(body, t), 5);
    }
    if (score > 0) {
      hits.push({ id: n.id, path: n.path, title: n.title, score, snippet: n.summary || firstLine(n.body) });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, k);
}
