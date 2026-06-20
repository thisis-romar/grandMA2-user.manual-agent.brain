#!/usr/bin/env bash
# Pin the AI model used for commit attribution — an OPTIONAL OVERRIDE.
#
# By default attribution is AUTOMATIC: .husky/prepare-commit-msg calls
# scripts/detect-ai-model.sh, which reads the active model from the live
# Claude Code session transcript. You only need this script to force a
# specific label (overrides auto-detection) or in a non-Claude-Code shell.
#
# Usage:
#   ./scripts/set-ai-model.sh "Claude Sonnet 4.6"   # pin
#   ./scripts/set-ai-model.sh --auto                 # clear pin, use auto-detect
#   ./scripts/set-ai-model.sh                        # show current state
#
# After pinning, every commit gets:
#   Co-authored-by: <model> <noreply@anthropic.com>

set -euo pipefail

MODEL="${1:-}"

if [[ "$MODEL" == "--auto" ]]; then
  git config --unset user.ai-model 2>/dev/null || true
  detected=$(sh "$(git rev-parse --show-toplevel)/scripts/detect-ai-model.sh" 2>/dev/null || true)
  echo "Cleared pin. Auto-detect now resolves to: ${detected:-<none>}"
  exit 0
fi

if [[ -z "$MODEL" ]]; then
  pin=$(git config user.ai-model 2>/dev/null || echo "<not set>")
  detected=$(sh "$(git rev-parse --show-toplevel)/scripts/detect-ai-model.sh" 2>/dev/null || true)
  echo "Pinned (git config user.ai-model): $pin"
  echo "Auto-detect would resolve to:      ${detected:-<none>}"
  echo ""
  echo "Usage: $0 \"Claude Sonnet 4.6\"   (pin)"
  echo "       $0 --auto                   (clear pin, use auto-detect)"
  exit 0
fi

git config user.ai-model "$MODEL"
echo "Pinned user.ai-model = $MODEL (overrides auto-detection)"
echo "Next commit will include: Co-authored-by: $MODEL <noreply@anthropic.com>"
