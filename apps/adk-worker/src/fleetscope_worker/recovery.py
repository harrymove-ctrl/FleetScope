"""Incident detection, policy, and the bounded Warden retry.

# Why this is FleetScope's code and not the runtime's

A retry the SDK performs internally is invisible: it produces no incident, no
policy decision and no evidence, so there is nothing to audit and nothing to
show. The recovery loop is therefore ours, it is pure, and every step of it
emits a record.

# Why the policy checks the side-effect class rather than the tool name

"Retry once" is only safe for an operation that can be repeated without changing
the world. Keying the permission on the declared side-effect class means adding
a tool that writes cannot silently inherit retry permission by being added to a
list someone forgot to review.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

RETRYABLE_SIDE_EFFECTS: frozenset[str] = frozenset({"idempotent_read"})

PolicyOutcome = Literal["retry_once", "refuse_not_idempotent", "refuse_budget_exhausted",
                        "refuse_not_retryable"]


@dataclass(frozen=True)
class Incident:
    """A detected failure, carrying the truth label of what produced it."""

    tool: str
    reason: str
    truth: str
    retryable: bool
    side_effect_class: str


@dataclass(frozen=True)
class PolicyDecision:
    outcome: PolicyOutcome
    rationale: str

    @property
    def permits_retry(self) -> bool:
        return self.outcome == "retry_once"


@dataclass(frozen=True)
class RecoveryPolicy:
    """A bounded, explicit recovery permission."""

    max_retries: int = 1

    def decide(self, incident: Incident, *, retries_used: int) -> PolicyDecision:
        if incident.side_effect_class not in RETRYABLE_SIDE_EFFECTS:
            return PolicyDecision(
                "refuse_not_idempotent",
                f"{incident.side_effect_class!r} may change state; a retry is not safe",
            )
        if not incident.retryable:
            return PolicyDecision(
                "refuse_not_retryable",
                f"{incident.tool} reported a permanent failure",
            )
        if retries_used >= self.max_retries:
            return PolicyDecision(
                "refuse_budget_exhausted",
                f"already used {retries_used} of {self.max_retries} permitted retry(ies)",
            )
        return PolicyDecision(
            "retry_once",
            f"{incident.side_effect_class} is repeatable; one retry is within policy",
        )
