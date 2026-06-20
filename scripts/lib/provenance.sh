# shellcheck shell=sh
# Resolve the AI authoring context (model + provenance) into shell variables.
# SOURCE this file (do not execute it); it sets:
#
#   PROV_MODEL       friendly model name, e.g. "Claude Opus 4.8" (raw id never emitted)
#   PROV_VERSION     Claude Code version, e.g. "2.1.185"
#   PROV_SESSION     session id
#   PROV_ENTRYPOINT  entrypoint, e.g. "remote"
#
# Each is empty when undetectable, so callers can skip the field. Degrades
# silently (pure grep/sed) outside a Claude Code session. Consumed by
# scripts/commit-trailers.sh (commit trailers) and scripts/pr-trailers.sh
# (PR body block) so both formatters stay in lockstep.

_PROV_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo .)

PROV_MODEL=$(sh "$_PROV_ROOT/scripts/detect-ai-model.sh" 2>/dev/null || true)

# Locate the live session transcript for fields not exposed as env vars.
_prov_sid="${CLAUDE_CODE_SESSION_ID:-}"
_prov_cfg="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
_prov_transcript=""
if [ -n "$_prov_sid" ] && [ -d "$_prov_cfg/projects" ]; then
  _prov_transcript=$(find "$_prov_cfg/projects" -name "$_prov_sid.jsonl" -type f 2>/dev/null | head -1)
fi
_prov_from_transcript() { # $1 = json string key -> last value seen
  [ -n "$_prov_transcript" ] || return 0
  grep -oE "\"$1\":\"[^\"]*\"" "$_prov_transcript" 2>/dev/null | tail -1 | sed 's/.*:"//; s/"$//'
}

# Version: prefer the transcript (actual authoring agent) over the env var.
PROV_VERSION="${CLAUDE_CODE_VERSION:-}"
_prov_tv=$(_prov_from_transcript version); [ -n "$_prov_tv" ] && PROV_VERSION="$_prov_tv"

# Entrypoint: env var first, transcript fallback.
PROV_ENTRYPOINT="${CLAUDE_CODE_ENTRYPOINT:-}"
[ -z "$PROV_ENTRYPOINT" ] && PROV_ENTRYPOINT=$(_prov_from_transcript entrypoint)

PROV_SESSION="${CLAUDE_CODE_SESSION_ID:-}"
