#!/usr/bin/env bash
# Detect the active Claude model for commit attribution.
#
# Resolution order:
#   1. $CLAUDE_MODEL                      (explicit override)
#   2. git config user.ai-model          (manual pin via scripts/set-ai-model.sh)
#   3. Claude Code session transcript     (TRUE auto-detect — last model used)
#   4. (nothing — caller skips attribution)
#
# Prints a friendly model name (e.g. "Claude Opus 4.8") to stdout, or nothing.
# Pure stdlib (grep/sed); degrades silently outside a Claude Code session.

set -u

# Map a raw model id (claude-opus-4-8) to a friendly name (Claude Opus 4.8).
friendly() {
  raw="$1"
  case "$raw" in
    '') return 0 ;;
    claude-fable-*)  fam="Fable" ;;
    claude-opus-*)   fam="Opus" ;;
    claude-sonnet-*) fam="Sonnet" ;;
    claude-haiku-*)  fam="Haiku" ;;
    *) printf '%s\n' "Claude"; return 0 ;;  # unknown family
  esac
  # version = everything after the family token, dashes -> dots (4-8 -> 4.8)
  ver=$(printf '%s\n' "$raw" | sed -E 's/^claude-(fable|opus|sonnet|haiku)-?//; s/-/./g')
  if [ -n "$ver" ]; then
    printf '%s\n' "Claude $fam $ver"
  else
    printf '%s\n' "Claude $fam"
  fi
}

# 1) explicit env override
if [ -n "${CLAUDE_MODEL:-}" ]; then
  printf '%s\n' "$CLAUDE_MODEL"; exit 0
fi

# 2) manual git pin
pin=$(git config user.ai-model 2>/dev/null || true)
if [ -n "$pin" ]; then
  printf '%s\n' "$pin"; exit 0
fi

# 3) auto-detect from the live session transcript
sid="${CLAUDE_CODE_SESSION_ID:-}"
cfg="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
if [ -n "$sid" ] && [ -d "$cfg/projects" ]; then
  transcript=$(find "$cfg/projects" -name "$sid.jsonl" -type f 2>/dev/null | head -1)
  if [ -n "$transcript" ] && [ -f "$transcript" ]; then
    raw=$(grep -oE '"model":"[^"]*"' "$transcript" 2>/dev/null \
          | tail -1 | sed 's/.*:"//; s/"$//')
    case "$raw" in
      ''|'<synthetic>'|synthetic) ;;   # ignore empty/synthetic
      *) friendly "$raw"; exit 0 ;;
    esac
  fi
fi

# 4) nothing detected
exit 0
