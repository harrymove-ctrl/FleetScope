#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
session_root=".fleetscope/sessions"
mkdir -p "$session_root"
if [[ -n "${FLEETSCOPE_ANTIGRAVITY_SESSION_DIR:-}" ]]; then
  session_dir="$FLEETSCOPE_ANTIGRAVITY_SESSION_DIR"
  case "$session_dir" in
    "$session_root"/*) ;;
    *) echo "session directory must be under $session_root" >&2; exit 2 ;;
  esac
  [[ "$session_dir" != *".."* ]] || { echo "session directory cannot contain .." >&2; exit 2; }
  mkdir "$session_dir"
else
  session_dir="$(mktemp -d "$session_root/antigravity-live.XXXXXX")"
fi
session_dir="$(cd "$session_dir" && pwd)"

viewer_url="${FLEETSCOPE_VIEWER_URL:-http://localhost:4321/viewer/}"

enlarge_terminal() {
  if [[ ! -t 1 ]]; then
    return 0
  fi
  # xterm CSI: resize the current window to at least 160×48.
  printf '\e[8;48;160t' >/dev/tty 2>/dev/null || true
  if [[ "$(uname -s)" != Darwin ]]; then
    return 0
  fi
  osascript >/dev/null 2>&1 <<'APPLESCRIPT' || true
tell application "System Events"
  set frontApp to name of first application process whose frontmost is true
end tell
try
  if frontApp is "Terminal" then
    tell application "Terminal"
      set number of rows of front window to 48
      set number of columns of front window to 160
    end tell
  else if frontApp is "iTerm2" or frontApp is "iTerm" then
    tell application "iTerm"
      tell current session of current window
        set rows to 48
        set columns to 160
      end tell
    end tell
  end if
end try
APPLESCRIPT
}

python3 scripts/run-antigravity-demo.py \
  --project "${FLEETSCOPE_ANTIGRAVITY_PROJECT:-examples/antigravity-project}" \
  --session-dir "$session_dir" \
  >"$session_dir/producer.log" 2>&1 &
producer_pid=$!
trap 'kill "$producer_pid" 2>/dev/null || true' EXIT

until [[ -f "$session_dir/session.jsonl" ]]; do
  sleep 0.1
done

enlarge_terminal

echo "session_dir=$session_dir"
echo "tui=follow"
echo "browser=Follow folder…  (pick the session directory, not session.jsonl)"
echo "viewer=$viewer_url"

if [[ "$(uname -s)" == Darwin ]]; then
  open "$viewer_url" >/dev/null 2>&1 || true
else
  xdg-open "$viewer_url" >/dev/null 2>&1 || true
fi

tiny_args=()
if [[ "${FLEETSCOPE_TINY:-}" == "1" ]]; then
  tiny_args+=(--tiny)
fi

cargo run -p fleetscope-cli --bin fleetscope -- "$session_dir" --follow "${tiny_args[@]}"
wait "$producer_pid"
