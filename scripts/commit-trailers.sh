#!/usr/bin/env bash
# Emit git trailers describing the AI authoring context (model + provenance).
# Used by .husky/prepare-commit-msg. Prints only the lines it can detect:
#
#   Co-authored-by: Claude Opus 4.8 <noreply@anthropic.com>
#   Generated-with: Claude Code 2.1.183
#   Claude-Session: <session id>
#   Claude-Entrypoint: remote
#
# Friendly model name only; the raw model id is never emitted. Degrades silently
# (prints nothing for a field) outside a Claude Code session. Value resolution
# lives in scripts/lib/provenance.sh, shared with scripts/pr-trailers.sh.

set -u
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo .)

# shellcheck source=scripts/lib/provenance.sh
. "$ROOT/scripts/lib/provenance.sh"

[ -n "$PROV_MODEL" ]      && printf 'Co-authored-by: %s <noreply@anthropic.com>\n' "$PROV_MODEL"
[ -n "$PROV_VERSION" ]    && printf 'Generated-with: Claude Code %s\n' "$PROV_VERSION"
[ -n "$PROV_SESSION" ]    && printf 'Claude-Session: %s\n' "$PROV_SESSION"
[ -n "$PROV_ENTRYPOINT" ] && printf 'Claude-Entrypoint: %s\n' "$PROV_ENTRYPOINT"

exit 0
