"""What a run is allowed to do, decided here and not by the caller.

# Why every knob lives in this file

The request contract carries identifiers only. Target, model, retry budget,
fault policy and call ceiling are all declared here, in server source, because
each of them either spends money or reaches the internet. A caller that could
set `target` could point the worker anywhere; a caller that could set
`maxModelCalls` could spend the budget; a caller that could set `faultAttempts`
could turn the recovery demo into an unbounded retry loop.

These values mirror `LIVE_SCENARIOS` in `packages/run-ledger/src/scenario.ts`.
The API admits a run against that definition and this worker executes it against
this one, so `test_scenario.py` asserts the two agree rather than trusting that
two files in two languages were edited together.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Scenario:
    id: str
    root_agent: str
    delegated_agent: str
    #: The only repository this scenario may read. Not caller-supplied.
    target: str
    #: Default model. A deployment may override it via FLEETSCOPE_ADK_MODEL;
    #: a request may not, because a request is untrusted and a model name is a
    #: cost decision.
    model: str
    max_model_calls: int
    max_retries: int
    #: How many leading attempts the Controlled Fault fails. Fixed, so the demo
    #: is reproducible and cannot be turned into a retry storm.
    fault_attempts: int
    recovery_action: str
    side_effect_class: str
    timeout_s: float


DEPENDENCY_ONBOARDING = Scenario(
    id="dependency_onboarding",
    root_agent="dependency_onboarding",
    delegated_agent="security_review",
    target="google/adk-python",
    model="gemini-2.5-flash",
    max_model_calls=6,
    max_retries=1,
    fault_attempts=1,
    recovery_action="retry_idempotent_read",
    side_effect_class="idempotent_read",
    timeout_s=90.0,
)

SCENARIOS: dict[str, Scenario] = {DEPENDENCY_ONBOARDING.id: DEPENDENCY_ONBOARDING}


class UnknownScenario(Exception):
    """The scenario id is not one this worker implements."""


def find_scenario(scenario_id: str) -> Scenario:
    scenario = SCENARIOS.get(scenario_id)
    if scenario is None:
        raise UnknownScenario(f"{scenario_id!r} is not an allowlisted scenario")
    return scenario
