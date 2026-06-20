/** A single [[wikilink]] occurrence. */
export interface WikiLink {
  target: string;
  anchor?: string;
}

const WIKILINK_RE = /\[\[([^\]]+?)\]\]/g;

/** Extract all [[wikilinks]] from a note body. */
export function parseWikilinks(body: string): WikiLink[] {
  const out: WikiLink[] = [];
  const re = new RegExp(WIKILINK_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const noAlias = m[1].split('|')[0];
    const [target, anchor] = noAlias.split('#');
    if (target.trim()) out.push({ target: target.trim(), anchor: anchor?.trim() });
  }
  return out;
}

export interface ResolveMaps {
  byPath: Set<string>;
  ci: Map<string, string>; // lowercased path -> path
  byBasename: Map<string, string>; // lowercased basename -> path (first wins)
}

/** Resolve a wikilink target to a note path: exact, then case-insensitive, then basename. */
export function resolveLink(target: string, maps: ResolveMaps): string | undefined {
  if (maps.byPath.has(target)) return target;
  const ciHit = maps.ci.get(target.toLowerCase());
  if (ciHit) return ciHit;
  return maps.byBasename.get(target.split('/').pop()!.toLowerCase());
}

/** Strip the inner target out of a `[[Path/Note|alias]]` frontmatter value. */
export function wikilinkInner(s: string): string {
  const m = String(s).match(/\[\[([^\]|#]+)/);
  return (m ? m[1] : String(s)).trim();
}
