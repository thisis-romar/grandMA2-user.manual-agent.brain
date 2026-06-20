# grandMA2-user.manual-agent.brain (`vault-brain`)

A **vault-agnostic agent brain**: it turns any spec-conforming Obsidian vault into a
knowledge server exposed to AI agents over the **Model Context Protocol (MCP)** —
retrieval, graph navigation, and memory write-back. One brain, many vaults, wired by a
per-vault `.brain/manifest.yaml`.

> Repo name is `grandMA2-user.manual-agent.brain`; the npm package is named `vault-brain`
> (npm names can't contain uppercase or dots).

First consumer: [`grandma2-manual-vault`](https://github.com/thisis-romar/grandma2-manual-vault),
which ships a `.brain/manifest.yaml`.

## Status — P0 (this scaffold)

Working today, no external services required:

- **Manifest** loader + validator (`src/manifest.ts`).
- **Vault model**: frontmatter + `[[wikilink]]` graph + typed relations (`src/vault.ts`).
- **Retrieval**: in-memory keyword search (`src/retrieve.ts`).
- **Graph**: `neighbours` / `backlinks` / `related` (`src/graph.ts`).
- **Memory**: validated note write-back (`src/memory.ts`).
- **MCP server** over stdio exposing all tools (`src/mcp/server.ts`).
- **CLI**: `index` / `query` / `serve` (`src/cli.ts`).

Roadmap (next): **P1** SQLite + FTS5 index · **P2** embeddings + `sqlite-vec` hybrid
retrieval · **P3** richer MCP surface · **P4** memory audit (git) · **P5** multi-vault.

## Use

```bash
npm install
npm test                       # node --test via tsx
npm run index   examples/sample-vault
npm run query   examples/sample-vault -- store a preset
npm run serve   examples/sample-vault        # MCP server over stdio

# point it at the real vault (clone it alongside this repo):
npm run index   ../grandma2-manual-vault
```

### Wire into Claude Code

```bash
claude mcp add vault-brain -- npx tsx /abs/path/src/cli.ts serve /abs/path/to/vault
```

## MCP tools

`search(query,k?)` · `get_note(id)` · `neighbours(id,depth?)` · `backlinks(id)` ·
`related(id,k?)` · `write_note(type,title,body,summary?,links?)` · `list_vaults()`

See `AGENTS.md` for the agent tool-priority contract.
