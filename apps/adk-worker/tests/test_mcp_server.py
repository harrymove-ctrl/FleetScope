"""The governed MCP tool, driven with a fake local API.

No MCP transport and no model are involved: `handle_call` and `governed_read`
are deliberately free of MCP types so the governance can be asserted plainly.
"""

from __future__ import annotations

import os

import pytest
from conftest import FakeHttp

from fleetscope_worker.attempts import FileAttemptStore, MemoryAttemptStore
from fleetscope_worker.contract import WorkerEvent
from fleetscope_worker.faults import ControlledFault
from fleetscope_worker.mcp_server import (
    NO_RUN_MESSAGE,
    TOOL_NAME,
    ActiveRun,
    governed_read,
    handle_call,
)
from fleetscope_worker.scenario import DEPENDENCY_ONBOARDING
from fleetscope_worker.tools import RepositoryMetadataTool

KEY = "run-1:retry_idempotent_read:1"


class FakeApi:
    def __init__(self, run: ActiveRun | None) -> None:
        self._run = run
        self.published: list[WorkerEvent] = []
        self.publish_calls = 0

    def active_run(self) -> ActiveRun | None:
        return self._run

    def publish(self, run_id: str, events: list[WorkerEvent]) -> None:
        self.publish_calls += 1
        self.published.extend(events)


def active(high: int = 0) -> ActiveRun:
    return ActiveRun(
        run_id="run-1", correlation_id="corr-1", idempotency_key=KEY, high_water_mark=high
    )


_UNSET = object()


def read(*, high: int = 0, target=_UNSET, attempts=None, fault_attempts: int = 1):
    scenario = DEPENDENCY_ONBOARDING
    tool = RepositoryMetadataTool(
        FakeHttp(),
        allowlist=frozenset({scenario.target}),
        fault=ControlledFault(fails_attempts=fault_attempts),
        attempts=attempts or MemoryAttemptStore(),
    )
    return governed_read(
        run=active(high),
        scenario=scenario,
        tool=tool,
        target=scenario.target if target is _UNSET else target,
        agent="external_agent",
        client="antigravity-cli",
    )


# ── the governance boundary ─────────────────────────────────────────────────


def test_the_tool_refuses_when_no_run_has_been_admitted():
    # A tool that answers whenever it is called has no budget, no ledger entry
    # and no idempotency key. The refusal IS the governance boundary.
    api = FakeApi(None)
    message = handle_call(api, DEPENDENCY_ONBOARDING.target, client="antigravity-cli")
    assert message == NO_RUN_MESSAGE
    assert api.published == [], "a refused call must not write evidence"


def test_the_refusal_says_how_to_proceed():
    assert "Start one" in NO_RUN_MESSAGE and "/runs" in NO_RUN_MESSAGE


def test_a_target_the_admitted_run_does_not_cover_is_refused():
    # The agent's model chose this string. It is the one value an untrusted
    # model output could steer, so it is compared against the admitted run.
    outcome = read(target="attacker/exfiltrate")
    assert outcome.succeeded is False
    assert "not an allowlisted target" in outcome.text
    assert [e.kind for e in outcome.events][-1] == "run_end"


def test_a_refused_target_never_reaches_a_successful_result():
    outcome = read(target="attacker/exfiltrate")
    assert all(
        event.payload.get("status") != "ok"
        for event in outcome.events
        if event.kind == "tool_result"
    )


# ── the recovery, inside one tool call ──────────────────────────────────────


def test_one_tool_call_contains_the_whole_recovery_lifecycle():
    # The agent sees a single successful call. FleetScope's evidence shows the
    # fault, the policy decision and the bounded retry.
    kinds = [event.kind for event in read().events]
    assert kinds == [
        "run_start",
        "tool_call",
        "tool_result",
        "incident",
        "intervention",
        "tool_call",
        "tool_result",
        "run_end",
    ]


def test_the_injected_failure_is_labelled_a_controlled_fault():
    events = read().events
    incident = next(event for event in events if event.kind == "incident")
    assert incident.truth == "controlled_fault"


def test_what_the_runtime_actually_did_is_labelled_live():
    # The model really ran, in the developer's own CLI. The tool call and its
    # result are genuine observations, so `live` is honest here in a way it
    # never is for the scripted replay.
    events = read().events
    assert next(e for e in events if e.kind == "run_start").truth == "live"
    assert next(e for e in events if e.kind == "intervention").truth == "live"


def test_the_retry_reuses_the_admitted_runs_idempotency_key():
    keys = {
        event.payload["idempotencyKey"]
        for event in read().events
        if event.kind in {"tool_call", "intervention"}
    }
    assert keys == {KEY}


def test_exactly_one_intervention_is_recorded():
    assert len([e for e in read().events if e.kind == "intervention"]) == 1


def test_a_second_failure_exhausts_the_policy_rather_than_looping():
    outcome = read(fault_attempts=2)
    assert outcome.succeeded is False
    intervention = next(e for e in outcome.events if e.kind == "intervention")
    assert intervention.payload["outcome"] == "retry_once"
    assert [e.kind for e in outcome.events].count("intervention") == 2


def test_the_agent_receives_the_authoritative_result():
    outcome = read()
    assert outcome.succeeded is True
    assert DEPENDENCY_ONBOARDING.target in outcome.text
    assert "Apache-2.0" in outcome.text


# ── honesty about what this runtime cannot show ─────────────────────────────


def test_delegation_is_reported_as_unobserved_rather_than_asserted():
    # Gemini CLI has no ADK sub-agents. Emitting a delegation event here would
    # be inventing the one thing this path genuinely cannot see.
    events = read().events
    assert not any(event.kind == "delegation" for event in events)
    end = next(event for event in events if event.kind == "run_end")
    assert end.payload["delegationObserved"] is False


def test_the_mcp_client_is_recorded_as_the_runtime_that_produced_the_evidence():
    start = next(event for event in read().events if event.kind == "run_start")
    assert start.payload["client"] == "antigravity-cli"
    assert start.payload["driver"] == "mcp"


# ── the canonical cursor across separate processes ──────────────────────────


def test_events_continue_the_runs_existing_sequence():
    # Each MCP tool call is a separate process. Restarting at 1 would make the
    # browser's cursor skip or duplicate events.
    events = read(high=12).events
    assert [event.sequence for event in events][0] == 13
    assert [event.sequence for event in events] == list(range(13, 13 + len(events)))


def test_a_run_already_under_way_does_not_emit_a_second_run_start():
    assert not any(event.kind == "run_start" for event in read(high=12).events)


def test_every_event_carries_the_run_and_correlation_id():
    events = read().events
    assert {event.run_id for event in events} == {"run-1"}
    assert {event.correlation_id for event in events} == {"corr-1"}


# ── publishing ──────────────────────────────────────────────────────────────


def test_a_successful_call_publishes_its_evidence_once(monkeypatch):
    # The MCP integration test must stay deterministic and offline. The
    # production default is the real read-only transport; opt into the fixture
    # explicitly rather than allowing ambient network state to change the test.
    monkeypatch.setenv("FLEETSCOPE_WORKER_OFFLINE", "true")
    api = FakeApi(active())
    handle_call(api, DEPENDENCY_ONBOARDING.target, client="antigravity-cli")
    assert api.publish_calls == 1
    assert len(api.published) == 8


def test_the_agent_still_gets_an_answer_when_publishing_fails(monkeypatch):
    # Losing the ledger is bad. Hanging the developer's agent session because
    # of it is worse, and the failure is logged to stderr rather than swallowed.
    monkeypatch.setenv("FLEETSCOPE_WORKER_OFFLINE", "true")

    class Broken(FakeApi):
        def publish(self, run_id: str, events: list[WorkerEvent]) -> None:
            raise ConnectionError("api is down")

    message = handle_call(Broken(active()), DEPENDENCY_ONBOARDING.target, client="cli")
    assert DEPENDENCY_ONBOARDING.target in message


def test_attempts_survive_across_separate_tool_calls(tmp_path):
    # Two MCP calls are two processes. The attempt count is what stops the
    # second one starting a fresh logical operation under the same key.
    path = tmp_path / "attempts.jsonl"
    read(attempts=FileAttemptStore(path))
    assert FileAttemptStore(path).attempts(KEY) == 2


@pytest.mark.parametrize("target", ["", "   "])
def test_a_blank_target_is_not_treated_as_the_scenario_target(target: str):
    assert read(target=target).succeeded is False


def test_the_tool_name_is_stable():
    # It is written into the developer's mcp_config.json prompts and docs.
    assert TOOL_NAME == "read_repository_metadata"


def test_the_server_never_writes_to_stdout(capsys):
    # stdout is the MCP JSON-RPC channel. One stray print corrupts the protocol.
    api = FakeApi(active())
    handle_call(api, DEPENDENCY_ONBOARDING.target, client="cli")
    assert capsys.readouterr().out == ""


def test_offline_mode_is_honoured_so_tests_touch_no_network(monkeypatch):
    monkeypatch.setenv("FLEETSCOPE_WORKER_OFFLINE", "true")
    api = FakeApi(active())
    message = handle_call(api, DEPENDENCY_ONBOARDING.target, client="cli")
    assert "Apache-2.0" in message
    os.environ.pop("FLEETSCOPE_WORKER_OFFLINE", None)
