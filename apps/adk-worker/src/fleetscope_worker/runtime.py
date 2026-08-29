"""The seam between "what the scenario is" and "what actually ran it".

# Why a seam exists at all

There are two ways to produce the five-beat story: replay it deterministically,
or execute it on a real agent runtime. They must produce the same event shape so
the UI has one projection, and they must NEVER produce the same truth label,
because one of them observed a runtime and the other did not.

`ScriptedRuntime` labels its evidence `recorded`. `AdkRuntime` labels what it
observed `live`. Nothing in the system can promote the former to the latter.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from .contract import EventStream
from .request import RunRequest
from .scenario import Scenario
from .tools import RepositoryMetadataTool


@dataclass(frozen=True)
class RunPlan:
    request: RunRequest
    scenario: Scenario
    model: str


@dataclass(frozen=True)
class RuntimeOutcome:
    """What the runtime observed. Never what we hoped it would observe.

    `terminal_result` is one of:
      succeeded   the delegated agent ran and the read completed
      failed      the runtime reported an error
      timed_out   the runtime did not finish inside the scenario's budget
      incomplete  the runtime finished but the required evidence is missing
                  (most importantly: no delegation was observed)
    """

    terminal_result: str
    #: Whether delegation to the sub-agent was actually observed. A run without
    #: it is `incomplete`, never `succeeded`, because delegation is the claim.
    delegated: bool
    model_calls: int
    detail: str


class AgentRuntime(Protocol):
    def execute(
        self,
        plan: RunPlan,
        stream: EventStream,
        tool: RepositoryMetadataTool,
    ) -> RuntimeOutcome: ...


class ScriptedRuntime:
    """Replays the scenario deterministically. No runtime, no model, no cost.

    Its evidence is labelled `recorded`, which is what makes it safe to use for
    CI and for the fallback demo: nothing it emits can be mistaken for an
    observation of a real agent runtime.
    """

    def execute(
        self,
        plan: RunPlan,
        stream: EventStream,
        tool: RepositoryMetadataTool,
    ) -> RuntimeOutcome:
        from .recovery import RecoveryPolicy
        from .session import run_dependency_onboarding

        outcome = run_dependency_onboarding(
            stream=stream,
            tool=tool,
            target=plan.scenario.target,
            idempotency_key=f"{plan.request.run_id}:{plan.scenario.recovery_action}:1",
            policy=RecoveryPolicy(max_retries=plan.scenario.max_retries),
            root_agent=plan.scenario.root_agent,
            delegated_agent=plan.scenario.delegated_agent,
            evidence_truth="recorded",
        )
        return RuntimeOutcome(
            terminal_result=outcome.terminal_result,
            # The scripted path always delegates, but it says so as an observed
            # fact of its own transcript rather than as a claim about ADK.
            delegated=True,
            model_calls=0,
            detail="deterministic replay; no agent runtime was involved",
        )
