"""The real ADK boundary, driven without a model.

# Why these tests are evidence and not theatre

The fake here is the *Runner*, not the runtime. `AdkRuntime` under test does its
own real work: it builds the agent tree with `google.adk.agents.LlmAgent`,
creates an ADK session, calls `run_async`, and translates the
`google.adk.events.Event` objects it receives. The events are real ADK objects.
Only the model behind the Runner is absent, which is the only part that costs
money.

An earlier version of this worker emitted delegation events from a scripted
function and called that "real ADK". These tests are written so that could not
pass: they assert on the agent tree the boundary received and on the translation
of genuine `Event` instances.
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest
from conftest import FakeHttp
from google.adk.events import Event
from google.genai import types

from fleetscope_worker.adk_runtime import AdkRuntime
from fleetscope_worker.contract import EventStream
from fleetscope_worker.request import RunRequest
from fleetscope_worker.runtime import RunPlan
from fleetscope_worker.scenario import DEPENDENCY_ONBOARDING
from fleetscope_worker.tools import RepositoryMetadataTool

# ── the fakes: an ADK-shaped Runner and session service ─────────────────────


class FakeSessionService:
    def __init__(self) -> None:
        self.created: list[dict[str, Any]] = []

    async def create_session(
        self, *, app_name: str, user_id: str, session_id: str | None = None
    ) -> Any:
        self.created.append({"app_name": app_name, "user_id": user_id, "session_id": session_id})
        return object()


class FakeRunner:
    """Yields real `Event` objects, or fails, exactly as a Runner may."""

    def __init__(
        self,
        events: list[Event],
        *,
        raises: Exception | None = None,
        hang: bool = False,
    ) -> None:
        self._events = events
        self._raises = raises
        self._hang = hang
        self.calls: list[dict[str, Any]] = []

    def run_async(self, *, user_id: str, session_id: str, new_message: Any):
        self.calls.append(
            {"user_id": user_id, "session_id": session_id, "message": new_message}
        )

        async def generate():
            if self._hang:
                await asyncio.sleep(3600)
            for event in self._events:
                yield event
            if self._raises is not None:
                raise self._raises

        return generate()


def text_event(author: str, text: str, **kw: Any) -> Event:
    return Event(
        author=author, content=types.Content(role="model", parts=[types.Part(text=text)]), **kw
    )


def call_event(author: str, args: dict[str, Any], **kw: Any) -> Event:
    return Event(
        author=author,
        content=types.Content(
            role="model",
            parts=[
                types.Part(
                    function_call=types.FunctionCall(name="read_repository_metadata", args=args)
                )
            ],
        ),
        **kw,
    )


def response_event(author: str, response: dict[str, Any], **kw: Any) -> Event:
    return Event(
        author=author,
        content=types.Content(
            role="user",
            parts=[
                types.Part(
                    function_response=types.FunctionResponse(
                        name="read_repository_metadata", response=response
                    )
                )
            ],
        ),
        **kw,
    )


ROOT = DEPENDENCY_ONBOARDING.root_agent
CHILD = DEPENDENCY_ONBOARDING.delegated_agent
BRANCH = f"{ROOT}.{CHILD}"


def happy_events() -> list[Event]:
    return [
        text_event(ROOT, "I will delegate the security review."),
        call_event(CHILD, {"target": DEPENDENCY_ONBOARDING.target}, branch=BRANCH),
        response_event(
            CHILD,
            {"status": "ok", "target": DEPENDENCY_ONBOARDING.target, "stars": 21319},
            branch=BRANCH,
        ),
        text_event(ROOT, "Review complete.", turn_complete=True),
    ]


def drive(
    events: list[Event] | None = None,
    *,
    raises: Exception | None = None,
    hang: bool = False,
    timeout_s: float | None = None,
):
    """Run AdkRuntime against a fake Runner and return everything observed."""
    captured: dict[str, Any] = {}
    runner = FakeRunner(events if events is not None else happy_events(), raises=raises, hang=hang)
    sessions = FakeSessionService()

    def factory(agent: Any, session_service: Any, app_name: str) -> FakeRunner:
        captured["agent"] = agent
        captured["app_name"] = app_name
        captured["session_service"] = session_service
        return runner

    scenario = DEPENDENCY_ONBOARDING
    if timeout_s is not None:
        scenario = type(scenario)(**{**scenario.__dict__, "timeout_s": timeout_s})

    stream = EventStream(
        run_id="run-1", correlation_id="corr-1", clock=lambda: "2026-08-29T12:00:00.000Z"
    )
    plan = RunPlan(
        request=RunRequest(
            run_id="run-1",
            session_id="sess-1",
            correlation_id="corr-1",
            scenario_id=scenario.id,
            mode="adk",
        ),
        scenario=scenario,
        model="gemini-3.7-flash",
    )
    outcome = AdkRuntime(runner_factory=factory, session_service=sessions).execute(
        plan, stream, RepositoryMetadataTool(FakeHttp(), allowlist=frozenset({scenario.target}))
    )
    return outcome, stream, runner, sessions, captured


# ── the boundary is genuinely invoked ───────────────────────────────────────


def test_the_runner_is_built_with_a_real_adk_agent_tree():
    _, _, _, _, captured = drive()
    agent = captured["agent"]
    assert type(agent).__module__.startswith("google.adk"), type(agent)
    assert agent.name == ROOT
    assert [child.name for child in agent.sub_agents] == [CHILD]


def test_the_delegated_agent_carries_the_allowlisted_tool():
    _, _, _, _, captured = drive()
    review = captured["agent"].sub_agents[0]
    assert [tool.name for tool in review.tools] == ["read_repository_metadata"]


def test_an_adk_session_is_created_before_the_run():
    _, _, _, sessions, _ = drive()
    assert sessions.created == [
        {"app_name": DEPENDENCY_ONBOARDING.id, "user_id": "fleetscope-local", "session_id": "sess-1"}
    ]


def test_run_async_is_called_with_the_session_and_a_server_owned_message():
    _, _, runner, _, _ = drive()
    assert len(runner.calls) == 1
    call = runner.calls[0]
    assert call["session_id"] == "sess-1"
    # The instruction is built from the scenario, never from a caller field.
    assert DEPENDENCY_ONBOARDING.target in call["message"].parts[0].text


# ── translation of genuine ADK events ───────────────────────────────────────


def test_delegation_is_recorded_from_the_runtimes_own_events():
    outcome, stream, _, _, _ = drive()
    assert outcome.delegated is True
    delegation = next(e for e in stream if e.kind == "delegation")
    assert delegation.payload["to"] == CHILD
    assert delegation.truth == "live"


def test_a_successful_run_reports_succeeded():
    outcome, _, _, _, _ = drive()
    assert outcome.terminal_result == "succeeded"


def test_a_run_without_delegation_is_incomplete_and_never_succeeded():
    # The claim of this scenario IS the delegation. Without it there is nothing
    # to report but an incomplete run.
    outcome, stream, _, _, _ = drive(
        [
            text_event(ROOT, "I handled it myself."),
            text_event(ROOT, "Done.", turn_complete=True),
        ]
    )
    assert outcome.terminal_result == "incomplete"
    assert outcome.delegated is False
    end = next(e for e in stream if e.kind == "run_end")
    assert end.truth == "unknown", "an unobserved outcome must not be labelled live"


def test_delegation_without_a_successful_tool_result_is_incomplete():
    outcome, _, _, _, _ = drive(
        [
            call_event(CHILD, {"target": DEPENDENCY_ONBOARDING.target}, branch=BRANCH),
            text_event(ROOT, "Done.", turn_complete=True),
        ]
    )
    assert outcome.terminal_result == "incomplete"


def test_a_runtime_error_code_becomes_an_incident_and_a_failure():
    outcome, stream, _, _, _ = drive(
        [
            call_event(CHILD, {"target": DEPENDENCY_ONBOARDING.target}, branch=BRANCH),
            response_event(CHILD, {"status": "ok"}, branch=BRANCH),
            Event(author=CHILD, error_code="MALFUNCTION", branch=BRANCH),
        ]
    )
    assert outcome.terminal_result == "failed"
    assert any(e.kind == "incident" for e in stream)


def test_a_streaming_fragment_is_not_recorded_twice():
    outcome, stream, _, _, _ = drive(
        [
            text_event(ROOT, "partial...", partial=True),
            *happy_events(),
        ]
    )
    assert outcome.terminal_result == "succeeded"
    assert [e.kind for e in stream].count("run_start") == 1


def test_model_reasoning_never_reaches_the_evidence():
    events = [
        Event(
            author=ROOT,
            content=types.Content(
                role="model", parts=[types.Part(text="my hidden plan", thought=True)]
            ),
        ),
        *happy_events(),
    ]
    _, stream, _, _, _ = drive(events)
    assert "my hidden plan" not in "".join(e.to_json() for e in stream)


# ── redaction of what the runtime handed us ─────────────────────────────────


def test_a_secret_in_a_tool_argument_is_never_written_down():
    _, stream, _, _, _ = drive(
        [
            call_event(
                CHILD,
                {"target": DEPENDENCY_ONBOARDING.target, "api_key": "sk-abc123456789012345"},
                branch=BRANCH,
            ),
            response_event(CHILD, {"status": "ok"}, branch=BRANCH),
            text_event(ROOT, "done", turn_complete=True),
        ]
    )
    transcript = "".join(event.to_json() for event in stream)
    assert "sk-abc123456789012345" not in transcript
    call = next(e for e in stream if e.kind == "tool_call")
    assert call.payload["args"]["target"] == DEPENDENCY_ONBOARDING.target
    assert call.payload["args"]["redactedFields"] == 1


def test_a_secret_in_a_tool_response_is_never_written_down():
    _, stream, _, _, _ = drive(
        [
            call_event(CHILD, {"target": DEPENDENCY_ONBOARDING.target}, branch=BRANCH),
            response_event(
                CHILD,
                {"status": "ok", "stars": 3, "authorization": "Bearer ghp_supersecretvalue"},
                branch=BRANCH,
            ),
            text_event(ROOT, "done", turn_complete=True),
        ]
    )
    transcript = "".join(event.to_json() for event in stream)
    assert "ghp_supersecretvalue" not in transcript
    assert "Bearer" not in transcript


def test_a_controlled_fault_response_keeps_its_label():
    _, stream, _, _, _ = drive(
        [
            call_event(CHILD, {"target": DEPENDENCY_ONBOARDING.target}, branch=BRANCH),
            response_event(
                CHILD, {"status": "failed", "truth": "controlled_fault"}, branch=BRANCH
            ),
            response_event(CHILD, {"status": "ok"}, branch=BRANCH),
            text_event(ROOT, "done", turn_complete=True),
        ]
    )
    faulted = [e for e in stream if e.kind == "tool_result" and e.truth == "controlled_fault"]
    assert len(faulted) == 1


# ── failure truth ───────────────────────────────────────────────────────────


def test_a_hanging_runtime_times_out_rather_than_hanging_the_worker():
    outcome, stream, _, _, _ = drive(hang=True, timeout_s=0.05)
    assert outcome.terminal_result == "timed_out"
    assert next(e for e in stream if e.kind == "run_end").truth == "unknown"


def test_a_crashing_runtime_becomes_a_failure_not_a_traceback():
    outcome, _, _, _, _ = drive(raises=RuntimeError("connection reset by peer"))
    assert outcome.terminal_result == "failed"


def test_a_crash_message_is_not_copied_into_the_evidence():
    # An exception from a runtime can carry a request body. The type is enough
    # to diagnose; the message is not ours to persist.
    outcome, stream, _, _, _ = drive(raises=RuntimeError("token=ghp_leakedsecretvalue"))
    assert "ghp_leakedsecretvalue" not in "".join(e.to_json() for e in stream)
    assert "ghp_leakedsecretvalue" not in outcome.detail


def test_every_emitted_event_carries_the_run_and_correlation_id():
    _, stream, _, _, _ = drive()
    assert {e.run_id for e in stream} == {"run-1"}
    assert {e.correlation_id for e in stream} == {"corr-1"}


def test_events_are_ordered_by_a_dense_sequence():
    _, stream, _, _, _ = drive()
    assert [e.sequence for e in stream] == list(range(1, len(stream.events) + 1))


@pytest.mark.parametrize("kind", ["run_start", "delegation", "tool_call", "tool_result", "run_end"])
def test_the_five_load_bearing_records_are_present(kind: str):
    _, stream, _, _, _ = drive()
    assert any(event.kind == kind for event in stream), kind
