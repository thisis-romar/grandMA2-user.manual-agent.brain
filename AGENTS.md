# Agent instructions — vault-brain

This repo is an MCP **knowledge server** over one or more Obsidian vaults. When a
`vault-brain` server is connected, agents MUST follow this tool-call priority:

| Priority | Action |
|---|---|
| 1 (first) | Call a brain MCP tool (`search_with_context`, `search`, `neighbours`, `get_note`) |
| 2 | Read the specific note the graph pointed you to |
| 3 (last resort) | Scan directories / read many files without graph guidance |

**Tools:** `search`, `search_with_context`, `search_sections`, `get_note`, `neighbours`, `backlinks`, `related`, `relations`, `list_facets`, `write_note`, `list_vaults`.
- `search(query,k?,type?)` returns hits with a breadcrumb (ancestor section titles) and a highlighted, query-focused snippet; `type` narrows to one note type.
- `search_with_context` returns each hit plus its surrounding graph (parent, prev/next, cross-refs, related, backlinks) in one call — prefer it when you need context, to avoid follow-up `neighbours`/`relations` calls.
- `search_sections(query,k?)` searches heading-level chunks (`chunk: by-heading`) and returns the most relevant section; `get_note(id#anchor)` fetches just that section (`get_note(id)` lists a note's section anchors). Prefer for precise lookups in long notes (tables, command syntax, one procedure).
- `relations` follows the manifest's typed edges — parent/child section, prev/next page, cross-refs — in both directions.
- `list_facets(field?)` lists note-type counts (and value counts for a frontmatter field) to drive the `type` filter.

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

## Model attribution & provenance

`.husky/prepare-commit-msg` calls `scripts/commit-trailers.sh` to auto-append
authoring trailers (skipped if a `Co-authored-by` already exists):

```
Co-authored-by: Claude Opus 4.8 <noreply@anthropic.com>
Generated-with: Claude Code 2.1.183
Claude-Session: <session id>
Claude-Entrypoint: remote
```

Model resolution (`scripts/detect-ai-model.sh`) cascade:
1. `$CLAUDE_MODEL` env var (explicit override)
2. `git config user.ai-model` (manual pin — `scripts/set-ai-model.sh "Claude X"`)
3. **Auto-detect** — active model from the live session transcript
   (`$CLAUDE_CODE_SESSION_ID`), e.g. `claude-opus-4-8` → `Claude Opus 4.8`.
   Friendly name only; the raw model id is never committed.

Provenance fields (version/session/entrypoint) come from the transcript + env.
No setup needed inside Claude Code. Outside a session each field is simply omitted.
