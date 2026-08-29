"""The real Google ADK execution boundary.

This module and `agents.py` are the only two that import `google.adk`.

# What "real" means here, and how it is tested without spending money

`AdkRuntime` builds the agent tree, creates an ADK session, invokes
`Runner.run_async`, and translates the `google.adk.events.Event` objects it
yields into FleetScope evidence. Every one of those steps is this module's own
code, so all of it can be exercised by injecting a runner factory that returns a
fake runner yielding REAL `Event` objects. The tests therefore drive the actual
translation and the actual boundary call; only the model is absent.

The signatures below were read from google-adk 2.8.0 itself:

    Runner(app_name=..., agent=..., session_service=...)
    await session_service.create_session(app_name=..., user_id=..., session_id=...)
    runner.run_async(user_id=..., session_id=..., new_message=...) -> AsyncGenerator[Event]

# Why evidence comes from the Event stream and not from callbacks

Binding both would record every tool call twice, once from `before_tool` and
once from the event's `function_call` part. The Event stream is the runtime's
own account of what happened, so it is the single evidence source. The one
callback still bound is `before_model`, because a budget refusal has to happen
*before* the call and an event arrives after it.
"""

from __future__ import annotations

import asyncio
from typing import Any, AsyncIterator, Callable, Protocol

from google.adk.events import Event
from google.genai import types

from .agents import build_agents
from .capture import ModelBudget, ModelBudgetExceeded
from .contract import EventStream
from .redact import redact_mapping
from .runtime import RunPlan, RuntimeOutcome
from .tools import RepositoryMetadataTool

#: Tool argument keys that may be recorded verbatim. Everything else is counted.
SAFE_TOOL_ARGS: frozenset[str] = frozenset({"target"})
#: Tool response keys that may be recorded verbatim.
SAFE_TOOL_RESULT: frozenset[str] = frozenset(
    {"target", "defaultBranch", "stars", "archived", "license", "status", "truth"}
)


class SessionServiceLike(Protocol):
    async def create_session(
        self, *, app_name: str, user_id: str, session_id: str | None = None
    ) -> Any: ...


class RunnerLike(Protocol):
    def run_async(
        self, *, user_id: str, session_id: str, new_message: Any
    ) -> AsyncIterator[Event]: ...


#: (agent, session_service, app_name) -> runner. Injected so a test can supply a
#: runner that yields real Event objects without a model behind it.
RunnerFactory = Callable[[Any, SessionServiceLike, str], RunnerLike]


def production_runner_factory(
    agent: Any, session_service: SessionServiceLike, app_name: str
) -> RunnerLike:
    from google.adk.runners import Runner

    return Runner(app_name=app_name, agent=agent, session_service=session_service)


def production_session_service() -> SessionServiceLike:
    from google.adk.sessions import InMemorySessionService

    return InMemorySessionService()


class AdkRuntime:
    """Executes the scenario on a real ADK runtime."""

    def __init__(
        self,
        *,
        runner_factory: RunnerFactory = production_runner_factory,
        session_service: SessionServiceLike | None = None,
        user_id: str = "fleetscope-local",
    ) -> None:
        self._runner_factory = runner_factory
        self._session_service = session_service
        self._user_id = user_id

    def execute(
        self, plan: RunPlan, stream: EventStream, tool: RepositoryMetadataTool
    ) -> RuntimeOutcome:
        return asyncio.run(self._execute(plan, stream, tool))

    async def _execute(
        self, plan: RunPlan, stream: EventStream, tool: RepositoryMetadataTool
    ) -> RuntimeOutcome:
        scenario = plan.scenario
        budget = ModelBudget(scenario.max_model_calls)
        session_service = self._session_service or production_session_service()

        root = build_agents(
            model=plan.model,
            stream=stream,
            tool=tool,
            idempotency_key=f"{plan.request.run_id}:{scenario.recovery_action}:1",
            budget=budget,
        )
        runner = self._runner_factory(root, session_service, scenario.id)

        stream.emit(
            agent=scenario.root_agent,
            kind="run_start",
            truth="live",
            payload={"target": scenario.target, "model": plan.model, "runtime": "google-adk"},
        )

        await session_service.create_session(
            app_name=scenario.id,
            user_id=self._user_id,
            session_id=plan.request.session_id,
        )

        # Server-owned instruction. The caller cannot supply a prompt.
        message = types.Content(
            role="user",
            parts=[
                types.Part.from_text(
                    text=(
                        f"Onboard the dependency {scenario.target}. Delegate the security "
                        f"review to the {scenario.delegated_agent} agent."
                    )
                )
            ],
        )

        state = _Translation(scenario=scenario, stream=stream)
        try:
            await asyncio.wait_for(
                self._drain(runner, plan, message, state), timeout=scenario.timeout_s
            )
        except asyncio.TimeoutError:
            return self._close(
                stream, scenario, state, budget, "timed_out", "the runtime did not finish in time"
            )
        except ModelBudgetExceeded as refusal:
            return self._close(stream, scenario, state, budget, "failed", str(refusal))
        except Exception as crash:  # noqa: BLE001 - a crash must become evidence, not a traceback
            # The message is redacted: an exception from a runtime can carry a
            # request body, and this string is about to be persisted.
            return self._close(
                stream,
                scenario,
                state,
                budget,
                "failed",
                f"the runtime raised {type(crash).__name__}",
            )

        if not state.delegated:
            # The whole claim of this scenario is that a root agent delegated.
            # Without that observation the run is incomplete, never a success.
            return self._close(
                stream,
                scenario,
                state,
                budget,
                "incomplete",
                "no delegation to the sub-agent was observed",
            )
        if state.errored:
            return self._close(stream, scenario, state, budget, "failed", state.error_detail)
        if not state.read_succeeded:
            return self._close(
                stream,
                scenario,
                state,
                budget,
                "incomplete",
                "the delegated agent produced no successful tool result",
            )
        return self._close(stream, scenario, state, budget, "succeeded", "")

    async def _drain(
        self, runner: RunnerLike, plan: RunPlan, message: Any, state: _Translation
    ) -> None:
        async for event in runner.run_async(
            user_id=self._user_id,
            session_id=plan.request.session_id,
            new_message=message,
        ):
            state.absorb(event)

    def _close(
        self,
        stream: EventStream,
        scenario: Any,
        state: _Translation,
        budget: ModelBudget,
        result: str,
        detail: str,
    ) -> RuntimeOutcome:
        stream.emit(
            agent=scenario.root_agent,
            kind="run_end",
            # An outcome the runtime did not let us observe is `unknown`, not a
            # live claim about what happened.
            truth="live" if result in {"succeeded", "failed"} else "unknown",
            payload={"terminalResult": result, "detail": detail, "delegated": state.delegated},
        )
        return RuntimeOutcome(
            terminal_result=result,
            delegated=state.delegated,
            model_calls=budget.used,
            detail=detail,
        )


class _Translation:
    """Turns ADK Events into FleetScope evidence, and remembers what it saw."""

    def __init__(self, *, scenario: Any, stream: EventStream) -> None:
        self._scenario = scenario
        self._stream = stream
        self._started: set[str] = set()
        self.delegated = False
        self.errored = False
        self.error_detail = ""
        self.read_succeeded = False

    def absorb(self, event: Event) -> None:
        # A streaming fragment repeats text the final event also carries.
        if getattr(event, "partial", False):
            return

        author = getattr(event, "author", None) or "unknown"
        branch = getattr(event, "branch", None) or ""

        if author not in self._started:
            self._started.add(author)
            self._stream.emit(agent=author, kind="agent_start", truth="live")

        # Delegation is recorded the first time the sub-agent speaks, or the
        # first time a branch names it. Both are the runtime's own account.
        delegated_name = self._scenario.delegated_agent
        if not self.delegated and (author == delegated_name or delegated_name in branch.split(".")):
            self.delegated = True
            self._stream.emit(
                agent=self._scenario.root_agent,
                kind="delegation",
                truth="live",
                payload={"to": delegated_name, "branch": branch},
            )

        error_code = getattr(event, "error_code", None)
        if error_code:
            self.errored = True
            self.error_detail = f"runtime reported {error_code}"
            self._stream.emit(
                agent=author,
                kind="incident",
                truth="live",
                payload={"errorCode": str(error_code)},
            )

        for part in self._parts(event):
            self._absorb_part(author, part)

        if getattr(event, "turn_complete", False):
            self._stream.emit(agent=author, kind="agent_end", truth="live")

    def _parts(self, event: Event) -> list[Any]:
        content = getattr(event, "content", None)
        parts = getattr(content, "parts", None) if content is not None else None
        return list(parts or [])

    def _absorb_part(self, author: str, part: Any) -> None:
        # Model reasoning is dropped at ingestion, before it can reach a label,
        # a payload or a ledger.
        if getattr(part, "thought", False):
            return

        call = getattr(part, "function_call", None)
        if call is not None:
            self._stream.emit(
                agent=author,
                kind="tool_call",
                truth="live",
                payload={
                    "tool": getattr(call, "name", "unknown"),
                    "args": redact_mapping(getattr(call, "args", None), allow=SAFE_TOOL_ARGS),
                },
            )
            return

        response = getattr(part, "function_response", None)
        if response is not None:
            body = getattr(response, "response", None)
            redacted = redact_mapping(body, allow=SAFE_TOOL_RESULT)
            status = redacted.get("status")
            if status is None or status == "ok":
                self.read_succeeded = True
            self._stream.emit(
                agent=author,
                kind="tool_result",
                truth="controlled_fault" if redacted.get("truth") == "controlled_fault" else "live",
                payload={"tool": getattr(response, "name", "unknown"), "response": redacted},
            )
