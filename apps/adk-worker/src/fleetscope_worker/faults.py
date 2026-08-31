"""Deliberate failures, and the rule that they must announce themselves.

# Why a fault is a first-class object rather than a flag

The demo needs a tool failure it can rely on, because a recovery story that
depends on a real outage happening on cue is not a story you can record. The
danger is that an injected failure becomes indistinguishable from a real one and
the evidence quietly overstates what was observed.

So a controlled fault is never anonymous. It carries its own truth label, that
label rides on every event it produces, and `ControlledFault.describe()` is the
text the UI shows. A viewer can always tell "we broke this on purpose" from
"this broke".
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ControlledFault:
    """Fails the first `fails_attempts` attempts, then stops interfering."""

    fails_attempts: int
    reason: str = "injected transient tool unavailability"

    def __post_init__(self) -> None:
        if self.fails_attempts < 0:
            raise ValueError("fails_attempts must not be negative")

    def applies_to(self, attempt: int) -> bool:
        """`attempt` is 1-based, as a human counts tries."""
        return attempt <= self.fails_attempts

    def describe(self) -> str:
        return f"Controlled Fault: {self.reason} (first {self.fails_attempts} attempt(s))"
