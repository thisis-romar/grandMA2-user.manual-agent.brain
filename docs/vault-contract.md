# Vault Contract — grandma2-manual-vault

This document describes the interface between **vault-brain** (this engine) and
its primary consumer vault, `grandma2-manual-vault`. Read it if you're wiring
a connector, writing a research agent, or adding a second vault.

---

## Content format

**Format**: Obsidian-style Markdown + YAML frontmatter
**Wikilink style**: `[[Path/Note]]` and `[[Path/Note|alias]]` (path-qualified from vault root)
**ID field**: `slug` — stable, kebab-style canonical identifier per note (e.g. `key_remote_control_telnet`)
**Content type**: Curated notes — not raw manual HTML, not embeddings. Each note is a
human-edited Markdown page derived from the [MA Lighting help site](https://help.malighting.com/grandMA2/en/help/)
with resolved cross-links, added `summary` frontmatter, and typed wikilink relations.

Manifest lives at: `.brain/manifest.yaml` (machine-readable schema contract).

---

## Folder taxonomy

| Folder | Note type | Count | Purpose |
|---|---|---|---|
| `Sections/` | `section` | 55 | Chapter containers — link to their child pages |
| `Pages/` | `page` | 374 | Main content pages — the manual body |
| `Keywords/` | `keyword` | 317 | Command keyword reference (one file per keyword) |
| `Keys/` | `key` | 79 | Physical console key reference |
| `QuickStart/` | `quick-start` | 16 | Quick-start guide pages |
| `000 *.md` | `moc` | ~3 | Maps of Content — excluded from retrieval |

---

## Where command references live

| What | Path |
|---|---|
| All command keywords (Store, Assign, Delete, …) | `Keywords/*.md` |
| Syntax rules, object/function/helper keyword lists | `Pages/Command Syntax and Keywords/*.md` |
| Attribute list | `Pages/Command Syntax and Keywords/Attribute List.md` |
| General syntax rules | `Pages/Command Syntax and Keywords/General Syntax Rules.md` |
| Cue/sequence command pages | `Pages/Cues and Sequences/` and `Pages/Advanced Sequence Functionality/` |

Focused machine-readable index: [`docs/index/commands-index.json`](index/commands-index.json)

---

## Where networking and Telnet docs live

| What | Path |
|---|---|
| **Telnet remote control** | `Pages/Remote Control/Telnet Remote.md` — slug `key_remote_control_telnet` |
| Telnet port | 30000 (read-only: 30001 via System Monitor) |
| Web remote | `Pages/Remote Control/Web Remote.md` |
| MIDI Show Control | `Pages/Remote Control/MIDI Show Control (MSC).md` |
| Remote inputs | `Pages/Remote Control/Remote Inputs.md` |
| All networking pages | `Pages/Networking/*.md` (19 pages) |
| Session setup, IP config | `Pages/Networking/How to create a session.md`, `Set the IP address in the console.md` |
| Network DMX protocols | `Pages/Networking/Network DMX protocols.md` |
| MA NDPs / Network Switch / xPort | `Pages/Control MA NDPs/`, `Pages/Control MA Network Switch/`, `Pages/Control MA xPort Nodes/` |

Focused machine-readable index: [`docs/index/networking-index.json`](index/networking-index.json)

---

## Frontmatter schema (key fields)

All notes carry `type` and `slug`. Additional fields by type:

```yaml
# page
type: page
slug: key_<section>_<topic>
section: "Command Syntax and Keywords"    # human label
section_ref: "[[Sections/Command Syntax and Keywords]]"
prev_page: "[[Pages/...]]"
next_page: "[[Pages/...]]"
summary: "One-line description."
depth: 2

# keyword
type: keyword
slug: key_keyword_<name>
keyword: Store
keyword_type: Object        # Object | Function | Helping | Attribute | Special
related_key: "[[Keys/Store Key.md]]"
summary: "..."

# key
type: key
slug: key_key_<label>
key_label: Store
related_keyword: "[[Keywords/Store keyword.md]]"

# section
type: section
slug: key_<section>
page_count: 26
pages: ["[[Pages/Command Syntax and Keywords/General Syntax Rules]]", ...]
```

---

## Typed relations (graph edges)

In addition to inline `[[wikilinks]]`, the brain traverses these typed frontmatter edges:

| Relation field | From → To | Kind |
|---|---|---|
| `section_ref` | page → section | parent |
| `prev_page` / `next_page` | page → page | sequence |
| `related_key` | keyword → key | cross-ref |
| `related_keyword` | key → keyword | cross-ref |

---

## Connector access

The vault is a **public GitHub repository**: `https://github.com/thisis-romar/grandma2-manual-vault`

It is also available as a **git submodule** of this repo at `vendor/grandma2-manual-vault`,
so agents running in this repo's environment can access all note files locally without
any GitHub API calls:

```bash
git submodule update --init vendor/grandma2-manual-vault
# Then rg, cat, or read files directly from vendor/grandma2-manual-vault/
```

Browsable with resolved links on the `github-browse` branch (wikilinks converted to Markdown links).
