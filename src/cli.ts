import { existsSync } from 'node:fs';
import path from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadVault } from './vault.js';
import { search } from './retrieve.js';
import { buildServer } from './mcp/server.js';
import { openDb, indexVault, searchFts } from './db.js';

const USAGE = 'usage: brain <index|query|serve> <vault-root> [query...]';

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);

  if (cmd === 'index') {
    const root = rest[0] ?? '.';
    const model = await loadVault(root);
    const db = openDb(root);
    const stats = indexVault(model, db);
    db.close();
    console.log(
      `Indexed ${stats.total} notes (${stats.updated} updated), ${stats.links} links from ${root}`,
    );
    return;
  }

  if (cmd === 'query') {
    const root = rest[0];
    const q = rest.slice(1).join(' ');
    if (!root || !q) {
      console.error('usage: brain query <vault-root> <text>');
      process.exit(2);
    }
    const model = await loadVault(root);
    const dbPath = path.join(root, '.brain', 'vault-brain.sqlite');
    let hits;
    if (existsSync(dbPath)) {
      const db = openDb(root);
      hits = searchFts(db, q, 10);
      db.close();
      if (!hits.length) hits = search(model, q);
    } else {
      hits = search(model, q);
    }
    console.log(`\n${hits.length} result(s) for "${q}"\n`);
    for (const h of hits) console.log(`  [${h.score}] ${h.path}\n        ${h.snippet}`);
    return;
  }

  if (cmd === 'serve') {
    const root = rest[0] ?? '.';
    const model = await loadVault(root);
    const dbPath = path.join(root, '.brain', 'vault-brain.sqlite');
    const db = existsSync(dbPath) ? openDb(root) : undefined;
    const server = buildServer(model, db);
    await server.connect(new StdioServerTransport());
    console.error(
      `vault-brain serving "${model.manifest.vault.name}" (${model.notes.length} notes, FTS: ${db ? 'on' : 'off'}) over stdio`,
    );
    return;
  }

  console.error(USAGE);
  process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
