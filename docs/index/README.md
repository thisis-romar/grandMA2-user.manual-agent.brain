# docs/index — optional grandMA2 reference artifacts

`commands-index.json` and `networking-index.json` are **hand-curated lookup tables** for the
grandMA2 vault (keyword/command and networking entries). They exist as a quick human/agent
reference and are linked from [`../vault-contract.md`](../vault-contract.md).

**The engine does not consume them.** vault-brain is vault-agnostic and builds its index at
runtime from the vault's notes + `.brain/manifest.yaml` (`npm run index <vault>` → the SQLite
FTS index under `<vault>/.brain/`). Nothing in `src/` reads these files; deleting them would
not affect retrieval. They are grandMA2-specific and intentionally kept out of the engine's
code path — treat them as documentation, not a data dependency.
