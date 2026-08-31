#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# pnpm demo:antigravity -- [--project <dir>] [--no-tui]
# Env FLEETSCOPE_ANTIGRAVITY_PROJECT still wins if already set before flags.
no_tui=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --)
      # pnpm/npm often forward a literal "--" before script args.
      shift
      ;;
    --project)
      [[ $# -ge 2 ]] || { echo "usage: $0 [--project <dir>] [--no-tui]" >&2; exit 2; }
      export FLEETSCOPE_ANTIGRAVITY_PROJECT="$2"
      shift 2
      ;;
    --no-tui)
      no_tui=1
      shift
      ;;
    -h|--help)
      cat <<'EOF'
Usage: demo-antigravity.sh [--project <dir>] [--no-tui]

Runs real Antigravity (agy) workers against a project folder that contains
brief.md, writes JSONL under .fleetscope/sessions/.

  --project <dir>   Project cwd for agy (default: examples/antigravity-project
                    or $FLEETSCOPE_ANTIGRAVITY_PROJECT)
  --no-tui          Do not open the terminal TUI (recommended when the TUI
                    panics / you only want the browser). Still prints session_dir.

Browser: open /viewer → Follow folder… → pick the printed session_dir
(not the project dir, not session.jsonl).

If the TUI panics with crossterm IoError, re-run with --no-tui and Follow
folder in the browser — the session JSONL is what matters.
EOF
      exit 0
      ;;
    *)
      echo "unknown argument: $1 (try --help)" >&2
      exit 2
      ;;
  esac
done

project_path="${FLEETSCOPE_ANTIGRAVITY_PROJECT:-examples/antigravity-project}"
if [[ ! -d "$project_path" ]]; then
  echo "ERROR: project directory does not exist: $project_path" >&2
  echo "Create it with a brief.md, or pass --project /absolute/path/to/app" >&2
  exit 2
fi
project_path="$(cd "$project_path" && pwd)"
if [[ ! -f "$project_path/brief.md" ]]; then
  echo "ERROR: project needs brief.md (agents read it): $project_path/brief.md" >&2
  exit 2
fi

session_root=".fleetscope/sessions"
mkdir -p "$session_root"
if [[ -n "${FLEETSCOPE_ANTIGRAVITY_SESSION_DIR:-}" ]]; then
  session_dir="$FLEETSCOPE_ANTIGRAVITY_SESSION_DIR"
  case "$session_dir" in
    "$session_root"/*) ;;
    *) echo "session directory must be under $session_root" >&2; exit 2 ;;
  esac
  [[ "$session_dir" != *".."* ]] || { echo "session directory cannot contain .." >&2; exit 2; }
  mkdir -p "$session_dir"
else
  session_dir="$(mktemp -d "$session_root/antigravity-live.XXXXXX")"
fi
session_dir="$(cd "$session_dir" && pwd)"

viewer_url="${FLEETSCOPE_VIEWER_URL:-http://127.0.0.1:4321/viewer/}"

python3 scripts/run-antigravity-demo.py \
  --project "$project_path" \
  --session-dir "$session_dir" \
  >"$session_dir/producer.log" 2>&1 &
producer_pid=$!

# Only kill the producer on interrupt — not when the TUI panics/exits.
cleanup() {
  local code=$?
  if kill -0 "$producer_pid" 2>/dev/null; then
    kill "$producer_pid" 2>/dev/null || true
    wait "$producer_pid" 2>/dev/null || true
  fi
  exit "$code"
}
trap cleanup INT TERM

until [[ -f "$session_dir/session.jsonl" ]]; do
  if ! kill -0 "$producer_pid" 2>/dev/null; then
    echo "ERROR: producer exited before writing session.jsonl" >&2
    echo "---- producer.log ----" >&2
    tail -40 "$session_dir/producer.log" >&2 || true
    exit 1
  fi
  sleep 0.1
done

echo "project=$project_path"
echo "session_dir=$session_dir"
echo "viewer=$viewer_url"
echo "browser=Follow folder… → pick session_dir (NOT the project, NOT session.jsonl)"

if [[ "$(uname -s)" == Darwin ]]; then
  open "$viewer_url" >/dev/null 2>&1 || true
else
  xdg-open "$viewer_url" >/dev/null 2>&1 || true
fi

if [[ "$no_tui" -eq 1 ]]; then
  echo "tui=skipped (--no-tui)"
  echo "Next: in /viewer click Follow folder… and select:"
  echo "  $session_dir"
  wait "$producer_pid"
  echo "producer=done"
  exit 0
fi

echo "tui=follow (--tiny; set FLEETSCOPE_ENLARGE=1 to force terminal resize)"
# Default --tiny: avoids a class of crossterm panics on odd sizes.
# Optional enlarge used to run here and often broke event reading (IoError).
if [[ "${FLEETSCOPE_ENLARGE:-}" == "1" ]] && [[ -t 1 ]]; then
  printf '\e[8;48;160t' >/dev/tty 2>/dev/null || true
fi

set +e
cargo run -p fleetscope-cli --bin fleetscope -- "$session_dir" --follow --tiny
tui_status=$?
set -e

if [[ "$tui_status" -ne 0 ]]; then
  echo ""
  echo "TUI exited with status $tui_status (often crossterm IoError on this terminal)."
  echo "Your session is still here — use the browser instead:"
  echo "  1. Open $viewer_url"
  echo "  2. Follow folder…"
  echo "  3. Pick: $session_dir"
  echo "Or re-run: pnpm demo:antigravity -- --no-tui --project $(printf %q "$project_path")"
fi

# Let the producer finish even if the TUI died.
wait "$producer_pid" || true
echo "producer=done session_dir=$session_dir"
