---
name: vault-brain-retrieval
description: >-
  Answer questions from a connected vault-brain MCP knowledge base (e.g. the grandMA2
  manual) by querying the brain's tools instead of scanning files. Use whenever you need
  to find, look up, understand, or cite documentation, definitions, procedures, or
  reference data that lives in the vault. Encodes the tool-priority workflow: search →
  expand via graph → cite with breadcrumbs.
---

# Querying a vault-brain knowledge base

`vault-brain` exposes a curated Obsidian vault (human-authored `[[wikilinks]]` + typed
frontmatter relations) over MCP. The graph is the asset — prefer the tools over reading
files. The full contract is in `AGENTS.md`; this skill is the how-to.

## Tool-priority workflow

1. **Find** — start with a brain tool, never a directory scan:
   - `search_with_context(query, k?, type?)` — **preferred**. Returns hits *and* their
     surrounding graph (parent section, prev/next page, cross-refs, related, backlinks) in
     one call, so you usually don't need follow-ups.
   - `search(query, k?, type?)` — lighter; hits carry a `breadcrumb` (ancestor section
     titles) and a highlighted, query-focused `snippet`.
   - `search_sections(query, k?)` — for a precise lookup *inside* a long note (a table,
     command syntax, one procedure). Returns the most relevant heading section + its id.
   - Narrow with `type` when the query implies a kind (e.g. `type: "keyword"` for a
     keyword lookup). Call `list_facets()` to see available types and counts, or
     `list_facets("keyword_type")` to see a field's values.
2. **Read** — `get_note(id)` for the full note the graph pointed you to (use the `id`/slug
   or vault path from a hit); it lists the note's section anchors. Use `get_note(id#anchor)`
   to fetch just one section. Don't fetch full notes you don't need; the snippet + summary
   often answer the question.
3. **Expand** (only if `search_with_context` wasn't enough):
   - `relations(id, kind?)` — typed edges (`parent`, `sequence-prev`, `sequence-next`,
     `cross-ref`) in both directions. Use `kind: "sequence-next"` to read a procedure in
     order, `kind: "parent"` to climb to the section.
   - `neighbours(id, depth?)` — inline wikilink graph (depth ≤ 2; default 1).
   - `backlinks(id)` / `related(id, k?)` — what points here / what's similar.
4. **Last resort** — only scan files directly if the tools genuinely can't answer.

## Citing

Use the `breadcrumb` + title from hits to cite precisely, e.g.
*"Remote Control › Telnet Remote"*. Quote the snippet, then `get_note` for detail.

## Do not

- Scan `node_modules`, `dist`, `.git`, or a vault's `.brain/`.
- Re-run `search` then `neighbours` + `relations` separately when
  `search_with_context` would return all of it in one call.

## Example

> "How do I configure the Telnet remote?"

1. `search_with_context("telnet remote configure", type: "page")`
2. Read the top hit's `context.sequence` for prev/next pages; `context.parent` for the
   section. If you need the exact steps, `get_note(<hit.id>)`.
3. Answer, citing the breadcrumb (e.g. *Remote Control › Telnet Remote*).
