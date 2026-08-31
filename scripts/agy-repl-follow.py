#!/usr/bin/env python3
"""Tail Antigravity CLI transcript.jsonl → FleetScope session.jsonl.

You chat in the real `agy --dangerously-skip-permissions` REPL. This process
only watches ~/.gemini/antigravity-cli and writes ADK-shaped JSONL for Viewer.
"""

from __future__ import annotations

import argparse
import json
import re
import time
import uuid
from pathlib import Path

HOME = Path.home()
AGY_ROOT = HOME / ".gemini/antigravity-cli"
LAST_CONV = AGY_ROOT / "cache/last_conversations.json"
BRAIN = AGY_ROOT / "brain"

USER_REQUEST = re.compile(r"<USER_REQUEST>\s*(.*?)\s*</USER_REQUEST>", re.S)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--project", type=Path, required=True)
    p.add_argument("--session-dir", type=Path, required=True)
    p.add_argument("--poll", type=float, default=0.4)
    return p.parse_args()


def conversation_id_for(project: Path) -> str | None:
    if not LAST_CONV.exists():
        return None
    try:
        mapping = json.loads(LAST_CONV.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(mapping, dict):
        return None
    key = str(project.resolve())
    cid = mapping.get(key)
    return str(cid) if cid else None


def transcript_path(cid: str) -> Path:
    return BRAIN / cid / ".system_generated" / "logs" / "transcript.jsonl"


def user_text(content: str) -> str:
    match = USER_REQUEST.search(content or "")
    raw = match.group(1).strip() if match else (content or "").strip()
    # Drop system-injected brief dumps after the first short user line when huge.
    if "\nProject brief:" in raw:
        raw = raw.split("\nProject brief:", 1)[0].strip()
    return raw[:4000]


def adk_event(
    counter: int,
    invocation: str,
    author: str,
    *,
    text: str | None = None,
    tool: str | None = None,
    terminal: bool = False,
) -> dict:
    event: dict = {
        "id": f"ag-{counter:04d}",
        "invocationId": invocation,
        "author": author,
        "branch": "chat",
        "timestamp": time.time(),
        "customMetadata": {
            "fleetscope": {
                "framework": "antigravity-cli-repl",
                "frameworkVersion": "1",
                "producer": "agy-repl-follow",
            }
        },
    }
    if text:
        role = "user" if author == "user" else "model"
        event["content"] = {"role": role, "parts": [{"text": text}]}
    if tool:
        event["actions"] = {"tool": tool}
    if terminal:
        event["turnComplete"] = True
    return event


def convert_line(obj: dict, counter: int, invocation: str) -> dict | None:
    kind = obj.get("type")
    if kind == "USER_INPUT":
        text = user_text(str(obj.get("content") or ""))
        if not text:
            return None
        return adk_event(counter, invocation, "user", text=text)
    if kind == "PLANNER_RESPONSE":
        calls = obj.get("tool_calls")
        if isinstance(calls, list) and calls:
            names = []
            for call in calls:
                if isinstance(call, dict) and call.get("name"):
                    names.append(str(call["name"]))
            if names:
                return adk_event(
                    counter,
                    invocation,
                    "chat",
                    tool=",".join(names[:8]),
                    text="called " + ", ".join(names[:8]),
                )
        thinking = obj.get("thinking") or obj.get("content")
        if isinstance(thinking, str) and thinking.strip():
            return adk_event(counter, invocation, "chat", text=thinking.strip()[:4000])
        return None
    if kind == "GENERIC":
        content = str(obj.get("content") or "").strip()
        if not content:
            return None
        return adk_event(counter, invocation, "chat", text=content[:4000])
    return None


def main() -> int:
    args = parse_args()
    project = args.project.expanduser().resolve()
    session_dir = args.session_dir.expanduser().resolve()
    session_dir.mkdir(parents=True, exist_ok=True)
    out = session_dir / "session.jsonl"
    out.touch()
    invocation = f"inv-repl-{uuid.uuid4().hex[:8]}"
    seen: set[tuple[int, str]] = set()
    counter = 0
    offset = 0
    last_cid: str | None = None
    print(f"follow_project={project}", flush=True)
    print(f"session_dir={session_dir}", flush=True)
    print("waiting for agy REPL to open a conversation in this folder…", flush=True)

    while True:
        cid = conversation_id_for(project)
        if cid and cid != last_cid:
            last_cid = cid
            offset = 0
            seen.clear()
            print(f"conversation={cid}", flush=True)
            print(f"transcript={transcript_path(cid)}", flush=True)
        if cid:
            path = transcript_path(cid)
            if path.is_file():
                data = path.read_bytes()
                if len(data) > offset:
                    chunk = data[offset:].decode("utf-8", errors="replace")
                    offset = len(data)
                    for line in chunk.splitlines():
                        line = line.strip()
                        if not line.startswith("{"):
                            continue
                        try:
                            obj = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        key = (int(obj.get("step_index") or 0), str(obj.get("type") or ""))
                        if key in seen:
                            continue
                        seen.add(key)
                        event = convert_line(obj, counter + 1, invocation)
                        if event is None:
                            continue
                        counter += 1
                        event["id"] = f"ag-{counter:04d}"
                        with out.open("a", encoding="utf-8") as handle:
                            handle.write(json.dumps(event, separators=(",", ":")) + "\n")
                            handle.flush()
        time.sleep(args.poll)


if __name__ == "__main__":
    raise SystemExit(main())
