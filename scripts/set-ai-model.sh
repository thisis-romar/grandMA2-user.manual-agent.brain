#!/usr/bin/env bash
# Set the AI model identifier used by .husky/prepare-commit-msg
# for Co-Authored-By attribution in commits.
#
# Usage:
#   ./scripts/set-ai-model.sh "Claude Sonnet 4.6"
#   ./scripts/set-ai-model.sh "Claude Opus 4"
#
# After running, every commit in this repo gets:
#   Co-Authored-By: <model> <noreply@anthropic.com>
#
# The hook also reads the CLAUDE_MODEL env var if you prefer that over git config.
# Run this again whenever you switch models in Claude Code (/model command).

set -euo pipefail

MODEL="${1:-}"

if [[ -z "$MODEL" ]]; then
  current=$(git config user.ai-model 2>/dev/null || echo "<not set>")
  echo "Current model: $current"
  echo ""
  echo "Usage: $0 \"Claude Sonnet 4.6\""
  echo "       $0 \"Claude Opus 4\""
  exit 0
fi

git config user.ai-model "$MODEL"
echo "Set user.ai-model = $MODEL (local git config)"
echo "Next commit will include: Co-Authored-By: $MODEL <noreply@anthropic.com>"
