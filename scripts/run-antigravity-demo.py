#!/usr/bin/env python3
"""Run real Antigravity CLI workers and record a FleetScope-followable session.

The CLI does not expose Antigravity's private conversation database as a public
adapter. This bridge therefore uses the supported boundary: real `agy --print`
responses are translated into the redacted, Google ADK-shaped JSONL envelope
that FleetScope already knows how to project. No agent is controlled by the
viewer, and plan mode prevents workers from editing the example project.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
import os
import shutil
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path


ROLES: list[tuple[str, str]] = [
    (
        "researcher",
        "Analyze the product brief from a user-needs perspective. Return three "
        "concrete user jobs, the failure that matters most, and one demo moment. "
        "You MAY use read-only tools to inspect the project. Do not edit files.",
    ),
    (
        "ux_designer",
        "Propose a compact desktop UI flow for the product brief. Name the key "
        "states, the first screen, and the interaction that makes live versus "
        "replay obvious. You MAY use read-only tools to inspect the project. Do not edit files.",
    ),
    (
        "qa_planner",
        "Turn the product brief into a verification plan. Cover live follow, "
        "duplicate events, shuffled events, a failed child, and read-only replay. "
        "You MAY use read-only tools to inspect the project. Do not edit files.",
    ),
    (
        "cloud_architect",
        "Suggest the smallest credible Google ecosystem proof for this demo. "
        "Separate real provider evidence from configured intent and keep all "
        "operations read-only. You MAY use read-only tools to inspect the project. Do not edit files.",
    ),
]


class Recorder:
    def __init__(self, path: Path, model: str, invocation_id: str) -> None:
        self.path = path
        self.model = model
        self.invocation_id = invocation_id
        self.lock = threading.Lock()
        self.counter = 0
        self.started = time.time()
        self.observed_model: str | None = None
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.touch()

    def observe_model(self, model: str | None) -> None:
        if isinstance(model, str) and model.strip():
            with self.lock:
                self.observed_model = model.strip()

    def emit(
        self,
        author: str,
        branch: str,
        *,
        content: dict | None = None,
        actions: dict | None = None,
        error_code: str | None = None,
        error_message: str | None = None,
        terminal: bool = False,
    ) -> None:
        with self.lock:
            self.counter += 1
            event: dict = {
                "id": f"ag-{self.counter:04d}",
                "invocationId": self.invocation_id,
                "author": author,
                "branch": branch,
                "timestamp": self.started + self.counter * 0.01,
                "customMetadata": {
                    "fleetscope": {
                        "framework": "antigravity-cli-bridge",
                        "frameworkVersion": "1",
                        "configuredModel": self.model,
                        "producer": "antigravity-cli",
                    }
                },
            }
            if self.observed_model is not None:
                event["modelVersion"] = self.observed_model
            if content is not None:
                event["content"] = content
            if actions is not None:
                event["actions"] = actions
            if error_code is not None:
                event["errorCode"] = error_code
            if error_message is not None:
                event["errorMessage"] = error_message
            if terminal:
                event["turnComplete"] = True
            with self.path.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(event, separators=(",", ":")) + "\n")
                handle.flush()


def text_event(text: str) -> dict:
    return {"role": "model", "parts": [{"text": text}]}


def timeout_seconds(value: str) -> float:
    raw = value.strip().lower()
    multiplier = 60.0 if raw.endswith("m") else 1.0
    if raw.endswith(("m", "s")):
        raw = raw[:-1]
    try:
        seconds = float(raw) * multiplier
    except ValueError as error:
        raise SystemExit(f"ERROR: invalid --timeout value: {value}") from error
    if not seconds > 0:
        raise SystemExit("ERROR: --timeout must be greater than zero")
    return seconds


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--project",
        type=Path,
        default=Path("examples/antigravity-project"),
        help="read-only example project passed as the Antigravity cwd",
    )
    parser.add_argument(
        "--session-dir",
        type=Path,
        default=None,
        help="directory containing session.jsonl (defaults to .fleetscope/sessions/...) ",
    )
    parser.add_argument("--model", default="gemini-3.7-flash-low")
    parser.add_argument("--timeout", default="90s")
    return parser.parse_args()


def agy_binary() -> str:
    override = os.environ.get("FLEETSCOPE_AGY_BIN")
    if override:
        if Path(override).is_file() and os.access(override, os.X_OK):
            return override
        raise SystemExit(f"ERROR: FLEETSCOPE_AGY_BIN is not executable: {override}")
    found = shutil.which("agy")
    if found:
        return found
    fallback = Path.home() / ".local/bin/agy"
    if fallback.exists():
        return str(fallback)
    raise SystemExit("ERROR: Antigravity CLI (agy) is not installed or not on PATH")


def run_worker(
    recorder: Recorder,
    role: str,
    brief: str,
    prompt: str,
    project: Path,
    model: str,
    timeout: str,
    artifact_dir: Path,
    binary: str,
) -> str:
    branch = f"lead.{role}"
    recorder.emit(role, branch, content=text_event(f"{role} started in Antigravity plan mode."))
    command = [
        binary,
        "--add-dir",
        str(project),
        "--model",
        model,
        "--mode",
        "plan",
        "--output-format",
        "stream-json",
        "--print-timeout",
        timeout,
        "--print="
        + "Use the project brief and the files in this folder. You MAY call "
        + "read-only tools (read, glob, grep). Do not edit files.\n\n"
        + prompt
        + "\n\nProject brief:\n"
        + brief,
    ]
    try:
        process = subprocess.Popen(
            command,
            cwd=project,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
    except OSError as error:
        failure = f"agy could not start ({type(error).__name__})"
        recorder.emit(
            role,
            branch,
            error_code="ANTIGRAVITY_START_FAILED",
            error_message=failure,
            terminal=True,
        )
        artifact_dir.mkdir(parents=True, exist_ok=True)
        (artifact_dir / f"{role}.md").write_text(
            f"# {role}\n\n{failure}\n",
            encoding="utf-8",
        )
        return failure
    timed_out = threading.Event()

    def stop_worker() -> None:
        if process.poll() is None:
            timed_out.set()
            process.kill()

    watchdog = threading.Timer(timeout_seconds(timeout) + 10.0, stop_worker)
    watchdog.daemon = True
    watchdog.start()
    deltas: list[str] = []
    result_text = ""
    conversation_id = "unknown"
    assert process.stdout is not None
    try:
        for raw_line in process.stdout:
            line = raw_line.strip()
            if not line.startswith("{"):
                continue
            try:
                payload = json.loads(line)
            except json.JSONDecodeError:
                continue
            event_type = payload.get("event")
            if event_type == "init":
                conversation_id = str(payload.get("conversation_id", conversation_id))
                init = payload.get("init", {})
                if isinstance(init, dict):
                    recorder.observe_model(init.get("model"))
                recorder.emit(role, branch, content=text_event(f"conversation {conversation_id} opened."))
            elif event_type == "step_update":
                update = payload.get("step_update", {})
                if not isinstance(update, dict):
                    continue
                delta = update.get("text_delta")
                if isinstance(delta, str) and delta:
                    deltas.append(delta)
                    recorder.emit(role, branch, content=text_event(delta))
                if update.get("step_type") == "tool":
                    tool_name = str(update.get("tool_name", "antigravity_tool"))
                    tool_info = update.get("tool_info", {})
                    if not isinstance(tool_info, dict):
                        tool_info = {}
                    parameters = tool_info.get("parameters", {})
                    step_index = update.get("step_index", "unknown")
                    call_id = f"agy-{role}-{step_index}"
                    if update.get("state") == "ACTIVE":
                        recorder.emit(
                            role,
                            branch,
                            content={
                                "role": "model",
                                "parts": [
                                    {
                                        "functionCall": {
                                            "id": call_id,
                                            "name": tool_name,
                                            "args": parameters,
                                        }
                                    }
                                ],
                            },
                        )
                    elif update.get("state") == "DONE":
                        output = str(tool_info.get("output", "completed"))[:500]
                        recorder.emit(
                            role,
                            branch,
                            content={
                                "role": "user",
                                "parts": [
                                    {
                                        "functionResponse": {
                                            "id": call_id,
                                            "name": tool_name,
                                            "response": {"status": "ok", "output": output},
                                        }
                                    }
                                ],
                            },
                        )
            elif event_type == "result":
                result = payload.get("result", {})
                if isinstance(result, dict):
                    response = result.get("response")
                    if isinstance(response, str):
                        result_text = response.strip()
    finally:
        watchdog.cancel()
    return_code = process.wait()
    if not result_text:
        result_text = "".join(deltas).strip()
    if timed_out.is_set():
        recorder.emit(
            role,
            branch,
            error_code="ANTIGRAVITY_TIMEOUT",
            error_message=f"agy exceeded the {timeout} worker timeout",
            terminal=True,
        )
        result_text = result_text or f"{role} timed out after {timeout}."
    elif return_code != 0:
        recorder.emit(
            role,
            branch,
            error_code="ANTIGRAVITY_FAILED",
            error_message=f"agy exited with status {return_code}",
            terminal=True,
        )
        result_text = result_text or f"{role} failed with exit status {return_code}."
    else:
        terminal_text = (
            f"{role} completed; report saved locally."
            if deltas
            else (result_text or f"{role} returned no text.")
        )
        recorder.emit(role, branch, content=text_event(terminal_text), terminal=True)
    artifact_dir.mkdir(parents=True, exist_ok=True)
    (artifact_dir / f"{role}.md").write_text(
        f"# {role}\n\nConversation: `{conversation_id}`\n\n{result_text}\n",
        encoding="utf-8",
    )
    return result_text


def main() -> int:
    args = parse_args()
    project = args.project.resolve()
    if not project.is_dir():
        raise SystemExit(f"ERROR: example project does not exist: {project}")
    binary = agy_binary()
    run_id = f"antigravity-{uuid.uuid4().hex[:10]}"
    session_dir = (args.session_dir or Path(".fleetscope/sessions") / run_id).resolve()
    session_dir.mkdir(parents=True, exist_ok=True)
    recorder = Recorder(session_dir / "session.jsonl", args.model, f"inv-{uuid.uuid4().hex[:8]}")
    artifact_dir = session_dir / "reports"
    brief = (project / "brief.md").read_text(encoding="utf-8")
    print(f"session_jsonl={recorder.path}", flush=True)
    print(f"project={project}", flush=True)
    print("agents=" + ",".join(["lead", *(role for role, _ in ROLES), "synthesizer"]), flush=True)
    recorder.emit("user", "lead", content={"role": "user", "parts": [{"text": "Create a demo plan for the agent workbench brief."}]})
    recorder.emit("lead", "lead", content=text_event("I am fanning out four real Antigravity workers, then I will ask a fifth worker to synthesize their reports."))
    for role, _ in ROLES:
        recorder.emit("lead", "lead", actions={"transferToAgent": role})

    reports: dict[str, str] = {}
    with ThreadPoolExecutor(max_workers=len(ROLES)) as pool:
        futures = {
            pool.submit(run_worker, recorder, role, brief, prompt, project, args.model, args.timeout, artifact_dir, binary): role
            for role, prompt in ROLES
        }
        for future in futures:
            reports[futures[future]] = future.result()

    digest = "\n\n".join(f"## {role}\n{reports[role][:5000]}" for role, _ in ROLES)
    final_prompt = (
        "You are the lead synthesizer. Combine the four worker reports below into "
        "a concise demo runbook with: the user story, a 60-second UI flow, the "
        "agent graph, and three proof checks. Do not edit files and do not use tools.\n\n"
        + digest
    )
    recorder.emit("lead", "lead", actions={"transferToAgent": "synthesizer"})
    final_report = run_worker(
        recorder,
        "synthesizer",
        brief,
        final_prompt,
        project,
        args.model,
        args.timeout,
        artifact_dir,
        binary,
    )
    recorder.emit("lead", "lead", content=text_event(final_report), terminal=True)
    print(f"reports={artifact_dir}", flush=True)
    print(
        "follow_command="
        f"cargo run -p fleetscope-cli --bin fleetscope -- {recorder.path} --follow",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
