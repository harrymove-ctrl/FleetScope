#!/usr/bin/env bash
# Run the real Google ADK multi-agent producer for FleetScope.
#
# Safe default: without --run this validates the closed case and prints its
# exact plan. A metered run still requires FLEETSCOPE_ALLOW_MODEL_CALLS=true and
# GOOGLE_GENAI_USE_VERTEXAI=true inside the Python boundary.
set -euo pipefail
cd "$(dirname "$0")/.."

python_bin="apps/adk-worker/.venv/bin/python"
if [[ ! -x "$python_bin" ]]; then
  echo "ERROR: the ADK worker virtualenv is missing." >&2
  echo "Create it with the commands in apps/adk-worker/README.md." >&2
  exit 127
fi

# pnpm 11 forwards the conventional separator itself (`pnpm <script> -- ...`).
# argparse should receive only the arguments after that sentinel.
if [[ "${1:-}" == "--" ]]; then
  shift
fi

PYTHONPATH="apps/adk-worker/src${PYTHONPATH:+:$PYTHONPATH}" \
  "$python_bin" -m fleetscope_worker.google_session "$@"
