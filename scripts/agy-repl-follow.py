#!/usr/bin/env python3
"""Tail Antigravity CLI transcript.jsonl → FleetScope session.jsonl.

You chat in the real `agy --dangerously-skip-permissions` REPL. This process
only watches ~/.gemini/antigravity-cli and writes ADK-shaped JSONL for Viewer.

`define_subagent` / `invoke_subagent` / `manage_subagents` become named ADK
authors (`researcher`, `ux_designer`, …) with `transferToAgent`. Child brain
transcripts are followed even when conversation_metadata omits them.
"""

from __future__ import annotations

import argparse
import json
import re
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

HOME = Path.home()
AGY_ROOT = HOME / ".gemini/antigravity-cli"
LAST_CONV = AGY_ROOT / "cache/last_conversations.json"
CONV_META = AGY_ROOT / "cache/conversation_metadata.json"
BRAIN = AGY_ROOT / "brain"

USER_REQUEST = re.compile(r"<USER_REQUEST>\s*(.*?)\s*</USER_REQUEST>", re.S)
UUID_RE = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
    re.I,
)
SHORT_SPAWN = re.compile(
    r"\*\*`?([A-Za-z][A-Za-z0-9_]*)`?\*\*\s*\(ID:\s*`([0-9a-f]{8,})`",
    re.I,
)
SUBAGENT_LIST = re.compile(
    r"You have \d+ active subagent\(s\):\s*(\[[\s\S]*\])\s*$",
    re.I,
)
TYPE_NAME = re.compile(r'"TypeName"\s*:\s*"([A-Za-z][A-Za-z0-9_]*)"')
ROLE_FIELD = re.compile(r'"Role"\s*:\s*"((?:\\.|[^"\\])*)"')
LABEL_UUID = re.compile(
    r"(?P<label>researcher|ux_designer|qa_planner|cloud_architect|"
    r"User Researcher|UX Designer|QA Planner|Cloud Architect|Researcher)"
    r"[^()\n]{0,96}\((?P<cid>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)",
    re.I,
)
BRAIN_URI = re.compile(
    r"file://[^\s\"']+/brain/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/",
    re.I,
)

PARENT_AUTHOR = "chat"
PARENT_BRANCH = "chat"
GENERIC_TYPES = {"research", "self", "flutter_a11y_agent", "agent", ""}
ROLE_ALIASES = {
    "user_researcher": "researcher",
    "user_systems_researcher": "researcher",
    "ux_designer": "ux_designer",
    "ux_interaction_designer": "ux_designer",
    "qa_planner": "qa_planner",
    "qa_verification_planner": "qa_planner",
    "gcp_cloud_architect": "cloud_architect",
    "cloud_architect": "cloud_architect",
    "researcher": "researcher",
}
_SCAN_CACHE: dict[str, tuple[float, bool]] = {}


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--project", type=Path, required=True)
    p.add_argument("--session-dir", type=Path, required=True)
    p.add_argument("--poll", type=float, default=0.4)
    return p.parse_args()


def conversations_for_project(project: Path) -> set[str]:
    """Every Antigravity conversation tied to this cwd (main REPL)."""
    found: set[str] = set()
    key = str(project.resolve())
    key_uri = f"file://{key}"
    if LAST_CONV.exists():
        try:
            mapping = json.loads(LAST_CONV.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            mapping = {}
        if isinstance(mapping, dict):
            cid = mapping.get(key)
            if cid:
                found.add(str(cid))
    if CONV_META.exists():
        try:
            meta = json.loads(CONV_META.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            meta = {}
        conversations = meta.get("conversations") if isinstance(meta, dict) else None
        if isinstance(conversations, dict):
            for cid, body in conversations.items():
                if not isinstance(body, dict):
                    continue
                summary = body.get("summary") if isinstance(body.get("summary"), dict) else {}
                uris = summary.get("WorkspaceURIs") if isinstance(summary, dict) else None
                if not isinstance(uris, list):
                    continue
                for uri in uris:
                    text = str(uri).rstrip("/")
                    if text == key_uri or text.endswith(key):
                        found.add(str(cid))
    found |= scan_orchestrators(project)
    ranked: list[tuple[float, str]] = []
    for cid in found:
        path = transcript_path(cid)
        try:
            ranked.append((path.stat().st_mtime, cid))
        except OSError:
            continue
    ranked.sort(reverse=True)
    keep = {cid for _, cid in ranked[:2]}
    return keep if keep else found


def transcript_path(cid: str) -> Path:
    return BRAIN / cid / ".system_generated" / "logs" / "transcript.jsonl"


def scan_orchestrators(project: Path, max_age_s: float = 8 * 3600) -> set[str]:
    """Find recent parent transcripts that mention this project and spawn tools.

    last_conversations.json often lags a new `agy` thread, so the sidecar
    would follow an old parent while the CLI already has four live children.
    """
    found: set[str] = set()
    if not BRAIN.is_dir():
        return found
    needle = str(project.resolve()).encode()
    now = time.time()
    markers = (b"invoke_subagent", b"define_subagent", b"manage_subagents")
    try:
        entries = list(BRAIN.iterdir())
    except OSError:
        return found
    for folder in entries:
        if not folder.is_dir():
            continue
        path = transcript_path(folder.name)
        try:
            stat = path.stat()
        except OSError:
            continue
        if now - stat.st_mtime > max_age_s:
            continue
        cached = _SCAN_CACHE.get(folder.name)
        if cached and cached[0] == stat.st_mtime:
            if cached[1]:
                found.add(folder.name)
            continue
        try:
            head = path.read_bytes()[:131072]
        except OSError:
            continue
        hit = needle in head and any(marker in head for marker in markers)
        _SCAN_CACHE[folder.name] = (stat.st_mtime, hit)
        if hit:
            found.add(folder.name)
    return found


def slug_label(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", unquote(value).lower()).strip("_")


def author_name(type_name: str, role_label: str, defined: list[str]) -> str:
    kind = unquote(type_name)
    label = unquote(role_label)
    if kind and kind.lower() not in GENERIC_TYPES:
        return kind
    blob = f"{label} {kind}".lower().replace("-", " ")
    for name in defined:
        token = name.lower().replace("_", " ")
        if token and token in blob:
            return name
    compact = slug_label(label)
    if compact in ROLE_ALIASES:
        return ROLE_ALIASES[compact]
    for key, mapped in ROLE_ALIASES.items():
        if key in compact:
            return mapped
    return compact or kind or "agent"


def user_text(content: str) -> str:
    match = USER_REQUEST.search(content or "")
    raw = match.group(1).strip() if match else (content or "").strip()
    if "\nProject brief:" in raw:
        raw = raw.split("\nProject brief:", 1)[0].strip()
    return raw[:4000]


def unquote(value: Any) -> str:
    text = str(value or "").strip()
    if len(text) >= 2 and text[0] == text[-1] and text[0] in {'"', "'"}:
        text = text[1:-1]
    return text.strip().strip("\\").strip('"').strip()


def event_time(obj: dict) -> float:
    raw = obj.get("created_at")
    if isinstance(raw, str) and raw.strip():
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00")).timestamp()
        except ValueError:
            pass
    return time.time()


def resolve_cid(token: str) -> str | None:
    token = unquote(token)
    if not token:
        return None
    if UUID_RE.fullmatch(token):
        return token
    if not BRAIN.is_dir() or len(token) < 8:
        return None
    matches = [path.name for path in BRAIN.iterdir() if path.is_dir() and path.name.startswith(token)]
    with_transcript = [cid for cid in matches if transcript_path(cid).is_file()]
    pool = with_transcript or matches
    if len(pool) == 1:
        return pool[0]
    return None


class FollowState:
    def __init__(self, invocation: str) -> None:
        self.invocation = invocation
        self.counter = 0
        self.role_by_cid: dict[str, str] = {}
        self.transferred: set[str] = set()
        self.extra_cids: set[str] = set()
        self.defined: list[str] = []

    def remember_defined(self, role: str) -> None:
        role = unquote(role)
        if role and role not in self.defined:
            self.defined.append(role)

    def register(self, role: str, cid: str | None = None, short: str | None = None) -> None:
        role = unquote(role)
        if not role or role.lower() in {"self", "user", "chat"}:
            return
        full = None
        if cid:
            full = resolve_cid(cid) or unquote(cid)
        elif short:
            full = resolve_cid(short)
        if not full:
            return
        previous = self.role_by_cid.get(full)
        if previous and previous != role:
            prev_generic = previous.lower() in GENERIC_TYPES
            new_generic = role.lower() in GENERIC_TYPES
            if not prev_generic and new_generic:
                return
            if not prev_generic and not new_generic:
                return
        self.role_by_cid[full] = role
        self.extra_cids.add(full)

    def next_id(self) -> str:
        self.counter += 1
        return f"ag-{self.counter:04d}"


def adk_event(
    state: FollowState,
    author: str,
    branch: str,
    *,
    timestamp: float,
    text: str | None = None,
    parts: list[dict] | None = None,
    actions: dict | None = None,
    role: str | None = None,
) -> dict:
    event: dict = {
        "id": state.next_id(),
        "invocationId": state.invocation,
        "author": author,
        "branch": branch,
        "timestamp": timestamp,
        "customMetadata": {
            "fleetscope": {
                "framework": "antigravity-cli-repl",
                "frameworkVersion": "1",
                "producer": "agy-repl-follow",
            }
        },
    }
    if parts:
        event["content"] = {"role": role or ("user" if author == "user" else "model"), "parts": parts}
    elif text:
        event["content"] = {
            "role": role or ("user" if author == "user" else "model"),
            "parts": [{"text": text}],
        }
    if actions:
        event["actions"] = actions
    return event


def fn_call(name: str, args: dict | None = None) -> dict:
    return {"functionCall": {"name": name, "args": args or {}}}


def compact_args(args: dict) -> dict:
    keep = {}
    for key in (
        "name",
        "Action",
        "action",
        "TargetFile",
        "target_file",
        "Path",
        "path",
        "DirectoryPath",
        "toolSummary",
        "toolAction",
    ):
        if key in args and args[key] not in (None, ""):
            keep[key] = unquote(args[key]) if isinstance(args[key], str) else args[key]
    return keep


def parse_invoke_roles(args: dict, defined: list[str]) -> list[str]:
    raw = args.get("Subagents")
    if raw is None:
        raw = args.get("subagents")
    names: list[str] = []
    data: Any = raw
    if isinstance(raw, str):
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            types = TYPE_NAME.findall(raw)
            roles = [unquote(item) for item in ROLE_FIELD.findall(raw)]
            if roles:
                for index, label in enumerate(roles):
                    kind = types[index] if index < len(types) else ""
                    names.append(author_name(kind, label, defined))
            else:
                names.extend(author_name(kind, "", defined) for kind in types)
            data = None
    if isinstance(data, list):
        for item in data:
            if not isinstance(item, dict):
                continue
            names.append(
                author_name(
                    str(item.get("TypeName") or item.get("type") or ""),
                    str(item.get("Role") or item.get("role") or ""),
                    defined,
                )
            )
    seen: set[str] = set()
    out: list[str] = []
    for name in names:
        if name and name not in seen:
            seen.add(name)
            out.append(name)
    return out


def parse_subagent_list(content: str) -> list[dict]:
    match = SUBAGENT_LIST.search(content or "")
    if not match:
        return []
    try:
        data = json.loads(match.group(1))
    except json.JSONDecodeError:
        return []
    if not isinstance(data, list):
        return []
    agents = []
    for item in data:
        if not isinstance(item, dict):
            continue
        kind = unquote(item.get("type") or item.get("TypeName") or "")
        cid = unquote(item.get("conversationId") or item.get("conversation_id") or "")
        label = unquote(item.get("role") or "")
        if cid:
            agents.append(
                {
                    "type": kind,
                    "conversationId": cid,
                    "state": unquote(item.get("state") or ""),
                    "role": label or kind,
                }
            )
    return agents


def harvest_ids(text: str, state: FollowState) -> None:
    if not text:
        return
    for role, short in SHORT_SPAWN.findall(text):
        state.register(author_name(role, role, state.defined), short=short)
    for match in LABEL_UUID.finditer(text):
        state.register(
            author_name(match.group("label"), match.group("label"), state.defined),
            cid=match.group("cid"),
        )
    for cid in UUID_RE.findall(text):
        if cid in state.role_by_cid:
            continue
        # URI in a list we already parsed is handled separately.
        pass
    for cid in BRAIN_URI.findall(text):
        if cid not in state.role_by_cid:
            state.extra_cids.add(cid)


def transfer_events(state: FollowState, roles: list[str], timestamp: float) -> list[dict]:
    events = []
    for role in roles:
        role = unquote(role)
        if not role or role in state.transferred:
            continue
        state.transferred.add(role)
        events.append(
            adk_event(
                state,
                PARENT_AUTHOR,
                PARENT_BRANCH,
                timestamp=timestamp,
                actions={"transferToAgent": role},
            )
        )
    return events


def identity_for(cid: str, state: FollowState, parent_cids: set[str]) -> tuple[str, str]:
    role = state.role_by_cid.get(cid)
    if role:
        return role, f"{PARENT_BRANCH}.{role}"
    return PARENT_AUTHOR, PARENT_BRANCH


def convert_line(
    obj: dict,
    cid: str,
    state: FollowState,
    parent_cids: set[str],
) -> list[dict]:
    kind = obj.get("type")
    ts = event_time(obj)
    author, branch = identity_for(cid, state, parent_cids)
    is_child = cid in state.role_by_cid
    events: list[dict] = []

    if kind == "USER_INPUT":
        if is_child:
            return []
        text = user_text(str(obj.get("content") or ""))
        if not text:
            return []
        return [
            adk_event(
                state,
                "user",
                PARENT_BRANCH,
                timestamp=ts,
                text=text,
            )
        ]

    if kind == "PLANNER_RESPONSE":
        calls = obj.get("tool_calls")
        parts: list[dict] = []
        if isinstance(calls, list):
            for call in calls:
                if not isinstance(call, dict) or not call.get("name"):
                    continue
                name = str(call["name"])
                args = call.get("args") if isinstance(call.get("args"), dict) else {}
                if name == "define_subagent":
                    role = unquote(args.get("name") or "")
                    if role:
                        state.remember_defined(role)
                    parts.append(fn_call(name, {"name": role} if role else compact_args(args)))
                elif name == "invoke_subagent":
                    roles = parse_invoke_roles(args, state.defined)
                    parts.append(fn_call(name, {"roles": roles} if roles else compact_args(args)))
                    events.extend(transfer_events(state, roles, ts))
                elif name == "manage_subagents":
                    parts.append(
                        fn_call(
                            name,
                            {"action": unquote(args.get("Action") or args.get("action") or "list")},
                        )
                    )
                else:
                    parts.append(fn_call(name, compact_args(args)))
        content = obj.get("content")
        if isinstance(content, str) and content.strip():
            harvest_ids(content, state)
            parts.append({"text": content.strip()[:4000]})
        if parts:
            events.append(
                adk_event(
                    state,
                    author,
                    branch,
                    timestamp=ts,
                    parts=parts,
                )
            )
        return events

    if kind == "GENERIC":
        content = str(obj.get("content") or "").strip()
        if not content:
            return []
        harvest_ids(content, state)
        listed = parse_subagent_list(content)
        if listed:
            roles = []
            bits = []
            for item in listed:
                role = author_name(item["type"], item["role"], state.defined)
                state.register(role, cid=item["conversationId"])
                roles.append(role)
                state_name = item["state"] or "active"
                bits.append(f"{role} {state_name}")
            events.extend(transfer_events(state, roles, ts))
            events.append(
                adk_event(
                    state,
                    PARENT_AUTHOR,
                    PARENT_BRANCH,
                    timestamp=ts,
                    text="subagents: " + ", ".join(bits),
                )
            )
            return events
        if content.startswith("Created At:"):
            return []
        return [
            adk_event(
                state,
                author,
                branch,
                timestamp=ts,
                text=content[:4000],
            )
        ]

    return []


def append_events(out: Path, events: list[dict]) -> None:
    if not events:
        return
    with out.open("a", encoding="utf-8") as handle:
        for event in events:
            handle.write(json.dumps(event, separators=(",", ":")) + "\n")
        handle.flush()


def main() -> int:
    args = parse_args()
    project = args.project.expanduser().resolve()
    session_dir = args.session_dir.expanduser().resolve()
    session_dir.mkdir(parents=True, exist_ok=True)
    out = session_dir / "session.jsonl"
    # Sidecar owns this file. Restart rebuilds from transcripts so names stay
    # consistent instead of appending a second copy of the same turn.
    out.write_text("", encoding="utf-8")
    state = FollowState(f"inv-repl-{uuid.uuid4().hex[:8]}")
    seen: set[tuple[str, int, str]] = set()
    offsets: dict[str, int] = {}
    known: set[str] = set()
    announced_roles: set[str] = set()
    print(f"follow_project={project}", flush=True)
    print(f"session_dir={session_dir}", flush=True)
    print("waiting for agy REPL (main + spawned sub-agent transcripts)…", flush=True)

    while True:
        parent_cids = conversations_for_project(project)
        progress = True
        while progress:
            progress = False
            wanted = set(parent_cids) | set(state.extra_cids) | set(state.role_by_cid)
            for cid in sorted(wanted - known):
                known.add(cid)
                offsets[cid] = 0
                role = state.role_by_cid.get(cid, PARENT_AUTHOR if cid in parent_cids else "pending")
                print(f"conversation={cid} role={role}", flush=True)
                print(f"transcript={transcript_path(cid)}", flush=True)
                progress = True
            for cid in list(known):
                path = transcript_path(cid)
                if not path.is_file():
                    continue
                data = path.read_bytes()
                offset = offsets.get(cid, 0)
                if len(data) <= offset:
                    continue
                chunk = data[offset:].decode("utf-8", errors="replace")
                offsets[cid] = len(data)
                for line in chunk.splitlines():
                    line = line.strip()
                    if not line.startswith("{"):
                        continue
                    try:
                        obj = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    key = (cid, int(obj.get("step_index") or 0), str(obj.get("type") or ""))
                    if key in seen:
                        continue
                    seen.add(key)
                    events = convert_line(obj, cid, state, parent_cids)
                    if events:
                        append_events(out, events)
                        progress = True
            for role in sorted(set(state.role_by_cid.values()) - announced_roles):
                announced_roles.add(role)
                print(f"subagent={role}", flush=True)
                progress = True
        time.sleep(args.poll)


if __name__ == "__main__":
    raise SystemExit(main())
