# Antigravity → Agent Viewer (no Open folder finale)

**Status:** active  
**Last updated:** 2026-08-31

## Setup

```
agy (your auth, producer)  →  .fleetscope/sessions/<id>/session.jsonl
                                       ↓  GET 127.0.0.1 only
                            Agent Viewer on :4321 auto-follows the newest folder
```

Open folder / Follow folder is an operator fallback, not the demo beat.

## Why a bare cargo line fails

`cargo run -p fleetscope-cli …` only works inside the **FleetScope** workspace. Pasting it in `~/Documents/dev/zoetrope` errors: package not found. Copy commands must start with:

```bash
cd /Users/harryphan/Documents/dev/FleetScope &&
```

There is no global `fleetscope` binary.

## Why interactive `agy` chat does not appear

Antigravity’s private conversation store is not a FleetScope adapter. Viewer only reads ADK-shaped JSONL. The bridge (`pnpm demo:antigravity` / `scripts/run-antigravity-demo.py`) translates `agy --print --output-format stream-json` into that JSONL. A raw `agy` REPL with no bridge stays invisible here.

## Commands

Watch the recorded Antigravity session (no new workers):

```bash
cd /Users/harryphan/Documents/dev/FleetScope && cargo run -p fleetscope-cli --bin fleetscope -- .fleetscope/sessions/antigravity-live-cu --follow --tiny
```

Then open `http://127.0.0.1:4321/viewer`. The page attaches to `.fleetscope/sessions` over loopback. Do not pick a folder in Downloads.

Live producer (quota / 5 workers — only if you choose to spend):

```bash
cd /Users/harryphan/Documents/dev/FleetScope && pnpm demo:antigravity
```

Viewer picks up the new folder under `.fleetscope/sessions/` without Open folder.

Example-only Gemini JSONL (not Antigravity):

```bash
cd /Users/harryphan/Documents/dev/FleetScope && cargo run -p fleetscope-cli --bin fleetscope -- examples/gemini-session --follow --tiny
```

## Browser

`/viewer` on 127.0.0.1:

1. Loads WASM.
2. `GET /local-sessions.json` (loopback).
3. If a local `session.jsonl` exists, loads the newest. Polls for growth.
4. If none, falls back to bundled launch-readiness.

Follow folder remains available. It is not the intended close of the demo.

## Demo operator (copy and talk)

Dashboard is the talk track. Checklist is auto-approved from recorded evidence. Do not edit the plan. Do not Open folder. Copy gcloud / Copy Antigravity / Open viewer. **Open judge Cloud Console** (`/console`) is the interactive Google Cloud surface for people who cannot log into the project. The `console.cloud.google.com` links are operator-only.
