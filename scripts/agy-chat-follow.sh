#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

project="${FLEETSCOPE_ANTIGRAVITY_PROJECT:-examples/antigravity-project}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --) shift ;;
    --project)
      project="$2"
      shift 2
      ;;
    -h|--help)
      cat <<'EOF'
Usage: agy-chat-follow.sh [--project <dir>]

THIS is the chat terminal. Type messages here (not in the Antigravity IDE REPL).
Each line is one live agy turn, written to session.jsonl for Agent Viewer.

  1. Leave this script running.
  2. Open http://127.0.0.1:4321/viewer  (auto-follow, or Follow folder → session_dir)
  3. Type a prompt after you>  and wait for agy> 
  4. /quit when done

Requires: agy on PATH, Antigravity logged in, pnpm dev:web on :4321.
EOF
      exit 0
      ;;
    *)
      echo "unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

exec python3 scripts/agy-chat-follow.py --project "$project"
