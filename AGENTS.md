# Agent instructions — vault-brain

This repo is an MCP **knowledge server** over one or more Obsidian vaults. When a
`vault-brain` server is connected, agents MUST follow this tool-call priority:

| Priority | Action |
|---|---|
| 1 (first) | Call a brain MCP tool (`search`, `neighbours`, `get_note`) |
| 2 | Read the specific note the graph pointed you to |
| 3 (last resort) | Scan directories / read many files without graph guidance |

**Tools:** `search`, `get_note`, `neighbours`, `backlinks`, `related`, `write_note`, `list_vaults`.

**Excluded paths:** never scan `node_modules`, `dist`, `.git`, a vault's `.brain/`.

A vault is described by its own `.brain/manifest.yaml` (frontmatter schema, link style,
taxonomy, typed relations, retrieval policy). The brain is vault-agnostic: point it at any
manifest-conformant vault.

---

## Context7 (MCP: `resolve-library-id` + `query-docs`)

Context7 provides live, versioned library documentation. Use it sparingly to stay within
free-tier rate limits (~500–1K requests/month anonymous; higher with `CONTEXT7_API_KEY`).

**Call when:** you need to look up a specific unfamiliar method or option in a dependency.
**Skip when:** working with Node.js built-ins, `gray-matter`, or anything already known.

High-value targets for this project:
- `@modelcontextprotocol/sdk` — MCP tool registration, transport, server lifecycle
- `better-sqlite3` — prepared statements, transactions, FTS5 queries
- `zod` — schema refinements, `.parse()` vs `.safeParse()`

Self-hosted fallback (no rate limits): `open-context7` (Apache 2.0, Docker, drop-in replacement).

---

## Model attribution

Commits get `Co-authored-by` auto-injected by `.husky/prepare-commit-msg`, which
calls `scripts/detect-ai-model.sh`. Resolution cascade:

1. `$CLAUDE_MODEL` env var (explicit override)
2. `git config user.ai-model` (manual pin — `scripts/set-ai-model.sh "Claude X"`)
3. **Auto-detect** — reads the active model from the live Claude Code session
   transcript (`$CLAUDE_CODE_SESSION_ID`), mapping e.g. `claude-opus-4-8` →
   `Claude Opus 4.8`. Friendly name only; the raw model id is never committed.

No setup needed inside Claude Code — attribution is automatic. Outside a Claude
Code session (plain dev shell) it falls back to the pin/env, or skips if neither.
