# grandMA2-user.manual-agent.brain (`vault-brain`)

A **vault-agnostic agent brain**: it turns any spec-conforming Obsidian vault into a
knowledge server exposed to AI agents over the **Model Context Protocol (MCP)** —
retrieval, graph navigation, and memory write-back. One brain, many vaults, wired by a
per-vault `.brain/manifest.yaml`.

> Repo name is `grandMA2-user.manual-agent.brain`; the npm package is named `vault-brain`
> (npm names can't contain uppercase or dots).

First consumer: [`grandma2-manual-vault`](https://github.com/thisis-romar/grandma2-manual-vault),
which ships a `.brain/manifest.yaml`.

## Status — P0 + P1

Working today, no external services required:

- **Manifest** loader + validator (`src/manifest.ts`).
- **Vault model**: frontmatter + `[[wikilink]]` graph + typed relations (`src/vault.ts`).
- **Retrieval**: SQLite **FTS5** full-text search (BM25), with in-memory keyword
  fallback when no index exists (`src/db.ts`, `src/retrieve.ts`).
- **Index**: persistent SQLite at `<vault>/.brain/vault-brain.sqlite` with incremental
  reindex by file hash (`src/db.ts`).
- **Graph**: `neighbours` / `backlinks` / `related` (`src/graph.ts`).
- **Memory**: validated note write-back (`src/memory.ts`).
- **MCP server** over stdio exposing all tools via `registerTool` (`src/mcp/server.ts`).
- **CLI**: `index` / `query` / `serve` (`src/cli.ts`).

Roadmap (next): **P2** embeddings + `sqlite-vec` hybrid retrieval · **P3** richer MCP
surface · **P4** memory audit (git) · **P5** multi-vault.

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
`related(id,k?)` · `relations(id,kind?)` · `write_note(type,title,body,summary?,links?)` ·
`list_vaults()`

`relations` walks the manifest's typed edges (parent/child section, prev/next page,
cross-refs) in both directions — distinct from `neighbours`, which follows inline wikilinks.

See `AGENTS.md` for the agent tool-priority contract.

## Bundled MCP servers (`.mcp.json`)

This repo ships a project-level `.mcp.json` for dev sessions:

- **context7** — live, versioned library docs (`resolve-library-id`, `query-docs`).
- **sequential-thinking** — structured multi-step reasoning (`sequentialthinking`).

Both run via `npx` and need a one-time interactive approval (`claude`, then approve);
`claude mcp list` shows their state. See `docs/context7-validation.md` for the validation run
and rate-limit notes.
