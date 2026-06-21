import type { SearchHit, SectionHit, VaultModel } from './types.js';
import { chunkBody } from './chunk.js';

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

/** Bold whole words that match (prefix or substring) any query term. */
function highlightTerms(s: string, terms: string[]): string {
  return s.replace(/[A-Za-z0-9]+/g, (w) => {
    const lw = w.toLowerCase();
    return terms.some((t) => lw.startsWith(t) || lw.includes(t)) ? `**${w}**` : w;
  });
}

/**
 * Query-focused snippet: the body line containing the most distinct query terms,
 * windowed around the first match and with matched words highlighted. Returns
 * undefined when nothing matches (callers fall back to the summary).
 */
export function focusedSnippet(body: string, query: string, max = 200): string | undefined {
  const terms = [...new Set(tokenize(query))];
  if (!terms.length || !body) return undefined;
  const segments = body
    .split('\n')
    .map((s) => s.trim())
    .filter(
      (s) =>
        s && !s.startsWith('#') && !s.startsWith('>') && !s.startsWith('|') && !s.startsWith('!'),
    );
  let best: { seg: string; hits: number } | undefined;
  for (const seg of segments) {
    const low = seg.toLowerCase();
    const hits = terms.reduce((a, t) => a + (low.includes(t) ? 1 : 0), 0);
    if (hits && (!best || hits > best.hits)) best = { seg, hits };
  }
  if (!best) return undefined;
  let snip = best.seg;
  if (snip.length > max) {
    const low = snip.toLowerCase();
    const idxs = terms.map((t) => low.indexOf(t)).filter((i) => i >= 0);
    const first = idxs.length ? Math.min(...idxs) : 0;
    const start = Math.max(0, first - 40);
    snip = (start > 0 ? '…' : '') + snip.slice(start, start + max) + (start + max < best.seg.length ? '…' : '');
  }
  return highlightTerms(snip, terms);
}

/**
 * In-memory keyword search across title (boosted), summary/aliases, and body.
 * This is the P0 retriever; semantic (vector) recall is added in P2.
 */
export function search(
  model: VaultModel,
  query: string,
  k = 10,
  includeTypes: string[] = [],
): SearchHit[] {
  const terms = [...new Set(tokenize(query))];
  if (!terms.length) return [];
  const exclude = new Set(model.manifest.retrieval?.exclude_types ?? []);
  const include = includeTypes.length ? new Set(includeTypes) : undefined;
  const hits: SearchHit[] = [];
  for (const n of model.notes) {
    if (exclude.has(n.type)) continue;
    if (include && !include.has(n.type)) continue;
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

/**
 * In-memory section-level search (heading chunks). Fallback for when no SQLite
 * index exists; mirrors db.searchSections so the MCP/CLI behave the same offline.
 */
export function searchSectionsInMemory(
  model: VaultModel,
  query: string,
  k = 10,
  includeTypes: string[] = [],
): SectionHit[] {
  const terms = [...new Set(tokenize(query))];
  if (!terms.length) return [];
  const exclude = new Set(model.manifest.retrieval?.exclude_types ?? []);
  const include = includeTypes.length ? new Set(includeTypes) : undefined;
  const hits: SectionHit[] = [];
  for (const n of model.notes) {
    if (exclude.has(n.type)) continue;
    if (include && !include.has(n.type)) continue;
    for (const c of chunkBody(n.id, n.body)) {
      const heading = c.heading.toLowerCase();
      const hay = `${heading}\n${c.body.toLowerCase()}`;
      let score = 0;
      for (const t of terms) {
        if (heading.includes(t)) score += 5;
        score += Math.min(countOcc(hay, t), 5);
      }
      if (score > 0) {
        hits.push({
          id: c.id,
          noteId: n.id,
          path: n.path,
          noteTitle: n.title,
          heading: c.heading,
          anchor: c.anchor,
          score,
          snippet: focusedSnippet(c.body, query) ?? c.body.slice(0, 200),
        });
      }
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, k);
}
