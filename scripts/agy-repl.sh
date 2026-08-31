#!/usr/bin/env bash
# Chat in the REAL Antigravity CLI. A sidecar tails transcript.jsonl into
# FleetScope session.jsonl so /viewer can follow while you type at the `>` prompt.
set -euo pipefail
cd "$(dirname "$0")/.."
repo="$(pwd)"

project="${PWD}"
agy_args=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --) shift ;;
    --project)
      project="$2"
      shift 2
      ;;
    -h|--help)
      cat <<'EOF'
Usage: pnpm demo:agy [-- --project <dir>] [-- extra agy flags]

Opens the real Antigravity CLI (agy --dangerously-skip-permissions) in <dir>.
Chat at the rainbow `>` prompt. A follower writes JSONL for Agent Viewer.

  Terminal:  this command (CHAT HERE)
  Browser:   http://127.0.0.1:4321/viewer  (auto-follow or Follow session_dir)
EOF
      exit 0
      ;;
    *)
      agy_args+=("$1")
      shift
      ;;
  esac
done

project="$(cd "$project" && pwd)"
session_dir="$(mktemp -d "$repo/.fleetscope/sessions/agy-repl.XXXXXX")"

echo "project=$project"
echo "session_dir=$session_dir"
echo "viewer=http://127.0.0.1:4321/viewer"
echo "Chat in THIS terminal (agy REPL). Viewer follows session_dir."
echo ""

python3 "$repo/scripts/agy-repl-follow.py" --project "$project" --session-dir "$session_dir" &
follow_pid=$!
cleanup() {
  kill "$follow_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

agy_bin="${FLEETSCOPE_AGY_BIN:-$(command -v agy || true)}"
if [[ -z "$agy_bin" ]]; then
  echo "ERROR: agy not on PATH" >&2
  exit 2
fi

cd "$project"
set +e
"$agy_bin" --dangerously-skip-permissions "${agy_args[@]}"
status=$?
set -e
cleanup
exit "$status"
