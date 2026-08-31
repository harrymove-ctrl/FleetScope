"""Runtime callbacks in, canonical FleetScope events out.

# Why this module does not import google.adk

The callbacks are duck-typed. A capture layer that imported the SDK could only
be tested with the SDK installed, an API key present and, for the model hooks, a
real call. Keeping it structural means the entire translation is provable at
zero cost, and it keeps the vendor's event vocabulary from becoming FleetScope's.

# Why the budget lives here

`before_model` is the last point before a metered call. Refusing here is the
only place the refusal cannot be bypassed by another code path, so the ceiling
is enforced at the callback rather than counted after the fact.
"""

from __future__ import annotations

from typing import Any, Mapping

from .contract import EventStream
from .redact import redact_mapping


class ModelBudgetExceeded(Exception):
    """The run asked for one more model call than it is allowed."""


class ModelBudget:
    """A hard ceiling on metered calls, counted BEFORE the call is issued.

    Counting after would undercount exactly the case that matters: a call that
    was issued, cost money, and then failed.
    """

    def __init__(self, limit: int) -> None:
        if limit < 0:
            raise ValueError("limit must not be negative")
        self._limit = limit
        self._used = 0

    @property
    def used(self) -> int:
        return self._used

    @property
    def limit(self) -> int:
        return self._limit

    def reserve(self) -> int:
        if self._used >= self._limit:
            raise ModelBudgetExceeded(
                f"refused: this run has already issued {self._used} of {self._limit} model call(s)"
            )
        self._used += 1
        return self._used


def _agent_name(context: Any, fallback: str = "unknown") -> str:
    """ADK passes a context object; different versions expose the name in
    different places. Read what is there and fall back to a named unknown
    rather than inventing an agent that did not run."""
    for attribute in ("agent_name", "name"):
        value = getattr(context, attribute, None)
        if isinstance(value, str) and value:
            return value
    agent = getattr(context, "agent", None)
    name = getattr(agent, "name", None)
    return name if isinstance(name, str) and name else fallback


class CallbackCapture:
    """Binds an `EventStream` and a `ModelBudget` to a runtime's callbacks."""

    def __init__(self, stream: EventStream, budget: ModelBudget) -> None:
        self._stream = stream
        self._budget = budget

    # ── agent lifecycle ──────────────────────────────────────────────────────

    def before_agent(self, context: Any) -> None:
        self._stream.emit(agent=_agent_name(context), kind="agent_start", truth="live")

    def after_agent(self, context: Any) -> None:
        self._stream.emit(agent=_agent_name(context), kind="agent_end", truth="live")

    # ── model ────────────────────────────────────────────────────────────────

    def before_model(
        self,
        *args: Any,
        callback_context: Any = None,
        llm_request: Any = None,
        **_kwargs: Any,
    ) -> None:
        # ADK 2.8 calls this as before_model(callback_context=..., llm_request=...).
        # Local tests still pass the context positionally.
        context = callback_context if callback_context is not None else (args[0] if args else None)
        _ = llm_request if llm_request is not None else (args[1] if len(args) > 1 else None)
        used = self._budget.reserve()
        self._stream.emit(
            agent=_agent_name(context),
            kind="model_call",
            truth="live",
            payload={"call": used, "limit": self._budget.limit},
        )

    # ── tools ────────────────────────────────────────────────────────────────

    def before_tool(self, tool: Any, args: Mapping[str, Any], context: Any) -> None:
        self._stream.emit(
            agent=_agent_name(context),
            kind="tool_call",
            truth="live",
            payload={
                "tool": getattr(tool, "name", str(tool)),
                # Never verbatim: a tool argument is model output and may carry
                # anything the model decided to put there.
                "args": redact_mapping(args, allow=frozenset({"target"})),
            },
        )

    def after_tool(
        self, tool: Any, args: Mapping[str, Any], context: Any, response: Any
    ) -> None:
        self._stream.emit(
            agent=_agent_name(context),
            kind="tool_result",
            truth="live",
            payload={
                "tool": getattr(tool, "name", str(tool)),
                "response": redact_mapping(
                    response,
                    allow=frozenset(
                        {"target", "defaultBranch", "stars", "archived", "license", "status", "truth"}
                    ),
                ),
            },
        )
