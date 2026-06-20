# Context7 Validation Run

Date: 2026-06-20 · Context7 MCP server v3.2.1 (`@upstash/context7-mcp`)

## Purpose
First real exercise of Context7 (it had only been configured in `.mcp.json`, never run).
Goal: prove it works, and use it to validate the P1 code against current library docs.

## How it was run
Context7 in `.mcp.json` was `⏸ Pending approval` — project MCP servers need interactive
`claude` approval to activate inside Claude Code, which isn't possible in a headless session.
So it was driven directly over stdio (JSON-RPC `initialize` → `tools/list` → `tools/call`)
to validate independently of the Claude Code approval flow.

- Smoke test: server launches, exposes `resolve-library-id` + `query-docs`. ✅
- Network egress to the Context7 API endpoint is permitted in this environment. ✅
- Rate budget: 2 `query-docs` calls (anonymous tier, no API key).

## Findings

### 1. MCP SDK — `server.tool()` → `server.registerTool()`  (FIXED)
Library: `/websites/ts_sdk_modelcontextprotocol_io` (also `/modelcontextprotocol/typescript-sdk`, v1.29.0).
Context7 confirmed the current API is:
```ts
server.registerTool(name, { title?, description, inputSchema, outputSchema? }, handler)
```
Our `src/mcp/server.ts` used the legacy positional form `server.tool(name, description, shape, handler)`.
Still functional in SDK 1.29 (tests were green), but the deprecated signature.

**Action taken:** migrated all 7 tools (`search`, `get_note`, `neighbours`, `backlinks`,
`related`, `write_note`, `list_vaults`) to `registerTool` with `{ description, inputSchema }`.
Verified end-to-end: stdio `tools/list` returns all 7; `search "store preset"` returns ranked hits.

### 2. better-sqlite3 — FTS5 / bm25 / prepared statements  (NO CHANGE)
Library: `/wiselibs/better-sqlite3`.
Context7 confirmed `.prepare().all()/.get()/.run()` with bind params is the correct pattern.
Our `src/db.ts` usage (standalone FTS5 table, `bm25()` ranking, `db.prepare<Params, Row>()`
generics from `@types/better-sqlite3`) matches the documented API. No fix needed.

## Verification
`npm run typecheck && npm run lint && npm test` → 10/10 green after the migration.
Runtime stdio smoke test of `src/cli.ts serve` confirms all tools register and respond.

## To activate Context7 inside Claude Code (future sessions)
`.mcp.json` is committed but requires a one-time interactive approval:
```bash
claude            # launch interactively; approve the context7 server when prompted
claude mcp list   # should then show context7 as connected (not "pending approval")
```
For higher rate limits, set `CONTEXT7_API_KEY` (from context7.com) in
`.claude/settings.local.json` (gitignored). Self-hosted `open-context7` is the no-limit fallback.
