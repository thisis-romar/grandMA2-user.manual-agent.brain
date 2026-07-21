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
- **Retrieval**: SQLite **FTS5** full-text search (BM25) at note **and section** level
  (heading chunks, `chunk: by-heading`), with in-memory keyword fallback when no index
  exists (`src/db.ts`, `src/retrieve.ts`, `src/chunk.ts`).
- **Index**: persistent SQLite at `<vault>/.brain/vault-brain.sqlite` with incremental
  reindex by file hash; notes + section chunks (`src/db.ts`).
- **Graph**: `neighbours` / `backlinks` / `related` (`src/graph.ts`).
- **Memory**: validated note write-back (`src/memory.ts`).
- **MCP server** over stdio exposing all tools via `registerTool` (`src/mcp/server.ts`).
- **CLI**: `index` / `query` / `serve` / `eval` (`src/cli.ts`).
- **Eval harness** (`src/eval.ts`): scores a golden query set with recall@k + MRR over any
  retriever (in-memory or SQLite/FTS, note- or section-level) — a regression gate for retrieval.

Roadmap (next): **P2** embeddings + `sqlite-vec` hybrid retrieval · **P3** richer MCP
surface · **P4** memory audit (git) · **P5** multi-vault.

## Requirements

- **Node.js 20+** (CI runs 22 LTS; see `.nvmrc` — `nvm use` picks it up).
- A C/C++ toolchain + Python 3 for the `better-sqlite3` native build. On a fresh clone,
  `npm ci` builds it automatically; if the native module fails to load later, run
  `npm rebuild better-sqlite3`.
- The real vault ships as a git submodule. After cloning:

  ```bash
  git submodule update --init --recursive
  ```

## Use

```bash
npm ci                         # installs deps + builds better-sqlite3
npm test                       # node --test via tsx
npm run index   examples/sample-vault
npm run query   examples/sample-vault -- store a preset
npm run serve   examples/sample-vault        # MCP server over stdio

# point it at the real grandMA2 vault (vendored as a submodule):
npm run index   vendor/grandma2-manual-vault

# score retrieval quality against a golden query set (recall@k + MRR):
npm run eval    examples/sample-vault examples/golden-queries.json          # in-memory
npm run eval    examples/sample-vault examples/golden-queries.json -- --db  # SQLite/FTS
npm run eval    vendor/grandma2-manual-vault examples/golden-queries.vendor.json -- --db
```

### Updating the vendored vault & re-indexing

```bash
git submodule update --remote vendor/grandma2-manual-vault   # pull latest vault content
npm run index vendor/grandma2-manual-vault                   # re-index (incremental)
```

Indexing is **incremental**: notes are hashed, so a re-index only touches changed/added/removed
notes. The index lives at `<vault>/.brain/vault-brain.sqlite` (git-ignored). For a clean
rebuild, delete it first:

```bash
rm vendor/grandma2-manual-vault/.brain/vault-brain.sqlite*
npm run index vendor/grandma2-manual-vault
```

## Register this MCP (reproducible)

A fresh clone needs **no build artifact** — there is no committed `dist/` and none is
required. `src/cli.ts` runs directly under `tsx` (a dev dependency), so the two steps below
work from a clean checkout on any machine with Node 20+:

```bash
# 1. from the repo root — installs deps + tsx, builds better-sqlite3 (see Requirements above)
npm ci

# 2. register the server with Claude Code (run once; path args are ABSOLUTE)
claude mcp add vault-brain -- npx tsx /ABS/PATH/TO/vault-brain/src/cli.ts serve /ABS/PATH/TO/vault
```

The **vault path is a parameter**, not a constant: point the same brain at any
manifest-conformant OKF vault. For example, to serve the companion
[`github-projects-manual-vault`](https://github.com/EMBLEM-NLP/github-projects-manual-vault):

```bash
claude mcp add vault-brain -- \
  npx tsx /ABS/PATH/TO/vault-brain/src/cli.ts serve /ABS/PATH/TO/github-projects-manual-vault
```

Notes:

- The CLI subcommand is `serve` and the vault root is its **first positional arg**
  (`brain serve <vault-root>`; see `src/cli.ts`). On boot it prints, to stderr,
  `vault-brain serving "<vault name>" (<n> notes, FTS: <on|off>) over stdio`.
- Use an **absolute path to `src/cli.ts`** so the command is independent of the directory the
  MCP client launches it from. The relative form `npx tsx src/cli.ts serve <vault>` only works
  when the process runs from the repo root.
- FTS is `on` only if the vault has a prebuilt index at `<vault>/.brain/vault-brain.sqlite`
  (run `npm run index <vault>` first); otherwise the server still boots with an in-memory
  keyword fallback (`FTS: off`).
- `claude mcp list` shows the server's state after registration.

## MCP tools

`search(query,k?,type?)` · `search_with_context(query,k?,type?)` · `search_sections(query,k?)` ·
`get_note(id)` · `neighbours(id,depth?)` · `backlinks(id)` · `related(id,k?)` ·
`relations(id,kind?)` · `list_facets(field?)` · `write_note(type,title,body,summary?,links?)` ·
`list_vaults()`

`search` returns hits enriched with a **breadcrumb** (ancestor section titles) and a
query-focused, highlighted **snippet**; `type` narrows to one note type (see `list_facets`).
`search_with_context` adds each hit's surrounding graph (parent, prev/next, cross-refs,
related, backlinks) in one call, to avoid follow-up `neighbours`/`relations` round-trips.
`search_sections` searches **heading-level chunks** (the manifest's `chunk: by-heading`) and
returns the most relevant section of a note; `get_note(id#anchor)` then fetches just that
section (a plain `get_note(id)` lists the note's section anchors).
`relations` walks the manifest's typed edges (parent/child section, prev/next page,
cross-refs) in both directions — distinct from `neighbours`, which follows inline wikilinks.

See `AGENTS.md` for the agent tool-priority contract. Claude Code users also get a
model-invoked skill at `.claude/skills/vault-brain-retrieval/` that teaches the same
search → expand → cite workflow on demand.

## Bundled MCP servers (`.mcp.json`)

This repo ships a project-level `.mcp.json` for dev sessions:

- **context7** — live, versioned library docs (`resolve-library-id`, `query-docs`).
- **sequential-thinking** — structured multi-step reasoning (`sequentialthinking`).

Both run via `npx` and need a one-time interactive approval (`claude`, then approve);
`claude mcp list` shows their state. See `docs/context7-validation.md` for the validation run
and rate-limit notes.
