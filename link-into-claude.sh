#!/usr/bin/env bash
#
# link-into-claude.sh — register this repo's agent and skills with Claude Code.
#
# The real agent/skill content lives in this repo (agents/, skills/). Claude Code
# discovers agents and skills from ~/.claude/, so this script creates symlinks
# there that point back into the repo. Run it once after cloning.
#
# Usage:
#   ./link-into-claude.sh           # create/update the symlinks
#   ./link-into-claude.sh --check   # report status only, make no changes
#   ./link-into-claude.sh --unlink  # remove the symlinks (only if they point here)
#
# Idempotent: re-running is safe. Refuses to clobber a real file/dir that isn't
# already a symlink into this repo (so you don't lose unrelated local content).

set -euo pipefail

# Repo root = directory this script lives in (resolve symlinks to the script itself).
REPO="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
CLAUDE_DIR="${CLAUDE_HOME:-$HOME/.claude}"

# link map: "<source in repo>::<destination under ~/.claude>"
LINKS=(
  "agents/carbon-design-engineer.md::agents/carbon-design-engineer.md"
  "skills/carbon-design-system::skills/carbon-design-system"
  "skills/multi-agent-audit::skills/multi-agent-audit"
)

MODE="link"
case "${1:-}" in
  --check)  MODE="check" ;;
  --unlink) MODE="unlink" ;;
  "" )      MODE="link" ;;
  *) echo "unknown option: $1" >&2; echo "usage: $0 [--check|--unlink]" >&2; exit 2 ;;
esac

fail=0

for pair in "${LINKS[@]}"; do
  src="$REPO/${pair%%::*}"
  dst="$CLAUDE_DIR/${pair##*::}"

  if [[ ! -e "$src" ]]; then
    echo "MISSING SOURCE  $src" >&2
    fail=1
    continue
  fi

  # What is currently at the destination?
  current=""
  [[ -L "$dst" ]] && current="$(readlink -f "$dst" || true)"
  points_here="false"
  [[ "$current" == "$(readlink -f "$src")" ]] && points_here="true"

  case "$MODE" in
    check)
      if [[ "$points_here" == "true" ]]; then
        echo "OK       $dst -> $src"
      elif [[ -L "$dst" ]]; then
        echo "STALE    $dst -> $(readlink "$dst")"
        fail=1
      elif [[ -e "$dst" ]]; then
        echo "CONFLICT $dst (real file/dir, not a link to this repo)"
        fail=1
      else
        echo "MISSING  $dst (run without --check to create)"
        fail=1
      fi
      ;;

    unlink)
      if [[ "$points_here" == "true" ]]; then
        rm "$dst"; echo "removed  $dst"
      elif [[ -L "$dst" ]]; then
        echo "skip     $dst (symlink does not point into this repo)"
      elif [[ -e "$dst" ]]; then
        echo "skip     $dst (real file/dir, left untouched)"
      else
        echo "absent   $dst"
      fi
      ;;

    link)
      if [[ "$points_here" == "true" ]]; then
        echo "ok       $dst"
        continue
      fi
      if [[ -e "$dst" && ! -L "$dst" ]]; then
        echo "REFUSING $dst (real file/dir exists — move or remove it first)" >&2
        fail=1
        continue
      fi
      mkdir -p "$(dirname "$dst")"
      ln -sfn "$src" "$dst"
      echo "linked   $dst -> $src"
      ;;
  esac
done

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi
echo "done."
