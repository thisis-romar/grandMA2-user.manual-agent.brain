import type { Note, VaultModel } from './types.js';

function resolve(model: VaultModel, idOrPath: string): Note | undefined {
  return model.byId.get(idOrPath) ?? model.byPath.get(idOrPath);
}

function adjacency(model: VaultModel, notePath: string): string[] {
  const n = model.byPath.get(notePath);
  return n ? [...n.outlinks, ...(model.backlinks.get(notePath) ?? [])] : [];
}

/** Notes reachable within `depth` hops (out- and in-links), breadth-first. */
export function neighbours(model: VaultModel, idOrPath: string, depth = 1): Note[] {
  const start = resolve(model, idOrPath);
  if (!start) return [];
  const seen = new Set<string>([start.path]);
  const result: string[] = [];
  let frontier = [start.path];
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const p of frontier) {
      for (const a of adjacency(model, p)) {
        if (!seen.has(a)) {
          seen.add(a);
          next.push(a);
          result.push(a);
        }
      }
    }
    frontier = next;
  }
  return result.map((p) => model.byPath.get(p)!).filter(Boolean);
}

/** Notes that link to the given note. */
export function backlinks(model: VaultModel, idOrPath: string): Note[] {
  const n = resolve(model, idOrPath);
  if (!n) return [];
  return (model.backlinks.get(n.path) ?? []).map((p) => model.byPath.get(p)!).filter(Boolean);
}

/** Notes most similar by shared link-neighbours (Jaccard). */
export function related(model: VaultModel, idOrPath: string, k = 10): Array<{ note: Note; score: number }> {
  const n = resolve(model, idOrPath);
  if (!n) return [];
  const nb = new Set(adjacency(model, n.path));
  const scored: Array<{ note: Note; score: number }> = [];
  for (const other of model.notes) {
    if (other.path === n.path) continue;
    const onb = new Set(adjacency(model, other.path));
    let inter = 0;
    for (const x of onb) if (nb.has(x)) inter++;
    if (inter > 0) {
      const union = nb.size + onb.size - inter;
      scored.push({ note: other, score: union ? inter / union : 0 });
    }
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, k);
}
