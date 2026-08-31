"""The FleetScope MCP server: a governed tool for a locally-run agent.

# Why this exists

FleetScope holds no model credential and has no cloud budget. The model
therefore runs where the developer already pays nothing for it: inside their own
Gemini or Antigravity CLI session, on that CLI's own auth. FleetScope keeps the
part that actually needs governing, by owning the tool the agent calls.

So the split is:

    the developer's CLI   supplies the model, the prompt and the agent loop
    FleetScope            supplies the tool, the Controlled Fault, the policy,
                          the Warden retry, the idempotency key and the evidence

# Why the tool refuses outside an admitted run

A tool that answers whenever it is called is ungoverned: there is no budget, no
single-active-run guarantee, no ledger entry and no idempotency key. So the
first thing this does is ask the local API whether a run has been admitted. If
none has, it refuses and says how to start one. That refusal is the governance
boundary doing its job, not an error.

# Why the recovery is not left to the model

The agent sees ONE successful tool call. Inside it, FleetScope fails the first
attempt as a labelled Controlled Fault, raises an incident, asks the policy, and
performs exactly one idempotent retry under the same key. A retry the model
decided to do would be unbounded and unrecorded; this one is neither.

# stdout is the protocol

MCP speaks JSON-RPC over stdout. Nothing here may print to it. Events go to the
local API over loopback HTTP, and diagnostics go to stderr.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Protocol

from .contract import EventStream, WorkerEvent
from .faults import ControlledFault
from .recovery import Incident, RecoveryPolicy
from .scenario import DEPENDENCY_ONBOARDING, Scenario
from .tools import RepositoryMetadataTool, TargetNotAllowed, ToolFailure
from .transport import RecordedReadOnlyHttp, UrllibReadOnlyHttp

TOOL_NAME = "read_repository_metadata"
DEFAULT_API = "http://127.0.0.1:8080"


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _log(message: str) -> None:
    print(f"[fleetscope-mcp] {message}", file=sys.stderr, flush=True)


# ── the local API, as a port ────────────────────────────────────────────────


@dataclass(frozen=True)
class ActiveRun:
    run_id: str
    correlation_id: str
    idempotency_key: str
    high_water_mark: int


class RunApi(Protocol):
    def active_run(self) -> ActiveRun | None: ...

    def publish(self, run_id: str, events: list[WorkerEvent]) -> None: ...


class HttpRunApi:
    """Talks to the local FleetScope API over loopback."""

    def __init__(self, base: str, *, timeout_s: float = 10.0) -> None:
        self._base = base.rstrip("/")
        self._timeout_s = timeout_s

    def _request(self, path: str, *, body: dict[str, Any] | None = None) -> Any:
        data = None if body is None else json.dumps(body).encode("utf-8")
        request = urllib.request.Request(
            f"{self._base}{path}",
            data=data,
            method="POST" if data is not None else "GET",
            headers={"content-type": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=self._timeout_s) as response:
            return json.loads(response.read().decode("utf-8"))

    def active_run(self) -> ActiveRun | None:
        try:
            active = self._request("/runs/active").get("run")
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            return None
        if not isinstance(active, dict):
            return None
        run_id = active.get("runId")
        if not isinstance(run_id, str):
            return None
        try:
            events = self._request(f"/runs/{run_id}/events?after=0")
            high = events.get("highWaterMark", 0)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            high = 0
        return ActiveRun(
            run_id=run_id,
            correlation_id=str(active.get("correlationId", "")),
            idempotency_key=str(active.get("idempotencyKey", "")),
            high_water_mark=int(high) if isinstance(high, int) else 0,
        )

    def publish(self, run_id: str, events: list[WorkerEvent]) -> None:
        self._request(
            f"/runs/{run_id}/events", body={"events": [event.to_wire() for event in events]}
        )


# ── the governed read ───────────────────────────────────────────────────────


@dataclass(frozen=True)
class ToolOutcome:
    text: str
    events: list[WorkerEvent]
    succeeded: bool


def governed_read(
    *,
    run: ActiveRun,
    scenario: Scenario,
    tool: RepositoryMetadataTool,
    target: str,
    agent: str,
    client: str,
    policy: RecoveryPolicy | None = None,
) -> ToolOutcome:
    """One tool call, with the whole recovery lifecycle recorded inside it."""
    policy = policy or RecoveryPolicy(max_retries=scenario.max_retries)
    stream = EventStream(
        run_id=run.run_id,
        correlation_id=run.correlation_id,
        clock=_utc_now,
        start_sequence=run.high_water_mark,
    )

    if run.high_water_mark == 0:
        stream.emit(
            agent=agent,
            kind="run_start",
            truth="live",
            payload={
                "target": scenario.target,
                "driver": "mcp",
                # Recorded because it is the honest answer to "which runtime
                # produced this evidence"; it is the MCP client's own name.
                "client": client,
            },
        )

    # The target is not the caller's to choose. An agent that asks for something
    # else is refused, and the refusal is evidence like anything else.
    if target != scenario.target:
        stream.emit(
            agent=agent,
            kind="tool_result",
            truth="live",
            payload={"tool": TOOL_NAME, "status": "refused", "requested": target},
        )
        stream.emit(
            agent=agent,
            kind="run_end",
            truth="live",
            payload={"terminalResult": "failed", "delegationObserved": False},
        )
        return ToolOutcome(
            text=(
                f"Refused: FleetScope's admitted run covers {scenario.target!r} only. "
                f"{target!r} is not an allowlisted target."
            ),
            events=list(stream),
            succeeded=False,
        )

    retries_used = 0
    while True:
        stream.emit(
            agent=agent,
            kind="tool_call",
            truth="live",
            payload={
                "tool": TOOL_NAME,
                "target": target,
                "idempotencyKey": run.idempotency_key,
                "attempt": tool.attempts_for(run.idempotency_key) + 1,
            },
        )
        try:
            facts = tool.read(target, idempotency_key=run.idempotency_key)
        except TargetNotAllowed as refusal:
            stream.emit(
                agent=agent,
                kind="tool_result",
                truth="live",
                payload={"tool": TOOL_NAME, "status": "refused", "reason": str(refusal)},
            )
            stream.emit(
                agent=agent,
                kind="run_end",
                truth="live",
                payload={"terminalResult": "failed", "delegationObserved": False},
            )
            return ToolOutcome(f"Refused: {refusal}", list(stream), False)
        except ToolFailure as failure:
            stream.emit(
                agent=agent,
                kind="tool_result",
                truth=failure.truth,
                payload={"tool": TOOL_NAME, "status": "failed", "reason": failure.message},
            )
            incident = Incident(
                tool=TOOL_NAME,
                reason=failure.message,
                truth=failure.truth,
                retryable=failure.retryable,
                side_effect_class=tool.side_effect_class,
            )
            stream.emit(
                agent=agent,
                kind="incident",
                truth=failure.truth,
                payload={
                    "tool": incident.tool,
                    "reason": incident.reason,
                    "sideEffectClass": incident.side_effect_class,
                    "retryable": incident.retryable,
                },
            )
            decision = policy.decide(incident, retries_used=retries_used)
            stream.emit(
                agent="warden",
                kind="intervention",
                truth="live",
                payload={
                    "outcome": decision.outcome,
                    "rationale": decision.rationale,
                    "idempotencyKey": run.idempotency_key,
                    "retriesUsed": retries_used,
                    "maxRetries": policy.max_retries,
                },
            )
            if not decision.permits_retry:
                stream.emit(
                    agent=agent,
                    kind="run_end",
                    truth="live",
                    payload={"terminalResult": "failed", "delegationObserved": False},
                )
                return ToolOutcome(f"Failed: {failure.message}", list(stream), False)
            retries_used += 1
            continue

        stream.emit(
            agent=agent,
            kind="tool_result",
            truth="live",
            payload={"tool": TOOL_NAME, "status": "ok", **facts.to_payload()},
        )
        stream.emit(
            agent=agent,
            kind="run_end",
            truth="live",
            payload={
                "terminalResult": "succeeded",
                # Gemini CLI has no ADK sub-agents, so delegation is not
                # something this runtime lets us observe. Reported as absent
                # rather than asserted.
                "delegationObserved": False,
            },
        )
        return ToolOutcome(
            text=json.dumps(facts.to_payload(), sort_keys=True),
            events=list(stream),
            succeeded=True,
        )


NO_RUN_MESSAGE = (
    "Refused: no FleetScope run is currently admitted, so this tool has no budget, "
    "no ledger entry and no idempotency key to work under. Start one from the "
    "FleetScope UI (or POST /runs on the local API), then call this tool again."
)


def build_tool(scenario: Scenario) -> RepositoryMetadataTool:
    offline = os.environ.get("FLEETSCOPE_WORKER_OFFLINE") == "true"
    ledger = os.environ.get("FLEETSCOPE_ATTEMPT_LEDGER", "").strip()
    from .attempts import FileAttemptStore, MemoryAttemptStore

    return RepositoryMetadataTool(
        RecordedReadOnlyHttp() if offline else UrllibReadOnlyHttp(),
        allowlist=frozenset({scenario.target}),
        fault=ControlledFault(fails_attempts=scenario.fault_attempts),
        attempts=FileAttemptStore(ledger) if ledger else MemoryAttemptStore(),
    )


def handle_call(api: RunApi, target: str, *, client: str) -> str:
    """The whole tool call, with no MCP types in it so it can be tested plainly."""
    scenario = DEPENDENCY_ONBOARDING
    run = api.active_run()
    if run is None:
        return NO_RUN_MESSAGE

    outcome = governed_read(
        run=run,
        scenario=scenario,
        tool=build_tool(scenario),
        target=target,
        agent=os.environ.get("FLEETSCOPE_MCP_AGENT", "external_agent"),
        client=client,
    )
    try:
        api.publish(run.run_id, outcome.events)
    except Exception as error:  # noqa: BLE001 - the agent must still get an answer
        _log(f"could not publish {len(outcome.events)} event(s): {type(error).__name__}")
    return outcome.text


async def serve() -> None:
    """Run the MCP server over stdio."""
    import mcp.types as types
    from mcp.server import Server
    from mcp.server.stdio import stdio_server

    api = HttpRunApi(os.environ.get("FLEETSCOPE_API", DEFAULT_API))
    server: Server = Server("fleetscope")

    @server.list_tools()
    async def list_tools() -> list[types.Tool]:
        return [
            types.Tool(
                name=TOOL_NAME,
                description=(
                    "Read public metadata for the dependency FleetScope's admitted run "
                    "covers. Governed: the first attempt fails as a deliberate Controlled "
                    "Fault and FleetScope performs exactly one policy-authorised retry."
                ),
                inputSchema={
                    "type": "object",
                    "properties": {
                        "target": {
                            "type": "string",
                            "description": "Repository in owner/name form.",
                        }
                    },
                    "required": ["target"],
                },
            )
        ]

    @server.call_tool()
    async def call_tool(name: str, arguments: dict[str, Any]) -> list[types.TextContent]:
        if name != TOOL_NAME:
            return [types.TextContent(type="text", text=f"Unknown tool {name!r}")]
        target = arguments.get("target")
        if not isinstance(target, str) or target.strip() == "":
            return [types.TextContent(type="text", text="Refused: 'target' is required.")]
        client = "unknown"
        params = getattr(server.request_context.session, "client_params", None)
        info = getattr(params, "clientInfo", None)
        if getattr(info, "name", None):
            client = str(info.name)
        return [types.TextContent(type="text", text=handle_call(api, target, client=client))]

    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())


def main() -> int:
    import asyncio

    _log(f"serving; API at {os.environ.get('FLEETSCOPE_API', DEFAULT_API)}")
    asyncio.run(serve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
