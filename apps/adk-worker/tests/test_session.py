from conftest import FakeHttp, frozen_clock
from fleetscope_worker.contract import EventStream
from fleetscope_worker.faults import ControlledFault
from fleetscope_worker.recovery import RecoveryPolicy
from fleetscope_worker.session import run_dependency_onboarding, story_beats
from fleetscope_worker.tools import RepositoryMetadataTool

TARGET = "google/adk-python"
KEY = "run-1:retry_idempotent_read:1"


def go(*, fault=None, target=TARGET, max_retries=1, http=None):
    http = http or FakeHttp()
    stream = EventStream(run_id="run-1", correlation_id="corr-1", clock=frozen_clock())
    outcome = run_dependency_onboarding(
        stream=stream,
        tool=RepositoryMetadataTool(http, fault=fault),
        target=target,
        idempotency_key=KEY,
        policy=RecoveryPolicy(max_retries=max_retries),
    )
    return stream, outcome, http


def test_the_clean_run_tells_a_three_beat_story():
    stream, outcome, _ = go()
    assert outcome.terminal_result == "succeeded"
    assert [b["beat"] for b in story_beats(stream)] == ["Start", "Delegate", "Result"]


def test_a_run_that_did_not_retry_shows_no_retry_beat():
    # The beats are derived from the events, so the UI cannot narrate a recovery
    # that never happened.
    stream, _, _ = go()
    assert "Warden retry" not in [b["beat"] for b in story_beats(stream)]


def test_the_recovered_run_tells_the_full_five_beat_story():
    stream, outcome, _ = go(fault=ControlledFault(fails_attempts=1))
    assert outcome.terminal_result == "succeeded"
    assert outcome.retries_used == 1
    assert [b["beat"] for b in story_beats(stream)] == [
        "Start",
        "Delegate",
        "Tool failure",
        "Warden retry",
        "Result",
    ]


def test_the_failure_beat_is_labelled_as_a_controlled_fault():
    stream, _, _ = go(fault=ControlledFault(fails_attempts=1))
    failure = next(b for b in story_beats(stream) if b["beat"] == "Tool failure")
    assert failure["truth"] == "controlled_fault"


def test_the_retry_reuses_the_same_idempotency_key():
    # A retry that minted a new key would be a second logical operation, and the
    # exactly-once claim would be false.
    stream, _, _ = go(fault=ControlledFault(fails_attempts=1))
    keys = {
        e.payload["idempotencyKey"]
        for e in stream
        if e.kind in {"tool_call", "intervention"}
    }
    assert keys == {KEY}


def test_exactly_one_intervention_is_recorded():
    stream, _, _ = go(fault=ControlledFault(fails_attempts=1))
    assert len([e for e in stream if e.kind == "intervention"]) == 1


def test_the_intervention_is_recorded_before_the_retry_runs():
    # The ledger's rule: persist the key, then act. A crash between the two must
    # not be able to produce a second attempt.
    stream, _, _ = go(fault=ControlledFault(fails_attempts=1))
    events = list(stream)
    intervention = next(i for i, e in enumerate(events) if e.kind == "intervention")
    calls = [i for i, e in enumerate(events) if e.kind == "tool_call"]
    assert calls[0] < intervention < calls[1]


def test_the_successful_read_happens_once_even_though_the_tool_was_called_twice():
    stream, _, http = go(fault=ControlledFault(fails_attempts=1))
    assert len(http.calls) == 1, "the faulted attempt must not have reached the network"


def test_a_second_failure_exhausts_the_policy_and_the_run_fails_honestly():
    stream, outcome, _ = go(fault=ControlledFault(fails_attempts=2))
    assert outcome.terminal_result == "failed"
    assert outcome.decision is not None
    assert outcome.decision.outcome == "refuse_budget_exhausted"
    assert [e.payload for e in stream if e.kind == "run_end"][0]["terminalResult"] == "failed"


def test_a_disallowed_target_is_refused_and_never_retried():
    stream, outcome, http = go(target="attacker/exfil")
    assert outcome.terminal_result == "failed"
    assert http.calls == []
    assert [e for e in stream if e.kind == "intervention"] == []


def test_the_delegation_names_the_sub_agent():
    stream, _, _ = go()
    delegation = next(e for e in stream if e.kind == "delegation")
    assert delegation.agent == "dependency_onboarding"
    assert delegation.payload["to"] == "security_review"


def test_the_run_always_closes_both_agents_and_the_run():
    for fault in [None, ControlledFault(fails_attempts=1), ControlledFault(fails_attempts=2)]:
        stream, _, _ = go(fault=fault)
        kinds = [e.kind for e in stream]
        assert kinds[-3:] == ["agent_end", "agent_end", "run_end"]


def test_replaying_the_same_run_produces_an_identical_transcript():
    # Determinism is what the judge replay check rests on.
    a, _, _ = go(fault=ControlledFault(fails_attempts=1))
    b, _, _ = go(fault=ControlledFault(fails_attempts=1))
    assert [e.to_json() for e in a] == [e.to_json() for e in b]
