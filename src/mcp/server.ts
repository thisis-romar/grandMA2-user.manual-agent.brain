import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Note, VaultModel } from '../types.js';
import { search } from '../retrieve.js';
import { backlinks, neighbours, related } from '../graph.js';
import { writeNote } from '../memory.js';

function text(obj: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(obj, null, 2) }] };
}

function brief(n: Note) {
  return { id: n.id, path: n.path, type: n.type, title: n.title, summary: n.summary };
}

/** Build an MCP server exposing the brain's tools over a loaded vault model. */
export function buildServer(model: VaultModel): McpServer {
  const server = new McpServer({ name: 'vault-brain', version: '0.1.0' });

  server.tool(
    'search',
    'Keyword search across notes (title/summary/body). Prefer this over reading files.',
    { query: z.string(), k: z.number().int().positive().max(50).optional() },
    async ({ query, k }) => text(search(model, query, k ?? 10)),
  );

  server.tool(
    'get_note',
    'Fetch a single note (frontmatter + body) by id/slug or vault path.',
    { id: z.string() },
    async ({ id }) => {
      const n = model.byId.get(id) ?? model.byPath.get(id);
      return n ? text(n) : text({ error: 'not found', id });
    },
  );

  server.tool(
    'neighbours',
    'Notes linked from/to this note (graph traversal) up to depth.',
    { id: z.string(), depth: z.number().int().positive().max(3).optional() },
    async ({ id, depth }) => text(neighbours(model, id, depth ?? 1).map(brief)),
  );

  server.tool(
    'backlinks',
    'Notes that link to this note.',
    { id: z.string() },
    async ({ id }) => text(backlinks(model, id).map(brief)),
  );

  server.tool(
    'related',
    'Notes most similar by shared link-neighbours (Jaccard).',
    { id: z.string(), k: z.number().int().positive().max(50).optional() },
    async ({ id, k }) =>
      text(related(model, id, k ?? 10).map((r) => ({ ...brief(r.note), score: r.score }))),
  );

  server.tool(
    'write_note',
    'Append a new manifest-conformant note (agent memory write-back). Validated before write.',
    {
      type: z.string(),
      title: z.string(),
      body: z.string(),
      summary: z.string().optional(),
      links: z.array(z.string()).optional(),
    },
    async (input) => {
      try {
        return text({ written: await writeNote(model, input) });
      } catch (e) {
        return text({ error: (e as Error).message });
      }
    },
  );

  server.tool('list_vaults', 'List the vault(s) this brain serves.', {}, async () =>
    text([{ name: model.manifest.vault.name, root: model.root, notes: model.notes.length }]),
  );

  return server;
}
