"""The scenario the demo tells, as a pure function over injected ports.

    Start -> Delegate -> Tool failure -> Warden retry -> Result

# Why the whole story is pure

Every port is injected: the clock, the transport, the tool, the policy. So the
five beats above can be asserted exactly, with no SDK, no key, no network and no
cost, and `agents.py` only has to wire a real runtime to the same ports.

# Why the intervention is recorded before it is executed

The ledger's rule is that an idempotency key is persisted BEFORE the external
request, so a crash between deciding and acting cannot produce a second attempt.
The event order here follows that rule rather than describing it: the
`intervention` record is emitted, then the retry runs.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .contract import EventStream, Truth
from .recovery import Incident, PolicyDecision, RecoveryPolicy
from .tools import RepositoryFacts, RepositoryMetadataTool, TargetNotAllowed, ToolFailure


@dataclass(frozen=True)
class SessionOutcome:
    terminal_result: str
    facts: RepositoryFacts | None
    retries_used: int
    decision: PolicyDecision | None


def run_dependency_onboarding(
    *,
    stream: EventStream,
    tool: RepositoryMetadataTool,
    target: str,
    idempotency_key: str,
    policy: RecoveryPolicy | None = None,
    root_agent: str = "dependency_onboarding",
    delegated_agent: str = "security_review",
    evidence_truth: Truth = "recorded",
) -> SessionOutcome:
    """`evidence_truth` defaults to `recorded` because this function observes no
    runtime. Nothing here may be labelled `live`: a deterministic replay that
    claimed to be a live observation would be the single most misleading thing
    the system could record."""
    policy = policy or RecoveryPolicy()
    stream.emit(agent=root_agent, kind="run_start", truth=evidence_truth, payload={"target": target})
    stream.emit(agent=root_agent, kind="agent_start", truth=evidence_truth)
    stream.emit(
        agent=root_agent,
        kind="delegation",
        truth=evidence_truth,
        payload={"to": delegated_agent, "reason": "security review of a new dependency"},
    )
    stream.emit(agent=delegated_agent, kind="agent_start", truth=evidence_truth)

    retries_used = 0
    decision: PolicyDecision | None = None

    while True:
        stream.emit(
            agent=delegated_agent,
            kind="tool_call",
            truth=evidence_truth,
            payload={
                "tool": tool.name,
                "target": target,
                "idempotencyKey": idempotency_key,
                "attempt": tool.attempts_for(idempotency_key) + 1,
            },
        )
        try:
            facts = tool.read(target, idempotency_key=idempotency_key)
        except TargetNotAllowed as refusal:
            # A policy refusal is not an incident and is never retried: nothing
            # about trying again would make a disallowed target allowed.
            stream.emit(
                agent=delegated_agent,
                kind="tool_result",
                truth=evidence_truth,
                payload={"tool": tool.name, "status": "refused", "reason": str(refusal)},
            )
            _close(stream, root_agent, delegated_agent, "failed", evidence_truth)
            return SessionOutcome("failed", None, retries_used, None)
        except ToolFailure as failure:
            # The failure's own truth label rides on the record, so a controlled
            # fault can never be read as an observed outage.
            stream.emit(
                agent=delegated_agent,
                kind="tool_result",
                truth=failure.truth,
                payload={"tool": tool.name, "status": "failed", "reason": failure.message},
            )
            incident = Incident(
                tool=tool.name,
                reason=failure.message,
                truth=failure.truth,
                retryable=failure.retryable,
                side_effect_class=tool.side_effect_class,
            )
            stream.emit(
                agent=delegated_agent,
                kind="incident",
                truth=failure.truth,
                payload={
                    "tool": incident.tool,
                    "reason": incident.reason,
                    "sideEffectClass": incident.side_effect_class,
                    "retryable": incident.retryable,
                },
            )
            decision = policy.decide(incident, retries_used=retries_used)
            stream.emit(
                agent="warden",
                kind="intervention",
                truth=evidence_truth,
                payload={
                    "outcome": decision.outcome,
                    "rationale": decision.rationale,
                    # The SAME key as the first attempt: the retry continues one
                    # logical operation rather than starting a second.
                    "idempotencyKey": idempotency_key,
                    "retriesUsed": retries_used,
                    "maxRetries": policy.max_retries,
                },
            )
            if not decision.permits_retry:
                _close(stream, root_agent, delegated_agent, "failed", evidence_truth)
                return SessionOutcome("failed", None, retries_used, decision)
            retries_used += 1
            continue

        stream.emit(
            agent=delegated_agent,
            kind="tool_result",
            truth=evidence_truth,
            payload={"tool": tool.name, "status": "ok", **facts.to_payload()},
        )
        _close(stream, root_agent, delegated_agent, "succeeded", evidence_truth)
        return SessionOutcome("succeeded", facts, retries_used, decision)


def _close(
    stream: EventStream,
    root_agent: str,
    delegated_agent: str,
    result: str,
    evidence_truth: Truth,
) -> None:
    stream.emit(agent=delegated_agent, kind="agent_end", truth=evidence_truth)
    stream.emit(agent=root_agent, kind="agent_end", truth=evidence_truth)
    stream.emit(
        agent=root_agent, kind="run_end", truth=evidence_truth, payload={"terminalResult": result}
    )


def story_beats(stream: EventStream) -> list[dict[str, Any]]:
    """The five beats the Story UI shows, derived from the events themselves.

    Derived rather than narrated: if the run did not retry, no retry beat
    appears, so the UI cannot claim a recovery that did not happen.
    """
    wanted = {
        "run_start": "Start",
        "delegation": "Delegate",
        "incident": "Tool failure",
        "intervention": "Warden retry",
        "run_end": "Result",
    }
    return [
        {
            "beat": wanted[event.kind],
            "sequence": event.sequence,
            "truth": event.truth,
            "agent": event.agent,
        }
        for event in stream
        if event.kind in wanted
    ]
