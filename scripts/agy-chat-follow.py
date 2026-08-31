#!/usr/bin/env python3
"""Interactive chat → JSONL so Agent Viewer can follow *while you type*.

This is NOT the Antigravity IDE/REPL. Type here. Each line is one `agy --print`
turn; stream-json is translated into ADK-shaped session.jsonl. Empty line or
/quit ends the chat. Viewer: Follow the printed session_dir (or auto-follow).
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path

# Reuse the batch demo's recorder + worker by loading the hyphenated module.
import importlib.util

_DEMO = Path(__file__).resolve().parent / "run-antigravity-demo.py"
_spec = importlib.util.spec_from_file_location("agy_demo", _DEMO)
if _spec is None or _spec.loader is None:
    raise SystemExit(f"ERROR: cannot load {_DEMO}")
_agy_demo = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_agy_demo)

Recorder = _agy_demo.Recorder
run_worker = _agy_demo.run_worker
agy_binary = _agy_demo.agy_binary
text_event = _agy_demo.text_event


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--project", type=Path, default=Path("examples/antigravity-project"))
    p.add_argument("--session-dir", type=Path, default=None)
    p.add_argument("--model", default="gemini-3.7-flash-low")
    p.add_argument("--timeout", default="180s")
    p.add_argument("--role", default="chat")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    project = args.project.expanduser().resolve()
    if not project.is_dir():
        raise SystemExit(f"ERROR: project does not exist: {project}")
    binary = agy_binary()
    repo = Path(__file__).resolve().parent.parent
    session_dir = (
        args.session_dir.expanduser().resolve()
        if args.session_dir
        else (repo / ".fleetscope/sessions" / f"agy-chat-{uuid.uuid4().hex[:6]}")
    )
    session_dir.mkdir(parents=True, exist_ok=True)
    jsonl = session_dir / "session.jsonl"
    recorder = Recorder(jsonl, args.model, f"inv-chat-{uuid.uuid4().hex[:8]}")
    reports = session_dir / "reports"
    brief = ""
    brief_path = project / "brief.md"
    if brief_path.is_file():
        brief = brief_path.read_text(encoding="utf-8")

    print(f"project={project}", flush=True)
    print(f"session_dir={session_dir}", flush=True)
    print(f"session_jsonl={jsonl}", flush=True)
    print("chat=ready  type a message and Enter. /quit to stop. Viewer Follow this session_dir.", flush=True)
    print(f"agy={binary}", flush=True)

    recorder.emit(
        "user",
        args.role,
        content={"role": "user", "parts": [{"text": f"Chat session on {project.name}. Type in this terminal."}]},
    )

    turn = 0
    while True:
        try:
            line = input("you> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("", flush=True)
            break
        if not line or line in {"/quit", "/exit", "/q"}:
            break
        turn += 1
        recorder.emit(
            "user",
            args.role,
            content={"role": "user", "parts": [{"text": line}]},
        )
        prompt = line if not brief else f"{line}\n\nProject brief:\n{brief}"
        print("agy> (streaming… watch /viewer)", flush=True)
        reply = run_worker(
            recorder,
            args.role,
            brief or line,
            prompt,
            project,
            args.model,
            args.timeout,
            reports,
            binary,
        )
        preview = (reply or "").strip().replace("\n", " ")[:240]
        print(f"agy> {preview}", flush=True)

    recorder.emit(
        args.role,
        args.role,
        content=text_event(f"Chat ended after {turn} turn(s)."),
        terminal=True,
    )
    print(f"chat=done turns={turn} session_dir={session_dir}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
