import json

import pytest
from conftest import frozen_clock
from fleetscope_worker.contract import SCHEMA, EventStream


def stream() -> EventStream:
    return EventStream(run_id="run-1", correlation_id="corr-1", clock=frozen_clock())


def test_every_record_carries_its_schema_version():
    # A ledger outlives the writer. A reader must never have to infer the
    # version from the shape of what it is holding.
    event = stream().emit(agent="root", kind="run_start", truth="live")
    assert json.loads(event.to_json())["schema"] == SCHEMA


def test_sequence_starts_at_one_and_is_dense():
    s = stream()
    for _ in range(5):
        s.emit(agent="root", kind="agent_start", truth="live")
    assert [event.sequence for event in s] == [1, 2, 3, 4, 5]


def test_an_unknown_truth_label_is_refused_at_the_boundary():
    # Evidence that lies is worse than evidence that is missing.
    with pytest.raises(ValueError, match="unknown truth"):
        stream().emit(agent="root", kind="run_start", truth="probably_fine")  # type: ignore[arg-type]


def test_the_payload_is_copied_not_aliased():
    # An emitted event is a fact. A caller mutating its own dict afterwards must
    # not rewrite history.
    payload = {"target": "google/adk-python"}
    event = stream().emit(agent="root", kind="run_start", truth="live", payload=payload)
    payload["target"] = "someone/else"
    assert event.payload["target"] == "google/adk-python"


def test_the_encoding_is_stable_across_runs():
    a = stream().emit(agent="root", kind="run_start", truth="live", payload={"b": 1, "a": 2})
    b = stream().emit(agent="root", kind="run_start", truth="live", payload={"a": 2, "b": 1})
    assert a.to_json() == b.to_json()
