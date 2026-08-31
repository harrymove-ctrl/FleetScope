import pytest
from conftest import frozen_clock
from fleetscope_worker.capture import CallbackCapture, ModelBudget, ModelBudgetExceeded
from fleetscope_worker.contract import EventStream
from fleetscope_worker.recovery import Incident, RecoveryPolicy


class FakeContext:
    """Shaped like google-adk's Context: it exposes `agent_name`.
    Verified against LlmAgent's real callback annotations in adk 2.8.0."""

    def __init__(self, agent_name: str) -> None:
        self.agent_name = agent_name


class FakeTool:
    name = "read_repository_metadata"


def stream() -> EventStream:
    return EventStream(run_id="run-1", correlation_id="corr-1", clock=frozen_clock())


# ── budget ──────────────────────────────────────────────────────────────────


def test_the_budget_is_spent_before_the_call_not_after():
    # Counting after would undercount the case that matters most: a call that
    # was billed and then failed.
    budget = ModelBudget(2)
    assert budget.reserve() == 1
    assert budget.used == 1


def test_the_budget_refuses_the_call_that_would_exceed_it():
    budget = ModelBudget(1)
    capture = CallbackCapture(stream(), budget)
    capture.before_model(FakeContext("root"))
    with pytest.raises(ModelBudgetExceeded):
        capture.before_model(FakeContext("root"))


def test_a_zero_budget_refuses_the_first_call():
    with pytest.raises(ModelBudgetExceeded):
        CallbackCapture(stream(), ModelBudget(0)).before_model(FakeContext("root"))


# ── capture ─────────────────────────────────────────────────────────────────


def test_the_agent_lifecycle_becomes_two_events_naming_the_agent():
    s = stream()
    capture = CallbackCapture(s, ModelBudget(6))
    capture.before_agent(FakeContext("security_review"))
    capture.after_agent(FakeContext("security_review"))
    assert [(e.kind, e.agent) for e in s] == [
        ("agent_start", "security_review"),
        ("agent_end", "security_review"),
    ]


def test_a_context_without_a_name_reads_as_unknown_not_as_the_root():
    s = stream()
    CallbackCapture(s, ModelBudget(6)).before_agent(object())
    assert s.events[0].agent == "unknown"


def test_a_tool_call_and_its_result_are_both_recorded():
    s = stream()
    capture = CallbackCapture(s, ModelBudget(6))
    context = FakeContext("security_review")
    capture.before_tool(FakeTool(), {"target": "google/adk-python"}, context)
    capture.after_tool(FakeTool(), {"target": "google/adk-python"}, context, {"stars": 1})
    kinds = [e.kind for e in s]
    assert kinds == ["tool_call", "tool_result"]
    assert s.events[0].payload["args"] == {"target": "google/adk-python"}


# ── policy ──────────────────────────────────────────────────────────────────


def idempotent(**overrides) -> Incident:
    base = dict(
        tool="read_repository_metadata",
        reason="controlled fault",
        truth="controlled_fault",
        retryable=True,
        side_effect_class="idempotent_read",
    )
    return Incident(**{**base, **overrides})


def test_one_retry_is_permitted_for_a_repeatable_read():
    decision = RecoveryPolicy().decide(idempotent(), retries_used=0)
    assert decision.permits_retry and decision.outcome == "retry_once"


def test_the_second_retry_is_refused():
    decision = RecoveryPolicy().decide(idempotent(), retries_used=1)
    assert not decision.permits_retry
    assert decision.outcome == "refuse_budget_exhausted"


def test_a_write_is_never_retried_however_transient_it_looks():
    # The permission is keyed on the side-effect class, so a tool that writes
    # cannot inherit retry permission by being added to a list.
    decision = RecoveryPolicy().decide(
        idempotent(side_effect_class="external_write"), retries_used=0
    )
    assert not decision.permits_retry
    assert decision.outcome == "refuse_not_idempotent"


def test_a_permanent_failure_is_not_retried():
    decision = RecoveryPolicy().decide(idempotent(retryable=False), retries_used=0)
    assert decision.outcome == "refuse_not_retryable"


def test_every_refusal_explains_itself():
    for retries_used, incident in [(1, idempotent()), (0, idempotent(retryable=False))]:
        assert RecoveryPolicy().decide(incident, retries_used=retries_used).rationale
