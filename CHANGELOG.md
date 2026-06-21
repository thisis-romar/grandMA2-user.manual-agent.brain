# Changelog

All notable changes to **vault-brain** are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — 2026-06-21

Context-rich retrieval, a real eval harness, and provenance/CI tooling on top of the
P0+P1 base.

### Added
- **Retrieval context forms:** breadcrumbs (ancestor section titles) and query-focused,
  highlighted snippets on search hits.
- **MCP tools:** `search_with_context` (hit + parent/sequence/cross-refs/related/backlinks in
  one call), `list_facets`, `search_sections` (heading-level chunks), and `relations` (typed
  graph edges); `get_note` accepts `id#anchor` for a single section.
- **Section chunking:** honors the manifest's `chunk: by-heading` (previously a no-op).
- **Eval harness** (`src/eval.ts`, `brain eval`, `npm run eval`): recall@k + MRR + graph
  `enrichment_rate` over a golden query set, with a calibrated vendor-vault regression gate.
- **MCP integration test** driving the server over the protocol (handshake, tools/list, calls).
- **Provenance tooling:** additive `prepare-commit-msg` hook + `scripts/pr-trailers.sh` for PR
  bodies, sharing resolution via `scripts/lib/provenance.sh`; shellcheck added to CI.
- **Retrieval skill** (`.claude/skills/vault-brain-retrieval/SKILL.md`).
- `.nvmrc`, `CLAUDE.md` (`@AGENTS.md` shim), and fresh-clone hardening docs.

### Changed
- `validateManifest` now rejects an unsupported `spec_version`.
- FTS search prunes deleted notes on reindex and honors `exclude_types`/`type` filters.
- `vault-contract.md` corrected: `keyword_type` is currently always `"unknown"` in the data;
  slug ids are snake_case; the engine is vault-agnostic and these docs are grandMA2's instance.

### Fixed
- Lazy native `better-sqlite3` load with an actionable rebuild message.
- `write_note` path-traversal hardening and immediate index write-back.

### Notes
- The package is intentionally proprietary (`license: UNLICENSED`, `private: true`) per
  `LICENSE`. Hosting it in a public repository is a visibility decision, not a code setting.

## [0.1.0] — initial

- **P0:** vault model (manifest + frontmatter + wikilinks), in-memory retrieval, graph
  traversal (neighbours/backlinks/related), memory write-back, and an MCP server over stdio.
- **P1:** persistent SQLite + FTS5 index with incremental (file-hash) reindexing.
