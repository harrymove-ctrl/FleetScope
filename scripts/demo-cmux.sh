#!/usr/bin/env bash
# Open the three surfaces used in the FleetScope demo:
#   1. Antigravity CLI (Gemini plan-mode producer/orchestrator)
#   2. FleetScope native TUI following the checked-in JSONL
#   3. The browser Agent Viewer showing the same recording
#
# This script only creates a new cmux workspace and starts local processes. It
# never uploads a transcript, changes cloud state, or enables model calls in
# the ADK producer. A real Vertex take remains an explicit `--run` action.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VIEWER_URL="${FLEETSCOPE_VIEWER_URL:-http://localhost:59541/viewer}"
AGY_MODEL="${FLEETSCOPE_AGY_MODEL:-gemini-3.7-flash-low}"
WORKSPACE_NAME="${FLEETSCOPE_CMUX_WORKSPACE:-FleetScope · Watch agents work}"

if ! command -v cmux >/dev/null 2>&1; then
  echo "demo: cmux CLI is not installed" >&2
  exit 127
fi

if ! cmux ping >/dev/null 2>&1; then
  echo "demo: cmux is not reachable (start cmux, then rerun this command)" >&2
  exit 1
fi

cmux new-workspace \
  --name "$WORKSPACE_NAME" \
  --cwd "$ROOT" \
  --command "agy --model '$AGY_MODEL' --mode plan --prompt-interactive 'Decompose this FleetScope demo into specialist tasks. Keep the work read-only and narrate the agent plan.'"

WORKSPACE_REF="$(cmux current-workspace | tail -n 1 | tr -d '\r')"
if [[ -z "$WORKSPACE_REF" ]]; then
  echo "demo: cmux created the workspace but did not return a workspace ref" >&2
  exit 1
fi

# cmux focuses each new pane, so the following sends land in the pane just
# created. The commands intentionally use the bundled offline recording; this
# makes the demo repeatable and cost-free while still exercising the real TUI.
cmux new-pane --direction right --workspace "$WORKSPACE_REF"
cmux send --workspace "$WORKSPACE_REF" \
  "cd '$ROOT' && cargo run -p fleetscope-cli --bin fleetscope -- examples/gemini-session --follow"

cmux new-pane --type browser --direction down --workspace "$WORKSPACE_REF" --url "$VIEWER_URL"

echo "FleetScope demo workspace ready: $WORKSPACE_NAME"
echo "  Antigravity model: $AGY_MODEL"
echo "  TUI + browser recording: examples/gemini-session"
echo "  Viewer: $VIEWER_URL"
