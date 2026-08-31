"""The worker's wire contract.

# Why the schema is versioned in every record

The worker writes to an append-only ledger that outlives it. A reader three
versions later must be able to tell what it is holding without guessing from
shape, so the version travels on the record rather than in a filename.

# Why `sequence` is the key

`sequence` is assigned here, monotonically, and is the ONLY identity a consumer
may order or address events by. Timestamps collide and are not monotonic across
a process boundary; a runtime's own event id is not unique in practice. The
viewer already learned this the hard way and keys on sequence alone.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Callable, Iterator, Literal, Mapping

SCHEMA = "fleetscope.worker.v1"

EventKind = Literal[
    "run_start",
    "agent_start",
    "agent_end",
    "model_call",
    "delegation",
    "tool_call",
    "tool_result",
    "incident",
    "intervention",
    "run_end",
]

#: How a record was produced. Never inferred, never defaulted to something
#: flattering: an unobserved outcome is `unknown`, not `live`.
Truth = Literal["live", "controlled_fault", "recorded", "unknown"]

TRUTH_VALUES: frozenset[str] = frozenset(
    {"live", "controlled_fault", "recorded", "unknown"}
)


@dataclass(frozen=True)
class WorkerEvent:
    """One canonical fact about a run."""

    sequence: int
    run_id: str
    correlation_id: str
    ts: str
    agent: str
    kind: EventKind
    truth: Truth
    payload: Mapping[str, Any]

    def to_wire(self) -> dict[str, Any]:
        return {
            "schema": SCHEMA,
            "sequence": self.sequence,
            "runId": self.run_id,
            "correlationId": self.correlation_id,
            "ts": self.ts,
            "agent": self.agent,
            "kind": self.kind,
            "truth": self.truth,
            "payload": dict(self.payload),
        }

    def to_json(self) -> str:
        # `sort_keys` so two runs of the same scenario diff cleanly, and
        # `ensure_ascii=False` so a non-ASCII repository name survives intact.
        return json.dumps(self.to_wire(), sort_keys=True, ensure_ascii=False)


class EventStream:
    """Assigns sequence numbers and hands finished events to a sink.

    The clock is injected. A worker that read the wall clock directly could not
    be replayed, and replay determinism is the property the judge check rests on.
    """

    def __init__(
        self,
        *,
        run_id: str,
        correlation_id: str,
        clock: Callable[[], str],
        sink: Callable[[WorkerEvent], None] | None = None,
        start_sequence: int = 0,
    ) -> None:
        """`start_sequence` continues an existing run's numbering.

        A run driven through MCP is a series of separate tool calls in separate
        processes. Each one must pick up where the ledger left off, or the
        sequence would restart at 1 and the cursor a browser polls with would
        silently skip or duplicate events.
        """
        self._run_id = run_id
        self._correlation_id = correlation_id
        self._clock = clock
        self._sink = sink
        self._sequence = start_sequence
        self._events: list[WorkerEvent] = []

    def emit(
        self,
        *,
        agent: str,
        kind: EventKind,
        truth: Truth,
        payload: Mapping[str, Any] | None = None,
    ) -> WorkerEvent:
        if truth not in TRUTH_VALUES:
            # A mislabelled record is worse than a missing one: it is evidence
            # that lies. Refuse at the boundary rather than write it.
            raise ValueError(f"unknown truth label {truth!r}")
        self._sequence += 1
        event = WorkerEvent(
            sequence=self._sequence,
            run_id=self._run_id,
            correlation_id=self._correlation_id,
            ts=self._clock(),
            agent=agent,
            kind=kind,
            truth=truth,
            payload=dict(payload or {}),
        )
        self._events.append(event)
        if self._sink is not None:
            self._sink(event)
        return event

    def __iter__(self) -> Iterator[WorkerEvent]:
        return iter(self._events)

    @property
    def events(self) -> tuple[WorkerEvent, ...]:
        return tuple(self._events)
