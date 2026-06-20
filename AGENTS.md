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
