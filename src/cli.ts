import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadVault } from './vault.js';
import { search } from './retrieve.js';
import { buildServer } from './mcp/server.js';

const USAGE = 'usage: brain <index|query|serve> <vault-root> [query...]';

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);

  if (cmd === 'index') {
    const root = rest[0] ?? '.';
    const model = await loadVault(root);
    const edges = model.notes.reduce((a, n) => a + n.outlinks.length, 0);
    const byType: Record<string, number> = {};
    for (const n of model.notes) byType[n.type] = (byType[n.type] ?? 0) + 1;
    console.log(`Indexed ${model.notes.length} notes, ${edges} links from ${root}`);
    console.log('by type:', Object.entries(byType).map(([t, c]) => `${t}=${c}`).join('  '));
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
    const hits = search(model, q);
    console.log(`\n${hits.length} result(s) for "${q}"\n`);
    for (const h of hits) console.log(`  [${h.score}] ${h.path}\n        ${h.snippet}`);
    return;
  }

  if (cmd === 'serve') {
    const root = rest[0] ?? '.';
    const model = await loadVault(root);
    const server = buildServer(model);
    await server.connect(new StdioServerTransport());
    // stdout is the MCP channel; log to stderr.
    console.error(
      `vault-brain serving "${model.manifest.vault.name}" (${model.notes.length} notes) over stdio`,
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
