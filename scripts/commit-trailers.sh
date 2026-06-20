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
# (prints nothing for a field) outside a Claude Code session.

set -u
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo .)

model=$(sh "$ROOT/scripts/detect-ai-model.sh" 2>/dev/null || true)

# Locate the live session transcript for fields not exposed as env vars.
sid="${CLAUDE_CODE_SESSION_ID:-}"
cfg="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
transcript=""
if [ -n "$sid" ] && [ -d "$cfg/projects" ]; then
  transcript=$(find "$cfg/projects" -name "$sid.jsonl" -type f 2>/dev/null | head -1)
fi
from_transcript() { # $1 = json string key -> last value seen
  [ -n "$transcript" ] || return 0
  grep -oE "\"$1\":\"[^\"]*\"" "$transcript" 2>/dev/null | tail -1 | sed 's/.*:"//; s/"$//'
}

# Version: prefer the transcript (actual authoring agent) over the env var.
version="${CLAUDE_CODE_VERSION:-}"
tv=$(from_transcript version); [ -n "$tv" ] && version="$tv"

# Entrypoint: env var first, transcript fallback.
entrypoint="${CLAUDE_CODE_ENTRYPOINT:-}"
[ -z "$entrypoint" ] && entrypoint=$(from_transcript entrypoint)

session="${CLAUDE_CODE_SESSION_ID:-}"

[ -n "$model" ]      && printf 'Co-authored-by: %s <noreply@anthropic.com>\n' "$model"
[ -n "$version" ]    && printf 'Generated-with: Claude Code %s\n' "$version"
[ -n "$session" ]    && printf 'Claude-Session: %s\n' "$session"
[ -n "$entrypoint" ] && printf 'Claude-Entrypoint: %s\n' "$entrypoint"

exit 0
