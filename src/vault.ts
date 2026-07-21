import { promises as fs } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { loadManifest } from './manifest.js';
import {
  parseWikilinks,
  parseCommonMarkLinks,
  resolveLink,
  wikilinkInner,
  type ResolveMaps,
} from './links.js';
import type { Manifest, Note, VaultModel } from './types.js';

const IGNORE_DIRS = new Set([
  '.git',
  '.github',
  'node_modules',
  '.obsidian',
  '_quartz',
  '.brain',
  'scripts',
]);

const SKIP_FILES = new Set(['README.md', 'CLAUDE.md', 'AGENTS.md']);

async function walk(dir: string, root: string, out: string[]): Promise<void> {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (e.name.startsWith('.') || IGNORE_DIRS.has(e.name)) continue;
      await walk(path.join(dir, e.name), root, out);
    } else if (e.name.endsWith('.md') && !SKIP_FILES.has(e.name)) {
      out.push(path.relative(root, path.join(dir, e.name)).split(path.sep).join('/'));
    }
  }
}

function typeOf(file: string, m: Manifest, fmType?: string): string {
  if (fmType) return fmType;
  for (const [folder, t] of Object.entries(m.taxonomy.folders)) {
    if (file.startsWith(folder)) return t;
  }
  return 'note';
}

function toArr(v: unknown): string[] {
  if (v == null) return [];
  return (Array.isArray(v) ? v : [v]).map((x) => String(x));
}

function pushMap(map: Map<string, string[]>, key: string, value: string): void {
  const arr = map.get(key);
  if (arr) arr.push(value);
  else map.set(key, [value]);
}

/** Load a vault directory into an in-memory model (notes + resolved link graph). */
export async function loadVault(root: string): Promise<VaultModel> {
  const manifest = await loadManifest(root);
  const files: string[] = [];
  await walk(root, root, files);

  const notes: Note[] = [];
  for (const file of files) {
    const raw = await fs.readFile(path.join(root, file), 'utf8');
    let data: Record<string, unknown> = {};
    let body = raw;
    try {
      const g = matter(raw);
      data = g.data as Record<string, unknown>;
      body = g.content;
    } catch {
      /* malformed frontmatter — treat whole file as body */
    }
    const notePath = file.replace(/\.md$/, '');
    const id = String(data[manifest.links.id_field] ?? notePath);
    const summaryField = manifest.retrieval?.summary_field ?? 'summary';
    notes.push({
      id,
      path: notePath,
      file,
      type: typeOf(file, manifest, data.type as string | undefined),
      title: (data.title as string) || notePath.split('/').pop()!,
      summary: (data[summaryField] as string) || '',
      aliases: toArr(data.aliases),
      tags: toArr(data.tags),
      frontmatter: data,
      body,
      outlinks: [],
      relations: [],
    });
  }

  const byPath = new Map(notes.map((n) => [n.path, n]));
  const byId = new Map(notes.map((n) => [n.id, n]));
  const maps: ResolveMaps = {
    byPath: new Set(byPath.keys()),
    ci: new Map(notes.map((n) => [n.path.toLowerCase(), n.path])),
    byBasename: new Map(),
  };
  for (const n of notes) {
    const b = n.path.split('/').pop()!.toLowerCase();
    if (!maps.byBasename.has(b)) maps.byBasename.set(b, n.path);
  }

  const backlinks = new Map<string, string[]>();
  const commonmark = manifest.links.style === 'commonmark';
  for (const n of notes) {
    const seen = new Set<string>();
    if (commonmark) {
      // CommonMark links; a link title becomes a typed edge (relation kind).
      for (const { target, relation } of parseCommonMarkLinks(n.body)) {
        const resolved = resolveLink(target, maps);
        if (resolved && resolved !== n.path && !seen.has(resolved)) {
          seen.add(resolved);
          n.outlinks.push(resolved);
          pushMap(backlinks, resolved, n.path);
          if (relation) n.relations.push({ kind: relation, to: resolved });
        }
      }
    } else {
      for (const { target } of parseWikilinks(n.body)) {
        const resolved = resolveLink(target, maps);
        if (resolved && resolved !== n.path && !seen.has(resolved)) {
          seen.add(resolved);
          n.outlinks.push(resolved);
          pushMap(backlinks, resolved, n.path);
        }
      }
    }
    for (const [field, rel] of Object.entries(manifest.relations ?? {})) {
      for (const val of toArr(n.frontmatter[field])) {
        const resolved = resolveLink(wikilinkInner(val), maps);
        if (resolved) n.relations.push({ kind: rel.kind, to: resolved });
      }
    }
  }

  return { root, manifest, notes, byId, byPath, backlinks };
}
