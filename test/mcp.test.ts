import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createSchema, indexVault } from '../src/db.js';
import { loadVault } from '../src/vault.js';
import { buildServer } from '../src/mcp/server.js';

const SAMPLE_VAULT = path.join(fileURLToPath(import.meta.url), '../../examples/sample-vault');

/** Spin up the real MCP server over an in-memory transport and connect a client. */
async function connect() {
  const model = await loadVault(SAMPLE_VAULT);
  const db = new Database(':memory:');
  createSchema(db);
  indexVault(model, db);
  const server = buildServer(model, db);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientTransport); // performs the initialize handshake
  return { client, db };
}

/** Tool results are a JSON document inside a single text content block. */
function parse(res: { content: Array<{ type: string; text?: string }> }): unknown {
  assert.equal(res.content[0].type, 'text');
  return JSON.parse(res.content[0].text ?? '');
}

test('MCP: initialize handshake + tools/list exposes the documented tools', async () => {
  const { client, db } = await connect();
  const { tools } = await client.listTools();
  const names = new Set(tools.map((t) => t.name));
  for (const expected of [
    'search',
    'search_with_context',
    'search_sections',
    'list_facets',
    'get_note',
    'neighbours',
    'backlinks',
    'related',
    'relations',
    'write_note',
    'list_vaults',
  ]) {
    assert.ok(names.has(expected), `tools/list missing ${expected}`);
  }
  await client.close();
  db.close();
});

test('MCP: search tool returns structured hits over the protocol', async () => {
  const { client, db } = await connect();
  const res = await client.callTool({ name: 'search', arguments: { query: 'store a preset' } });
  const hits = parse(res as never) as Array<{ id: string }>;
  assert.ok(Array.isArray(hits) && hits.length > 0, 'expected hits');
  assert.ok(
    hits.some((h) => h.id === 'key_keyword_store' || h.id === 'key_presets_create'),
    `expected store/preset note, got ${hits.map((h) => h.id).join(', ')}`,
  );
  await client.close();
  db.close();
});

test('MCP: search_with_context returns the graph parent over the protocol', async () => {
  const { client, db } = await connect();
  const res = await client.callTool({
    name: 'search_with_context',
    arguments: { query: 'create presets' },
  });
  const hits = parse(res as never) as Array<{
    id: string;
    context?: { parent?: Array<{ id: string }> };
  }>;
  const page = hits.find((h) => h.id === 'key_presets_create');
  assert.ok(page, 'expected the Create Presets page in results');
  assert.ok(
    page.context?.parent?.some((p) => p.id === 'key_presets'),
    'expected the parent section in the hit context',
  );
  await client.close();
  db.close();
});

test('MCP: get_note fetches a note, and an unknown tool errors', async () => {
  const { client, db } = await connect();
  const note = parse((await client.callTool({
    name: 'get_note',
    arguments: { id: 'key_keyword_store' },
  })) as never) as { id?: string; body?: string };
  assert.equal(note.id, 'key_keyword_store');
  assert.ok((note.body ?? '').length > 0);

  // An unregistered tool must surface an error — either a protocol rejection or
  // an isError result, depending on SDK version.
  let errored = false;
  try {
    const r = (await client.callTool({ name: 'does_not_exist', arguments: {} })) as {
      isError?: boolean;
    };
    errored = r.isError === true;
  } catch {
    errored = true;
  }
  assert.ok(errored, 'calling an unregistered tool should error');
  await client.close();
  db.close();
});
