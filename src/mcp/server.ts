import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import type { Note, SearchHit, SectionHit, VaultModel } from '../types.js';
import { focusedSnippet, search, searchSectionsInMemory } from '../retrieve.js';
import { searchFts, searchSections } from '../db.js';
import { chunkBody } from '../chunk.js';
import { ancestry, backlinks, neighbours, related, relations } from '../graph.js';
import { writeNote } from '../memory.js';

function text(obj: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(obj, null, 2) }] };
}

function brief(n: Note) {
  return { id: n.id, path: n.path, type: n.type, title: n.title, summary: n.summary };
}

/** Run FTS (with in-memory fallback) honoring exclude_types + an optional type filter. */
function runSearch(
  model: VaultModel,
  db: Database.Database | undefined,
  query: string,
  limit: number,
  type?: string,
): SearchHit[] {
  const exclude = model.manifest.retrieval?.exclude_types ?? [];
  const include = type ? [type] : [];
  let hits = db ? searchFts(db, query, limit, exclude, include) : [];
  if (!hits.length) hits = search(model, query, limit, include);
  return hits;
}

/** Add a breadcrumb (ancestor section titles) and a query-focused snippet to each hit. */
function enrich(model: VaultModel, query: string, hits: SearchHit[]): SearchHit[] {
  return hits.map((h) => {
    const n = model.byId.get(h.id) ?? model.byPath.get(h.path);
    const breadcrumb = n ? ancestry(model, n.path).map((a) => a.title) : [];
    const snippet = (n && focusedSnippet(n.body, query)) || h.snippet;
    return { ...h, snippet, ...(breadcrumb.length ? { breadcrumb } : {}) };
  });
}

/** Build an MCP server exposing the brain's tools over a loaded vault model. */
export function buildServer(model: VaultModel, db?: Database.Database): McpServer {
  const server = new McpServer({ name: 'vault-brain', version: '0.2.0' });

  server.registerTool(
    'search',
    {
      description:
        'Full-text search across notes (title/summary/body). Prefer this over reading files. ' +
        'Optional `type` narrows results to one note type (see list_facets).',
      inputSchema: {
        query: z.string(),
        k: z.number().int().positive().max(50).optional(),
        type: z.string().optional(),
      },
    },
    async ({ query, k, type }) => {
      const hits = runSearch(model, db, query, k ?? 10, type);
      return text(enrich(model, query, hits));
    },
  );

  server.registerTool(
    'search_with_context',
    {
      description:
        'Search plus one-call graph context: each hit returns its breadcrumb and surrounding ' +
        'notes (parent section, prev/next page, cross-refs, related, backlinks). Prefer this ' +
        'over search + follow-up neighbours/relations calls when you need context.',
      inputSchema: {
        query: z.string(),
        k: z.number().int().positive().max(20).optional(),
        type: z.string().optional(),
      },
    },
    async ({ query, k, type }) => {
      const hits = enrich(model, query, runSearch(model, db, query, k ?? 5, type));
      const out = hits.map((h) => {
        const rels = relations(model, h.id);
        return {
          ...h,
          context: {
            parent: rels.filter((r) => r.kind === 'parent').map((r) => brief(r.note)),
            sequence: rels
              .filter((r) => r.kind.startsWith('sequence-'))
              .map((r) => ({ rel: r.kind, ...brief(r.note) })),
            crossRefs: rels.filter((r) => r.kind === 'cross-ref').map((r) => brief(r.note)),
            related: related(model, h.id, 3).map((r) => ({ ...brief(r.note), score: r.score })),
            backlinks: backlinks(model, h.id).slice(0, 3).map(brief),
          },
        };
      });
      return text(out);
    },
  );

  server.registerTool(
    'search_sections',
    {
      description:
        'Section-level full-text search over heading chunks (`chunk: by-heading`). Returns the ' +
        'most relevant section of a note with its heading, breadcrumb, and a focused snippet; ' +
        'use the returned id with get_note for the full section. Prefer this for precise lookups ' +
        'inside long notes (tables, command syntax, one procedure).',
      inputSchema: { query: z.string(), k: z.number().int().positive().max(20).optional() },
    },
    async ({ query, k }) => {
      const limit = k ?? 10;
      const exclude = model.manifest.retrieval?.exclude_types ?? [];
      let hits: SectionHit[] = db ? searchSections(db, query, limit, exclude) : [];
      if (!hits.length) hits = searchSectionsInMemory(model, query, limit);
      const out = hits.map((h) => {
        const breadcrumb = ancestry(model, h.noteId).map((a) => a.title);
        return { ...h, ...(breadcrumb.length ? { breadcrumb } : {}) };
      });
      return text(out);
    },
  );

  server.registerTool(
    'list_facets',
    {
      description:
        'List filterable facet values: note-type counts (always), plus value counts for a given ' +
        'frontmatter field (e.g. keyword_type, depth, ma2_section). Use to drive the `type` filter.',
      inputSchema: { field: z.string().optional() },
    },
    async ({ field }) => {
      const typeCounts: Record<string, number> = {};
      for (const n of model.notes) typeCounts[n.type] = (typeCounts[n.type] ?? 0) + 1;
      const res: Record<string, unknown> = { type: typeCounts };
      if (field) {
        const counts: Record<string, number> = {};
        for (const n of model.notes) {
          const v = n.frontmatter[field];
          for (const item of Array.isArray(v) ? v : [v]) {
            if (item == null || item === '') continue;
            const key = String(item);
            counts[key] = (counts[key] ?? 0) + 1;
          }
        }
        res[field] = counts;
      }
      return text(res);
    },
  );

  server.registerTool(
    'get_note',
    {
      description:
        'Fetch a single note (frontmatter + body) by id/slug or vault path. Append `#anchor` ' +
        '(e.g. `key_x#usage`) to fetch just one heading section; the full note includes a ' +
        '`sections` list of available anchors.',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const hash = id.indexOf('#');
      const baseId = hash >= 0 ? id.slice(0, hash) : id;
      const anchor = hash >= 0 ? id.slice(hash + 1) : '';
      const n = model.byId.get(baseId) ?? model.byPath.get(baseId);
      if (!n) return text({ error: 'not found', id });
      const chunks = chunkBody(n.id, n.body);
      if (anchor) {
        const c = chunks.find((x) => x.anchor === anchor);
        return c
          ? text({ id: c.id, noteId: n.id, path: n.path, heading: c.heading, body: c.body })
          : text({ error: 'anchor not found', id, anchors: chunks.map((x) => x.anchor).filter(Boolean) });
      }
      const sections = chunks
        .filter((c) => c.anchor)
        .map((c) => ({ anchor: c.anchor, heading: c.heading, level: c.level }));
      return text({ ...n, sections });
    },
  );

  server.registerTool(
    'neighbours',
    {
      description: 'Notes linked from/to this note (graph traversal) up to depth.',
      inputSchema: { id: z.string(), depth: z.number().int().positive().max(3).optional() },
    },
    async ({ id, depth }) => text(neighbours(model, id, depth ?? 1).map(brief)),
  );

  server.registerTool(
    'backlinks',
    {
      description: 'Notes that link to this note.',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => text(backlinks(model, id).map(brief)),
  );

  server.registerTool(
    'related',
    {
      description: 'Notes most similar by shared link-neighbours (Jaccard).',
      inputSchema: { id: z.string(), k: z.number().int().positive().max(50).optional() },
    },
    async ({ id, k }) =>
      text(related(model, id, k ?? 10).map((r) => ({ ...brief(r.note), score: r.score }))),
  );

  server.registerTool(
    'relations',
    {
      description:
        'Typed graph edges for a note from the manifest contract: parent/child section, ' +
        'prev/next page, cross-refs. Optional kind filter (e.g. parent, sequence-next, cross-ref).',
      inputSchema: { id: z.string(), kind: z.string().optional() },
    },
    async ({ id, kind }) =>
      text(
        relations(model, id, kind).map((r) => ({
          kind: r.kind,
          direction: r.direction,
          ...brief(r.note),
        })),
      ),
  );

  server.registerTool(
    'write_note',
    {
      description:
        'Append a new manifest-conformant note (agent memory write-back). Validated before write.',
      inputSchema: {
        type: z.string(),
        title: z.string(),
        body: z.string(),
        summary: z.string().optional(),
        links: z.array(z.string()).optional(),
      },
    },
    async (input) => {
      try {
        return text({ written: await writeNote(model, input, db) });
      } catch (e) {
        return text({ error: (e as Error).message });
      }
    },
  );

  server.registerTool(
    'list_vaults',
    { description: 'List the vault(s) this brain serves.', inputSchema: {} },
    async () =>
      text([{ name: model.manifest.vault.name, root: model.root, notes: model.notes.length }]),
  );

  return server;
}
