import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadVault } from './vault.js';
import { search } from './retrieve.js';
import { buildServer } from './mcp/server.js';
import { openDb, indexVault, searchFts } from './db.js';
import { evalVault, type GoldenQuery } from './eval.js';

const USAGE = 'usage: brain <index|query|serve|eval> <vault-root> [args...]';

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);

  if (cmd === 'index') {
    const root = rest[0] ?? '.';
    const model = await loadVault(root);
    const db = openDb(root);
    const stats = indexVault(model, db);
    db.close();
    console.log(
      `Indexed ${stats.total} notes (${stats.updated} updated, ${stats.removed} removed), ${stats.links} links from ${root}`,
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
      hits = searchFts(db, q, 10, model.manifest.retrieval?.exclude_types ?? []);
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

  if (cmd === 'eval') {
    const root = rest[0];
    const queryFile = rest.find((a, i) => i >= 1 && !a.startsWith('--'));
    if (!root || !queryFile) {
      console.error('usage: brain eval <vault-root> <golden-queries.json> [--db] [--sections]');
      process.exit(2);
    }
    const queries = JSON.parse(await fs.readFile(queryFile, 'utf8')) as GoldenQuery[];
    const model = await loadVault(root);
    let db;
    if (rest.includes('--db')) {
      db = openDb(root);
      indexVault(model, db);
    }
    const report = evalVault(model, db, queries, { sections: rest.includes('--sections') });
    db?.close();
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.error(USAGE);
  process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
