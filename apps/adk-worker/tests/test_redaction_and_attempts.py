"""Redaction, durable attempt counting, and the truth label of a replay."""

from __future__ import annotations

import pytest
from conftest import FakeHttp, frozen_clock

from fleetscope_worker.attempts import FileAttemptStore, MemoryAttemptStore
from fleetscope_worker.contract import EventStream
from fleetscope_worker.faults import ControlledFault
from fleetscope_worker.redact import REDACTED, looks_secret, redact_mapping
from fleetscope_worker.request import RunRequest
from fleetscope_worker.runtime import RunPlan, ScriptedRuntime
from fleetscope_worker.scenario import DEPENDENCY_ONBOARDING
from fleetscope_worker.tools import RepositoryMetadataTool

SAFE = frozenset({"target", "stars"})


# ── redaction ───────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "key,value",
    [
        ("api_key", "short"),
        ("token", 1),
        ("password", "hunter2"),
        ("authorization", "Bearer abc"),
        ("Cookie", "x"),
        ("privateKey", "-----BEGIN RSA"),
        ("anything", "sk-abc123456789012345"),
        ("anything", "ghp_0123456789abcdefghij"),
        ("anything", "AIzaSyA1234567890abcdefg"),
    ],
)
def test_secret_shapes_are_recognised(key: str, value: object):
    assert looks_secret(key, value) is True


@pytest.mark.parametrize(
    "key,value",
    [
        ("target", "google/adk-python"),
        ("stars", 21319),
        ("archived", False),
        ("defaultBranch", "main"),
    ],
)
def test_ordinary_evidence_is_not_mistaken_for_a_secret(key: str, value: object):
    assert looks_secret(key, value) is False


def test_only_allowlisted_fields_survive_and_the_rest_are_counted():
    out = redact_mapping(
        {"target": "google/adk-python", "stars": 3, "prompt": "...", "cookie": "..."}, allow=SAFE
    )
    assert out == {"target": "google/adk-python", "stars": 3, "redactedFields": 2}


def test_an_allowlisted_key_holding_a_secret_is_still_withheld():
    # The allowlist says which fields are interesting, not that their contents
    # are automatically safe.
    out = redact_mapping({"target": "sk-abc123456789012345"}, allow=SAFE)
    assert "sk-abc123456789012345" not in str(out)
    assert out == {"redactedFields": 1}


def test_a_long_value_is_truncated_rather_than_stored_whole():
    out = redact_mapping({"target": "x" * 500}, allow=SAFE)
    assert out["target"].endswith("<truncated>")
    assert len(out["target"]) < 200


def test_nested_structures_are_reduced_to_their_shape():
    out = redact_mapping({"target": {"nested": "value"}}, allow=SAFE)
    assert out["target"] == {"<object>": 1}


def test_a_non_object_payload_is_handled_rather_than_crashing():
    assert redact_mapping("just a string", allow=SAFE) == {"<not-an-object>": True}
    assert redact_mapping(None, allow=SAFE) == {"<not-an-object>": True}


def test_an_unserialisable_value_becomes_the_redaction_marker():
    assert redact_mapping({"target": object()}, allow=SAFE)["target"] == REDACTED


# ── durable attempt counting ────────────────────────────────────────────────


def test_the_memory_store_counts_per_key():
    store = MemoryAttemptStore()
    assert store.reserve("a") == 1
    assert store.reserve("a") == 2
    assert store.reserve("b") == 1
    assert store.attempts("a") == 2


def test_a_file_store_remembers_attempts_across_a_restart(tmp_path):
    # The exactly-once claim is about a logical operation, and a redelivery
    # after a crash is the case it is about.
    path = tmp_path / "attempts.jsonl"
    assert FileAttemptStore(path).reserve("run-1:retry:1") == 1
    reopened = FileAttemptStore(path)
    assert reopened.attempts("run-1:retry:1") == 1
    assert reopened.reserve("run-1:retry:1") == 2


def test_a_torn_final_write_does_not_erase_earlier_attempts(tmp_path):
    path = tmp_path / "attempts.jsonl"
    FileAttemptStore(path).reserve("k")
    with path.open("a", encoding="utf-8") as handle:
        handle.write('{"key": "k", "att')
    assert FileAttemptStore(path).attempts("k") == 1


def test_a_redelivered_operation_does_not_start_a_second_attempt_count(tmp_path):
    path = tmp_path / "attempts.jsonl"
    http = FakeHttp()
    key = "run-1:retry_idempotent_read:1"
    first = RepositoryMetadataTool(http, attempts=FileAttemptStore(path))
    first.read(DEPENDENCY_ONBOARDING.target, idempotency_key=key)

    # A fresh process, the same logical operation.
    second = RepositoryMetadataTool(http, attempts=FileAttemptStore(path))
    assert second.attempts_for(key) == 1


# ── a replay is never a live claim ──────────────────────────────────────────


def scripted():
    stream = EventStream(run_id="run-1", correlation_id="corr-1", clock=frozen_clock())
    plan = RunPlan(
        request=RunRequest(
            run_id="run-1",
            session_id="sess-1",
            correlation_id="corr-1",
            scenario_id=DEPENDENCY_ONBOARDING.id,
            mode="pure",
        ),
        scenario=DEPENDENCY_ONBOARDING,
        model="unused",
    )
    tool = RepositoryMetadataTool(
        FakeHttp(),
        allowlist=frozenset({DEPENDENCY_ONBOARDING.target}),
        fault=ControlledFault(fails_attempts=DEPENDENCY_ONBOARDING.fault_attempts),
    )
    outcome = ScriptedRuntime().execute(plan, stream, tool)
    return outcome, stream


def test_a_deterministic_replay_never_claims_to_be_live():
    # The single most misleading thing this system could record.
    _, stream = scripted()
    assert "live" not in {event.truth for event in stream}


def test_replay_evidence_is_labelled_recorded_or_controlled_fault():
    _, stream = scripted()
    assert {event.truth for event in stream} <= {"recorded", "controlled_fault"}


def test_the_replay_still_tells_the_five_beat_story():
    outcome, stream = scripted()
    assert outcome.terminal_result == "succeeded"
    kinds = [event.kind for event in stream]
    for expected in ["run_start", "delegation", "incident", "intervention", "run_end"]:
        assert expected in kinds, expected


def test_the_replay_spends_no_model_calls():
    outcome, _ = scripted()
    assert outcome.model_calls == 0
