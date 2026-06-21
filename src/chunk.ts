/** A section chunk of a note body, split at ATX headings (`chunk: by-heading`). */
export interface Chunk {
  id: string; // `${noteId}#${anchor}`, or `noteId` for the lead chunk
  noteId: string;
  heading: string; // '' for the lead chunk (content before the first ## heading)
  anchor: string; // slugified heading; '' for the lead chunk
  level: number; // heading depth (0 for the lead chunk)
  ord: number; // order within the note
  body: string;
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;

/** Slugify a heading into a URL/anchor-safe token. */
export function slugifyAnchor(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Split a note body into section chunks at ATX headings of level >= 2 (the manifest's
 * `chunk: by-heading`). Content before the first such heading — including a leading
 * `# Title` — becomes the lead chunk. Duplicate heading anchors are de-duped (`-2`, `-3`).
 */
export function chunkBody(noteId: string, body: string): Chunk[] {
  const chunks: Chunk[] = [];
  const used = new Map<string, number>();
  let cur: { heading: string; level: number; lines: string[] } = {
    heading: '',
    level: 0,
    lines: [],
  };

  const flush = (): void => {
    const text = cur.lines.join('\n').trim();
    if (!text && !cur.heading) return; // skip an empty lead chunk
    let anchor = cur.heading ? slugifyAnchor(cur.heading) : '';
    if (anchor) {
      const n = (used.get(anchor) ?? 0) + 1;
      used.set(anchor, n);
      if (n > 1) anchor = `${anchor}-${n}`;
    }
    chunks.push({
      id: anchor ? `${noteId}#${anchor}` : noteId,
      noteId,
      heading: cur.heading,
      anchor,
      level: cur.level,
      ord: chunks.length,
      body: text,
    });
  };

  for (const line of body.split('\n')) {
    const m = HEADING_RE.exec(line);
    if (m && m[1].length >= 2) {
      flush();
      cur = { heading: m[2].trim(), level: m[1].length, lines: [] };
    } else {
      cur.lines.push(line);
    }
  }
  flush();
  return chunks;
}
