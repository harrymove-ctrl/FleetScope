"""The worker's process boundary: one closed JSON request in, JSONL events out.

# What a caller may say

Identifiers only: `runId`, `sessionId`, `correlationId`, `scenarioId`, `mode`.
Target, model, retry budget, fault policy and call ceiling all come from
`scenario.py`. An unrecognised field is refused by name rather than ignored, so
a caller can never be left believing that a field they sent took effect.

# The two modes, and why only one can cost anything

`pure` replays the scenario deterministically and labels its evidence
`recorded`. `adk` invokes a real ADK runtime and labels what it observed `live`.
`adk` refuses to start unless `FLEETSCOPE_ALLOW_MODEL_CALLS=true`, because it is
the only path that can spend credit.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from typing import Any

from .attempts import AttemptStore, FileAttemptStore, MemoryAttemptStore
from .contract import EventStream
from .faults import ControlledFault
from .request import InvalidRequest, RunRequest, parse_request
from .runtime import AgentRuntime, RunPlan, RuntimeOutcome, ScriptedRuntime
from .scenario import Scenario, UnknownScenario, find_scenario
from .session import story_beats
from .tools import RepositoryMetadataTool
from .transport import RecordedReadOnlyHttp, UrllibReadOnlyHttp


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _attempt_store() -> AttemptStore:
    path = os.environ.get("FLEETSCOPE_ATTEMPT_LEDGER", "").strip()
    return FileAttemptStore(path) if path else MemoryAttemptStore()


def _resolve_model(scenario: Scenario) -> str:
    """The scenario's model, overridable only by the deployment.

    A deployment operator choosing a cheaper model is a cost decision made by
    someone accountable for the bill. A request field would be the same decision
    made by an untrusted caller, which is why it is not one.
    """
    return os.environ.get("FLEETSCOPE_ADK_MODEL", "").strip() or scenario.model


def _select_runtime(request: RunRequest) -> AgentRuntime:
    if request.mode == "pure":
        return ScriptedRuntime()
    if os.environ.get("FLEETSCOPE_ALLOW_MODEL_CALLS") != "true":
        raise SystemExit(
            "refused: mode 'adk' invokes a real runtime and can spend credit, "
            "and FLEETSCOPE_ALLOW_MODEL_CALLS is not 'true'"
        )
    # Imported here so the rest of this module, and every test that does not
    # exercise the runtime, stays free of the vendor SDK.
    from .adk_runtime import AdkRuntime

    return AdkRuntime()


def run(
    raw_request: dict[str, Any],
    *,
    out: Any,
    runtime: AgentRuntime | None = None,
    attempts: AttemptStore | None = None,
) -> dict[str, Any]:
    request = parse_request(raw_request)
    scenario = find_scenario(request.scenario_id)
    chosen = runtime if runtime is not None else _select_runtime(request)

    stream = EventStream(
        run_id=request.run_id,
        correlation_id=request.correlation_id,
        clock=_utc_now,
        sink=lambda event: print(event.to_json(), file=out, flush=True),
    )

    # Offline is opt-in and only meaningful in `pure` mode, whose evidence is
    # already labelled `recorded`. It cannot make a live claim cheaper.
    offline = os.environ.get("FLEETSCOPE_WORKER_OFFLINE") == "true" and request.mode == "pure"
    tool = RepositoryMetadataTool(
        RecordedReadOnlyHttp() if offline else UrllibReadOnlyHttp(),
        # Narrowed to this scenario's single target rather than the package-wide
        # default, so a scenario can only ever read its own declared target.
        allowlist=frozenset({scenario.target}),
        fault=ControlledFault(fails_attempts=scenario.fault_attempts),
        attempts=attempts if attempts is not None else _attempt_store(),
    )

    outcome: RuntimeOutcome = chosen.execute(
        RunPlan(request=request, scenario=scenario, model=_resolve_model(scenario)),
        stream,
        tool,
    )

    return {
        "runId": request.run_id,
        "sessionId": request.session_id,
        "correlationId": request.correlation_id,
        "scenarioId": scenario.id,
        "mode": request.mode,
        "terminalResult": outcome.terminal_result,
        "delegationObserved": outcome.delegated,
        "modelCalls": outcome.model_calls,
        "detail": outcome.detail,
        "eventCount": len(stream.events),
        "beats": story_beats(stream),
    }


def main() -> int:
    try:
        summary = run(json.load(sys.stdin), out=sys.stdout)
    except (InvalidRequest, UnknownScenario) as refusal:
        print(json.dumps({"schema": "fleetscope.worker.error.v1", "error": str(refusal)}))
        return 2
    print(json.dumps({"schema": "fleetscope.worker.summary.v1", **summary}, sort_keys=True))
    return 0 if summary["terminalResult"] == "succeeded" else 1


if __name__ == "__main__":
    raise SystemExit(main())
