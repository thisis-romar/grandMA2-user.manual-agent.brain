#!/usr/bin/env bash
# Emit a Markdown provenance block for a PR body — the SAME model + provenance
# fields as the commit trailers (scripts/commit-trailers.sh), wrapped in a
# collapsed <details>. Append the output to the end of a PR description so PRs
# carry the same authoring detail as commits.
#
# Renders as:
#
#   <details>
#   <summary>Provenance</summary>
#
#   ```
#   Co-authored-by: Claude Opus 4.8 <noreply@anthropic.com>
#   Generated-with: Claude Code 2.1.185
#   Claude-Session: <session id>
#   Claude-Entrypoint: remote
#   ```
#
#   </details>
#
# The fields go inside a fenced code block because GitHub Markdown collapses
# single newlines — the fence keeps them on separate lines, verbatim like a
# commit. Friendly model name only; raw model id is never emitted. Prints
# nothing (exit 0) when no fields are detectable, mirroring commit-trailers.sh.

set -u
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo .)

# shellcheck source=scripts/lib/provenance.sh
. "$ROOT/scripts/lib/provenance.sh"

# Nothing detected (outside a Claude Code session) -> emit nothing.
[ -n "$PROV_MODEL$PROV_VERSION$PROV_SESSION$PROV_ENTRYPOINT" ] || exit 0

fence='```'
printf '<details>\n<summary>Provenance</summary>\n\n%s\n' "$fence"
[ -n "$PROV_MODEL" ]      && printf 'Co-authored-by: %s <noreply@anthropic.com>\n' "$PROV_MODEL"
[ -n "$PROV_VERSION" ]    && printf 'Generated-with: Claude Code %s\n' "$PROV_VERSION"
[ -n "$PROV_SESSION" ]    && printf 'Claude-Session: %s\n' "$PROV_SESSION"
[ -n "$PROV_ENTRYPOINT" ] && printf 'Claude-Entrypoint: %s\n' "$PROV_ENTRYPOINT"
printf '%s\n\n</details>\n' "$fence"

exit 0
