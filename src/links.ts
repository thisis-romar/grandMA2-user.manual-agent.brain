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

/** A single CommonMark inline link. The optional title carries a typed edge kind. */
export interface MdLink {
  target: string;
  relation?: string;
}

// [text](target "optional title") — title (when present) is the typed relation.
const MDLINK_RE = /\[[^\]]*\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;

/**
 * Extract CommonMark links `[text](target "relation")`. External links (http, mailto)
 * and pure `#anchor` links are skipped; the `.md` extension and `#anchor` are stripped
 * from the target so it resolves the same way wikilink targets do (path/basename).
 */
export function parseCommonMarkLinks(body: string): MdLink[] {
  const out: MdLink[] = [];
  const re = new RegExp(MDLINK_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    let target = m[1].trim();
    if (/^(https?:|mailto:|#)/i.test(target)) continue;
    target = target.split('#')[0].replace(/\.md$/i, '');
    if (target) out.push({ target, relation: m[2]?.trim() || undefined });
  }
  return out;
}
