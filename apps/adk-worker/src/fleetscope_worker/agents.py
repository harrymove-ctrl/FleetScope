"""The only module that imports google-adk.

Everything else in this package is SDK-free on purpose, so the contract, the
allowlisted read, the capture translation and the recovery policy are all
provable without an SDK, a key or a network. This module is the seam where a
real runtime is bound to those same ports.

The callback signatures below were taken from google-adk 2.8.0 itself
(`LlmAgent.model_fields`), not from memory:

    before_agent_callback(context)
    before_model_callback(context, llm_request)
    before_tool_callback(tool, args, context)
    after_tool_callback(tool, args, context, response)
"""

from __future__ import annotations

import json
from typing import Any

from google.adk.agents import LlmAgent, SequentialAgent
from google.adk.tools import FunctionTool

from .capture import CallbackCapture, ModelBudget
from .contract import EventStream
from .tools import RepositoryMetadataTool, TargetNotAllowed, ToolFailure

ROOT_AGENT = "dependency_onboarding"
DELEGATED_AGENT = "security_review"

_ROOT_INSTRUCTION = (
    "You onboard a new software dependency. Delegate the security review to the "
    "security_review agent and report only what that review returns. Do not "
    "speculate about a repository you have not read."
)

_REVIEW_INSTRUCTION = (
    "You review one dependency. Call read_repository_metadata exactly once for "
    "the target you are given, then summarise the default branch, star count, "
    "archived flag and licence. If the tool fails, say so plainly and stop; do "
    "not retry it yourself and do not invent metadata."
)


def build_agents(
    *,
    model: str,
    stream: EventStream,
    tool: RepositoryMetadataTool,
    idempotency_key: str,
    budget: ModelBudget,
) -> LlmAgent:
    """Wire a real ADK root agent that delegates to a real sub-agent.

    The retry is deliberately NOT given to the model: the instruction tells the
    review agent to stop on failure. Recovery is a policy decision made by the
    Warden in `recovery.py`, where it is bounded and recorded, rather than an
    unbounded behaviour a prompt might or might not follow.
    """
    capture = CallbackCapture(stream, budget)

    def read_repository_metadata(target: str) -> dict[str, Any]:
        """Read public metadata for an allowlisted repository.

        Args:
            target: The repository in "owner/name" form.
        """
        try:
            return tool.read(target, idempotency_key=idempotency_key).to_payload()
        except TargetNotAllowed as refusal:
            return {"status": "refused", "reason": str(refusal)}
        except ToolFailure as failure:
            # Returned rather than raised so the runtime records a tool result
            # the agent can read; the truth label travels with it.
            return {"status": "failed", "reason": failure.message, "truth": failure.truth}

    # Only `before_model` is bound. The runtime's own Event stream is the single
    # evidence source (see `adk_runtime._Translation`); binding the agent and
    # tool callbacks as well would record every tool call twice, once from the
    # callback and once from the event's `function_call` part. The budget is the
    # exception because a refusal must happen BEFORE the call, and an event only
    # arrives after it.
    review = LlmAgent(
        name=DELEGATED_AGENT,
        model=model,
        description="Reviews one dependency by reading its public repository metadata.",
        instruction=_REVIEW_INSTRUCTION,
        tools=[FunctionTool(read_repository_metadata)],
        before_model_callback=capture.before_model,
    )

    return LlmAgent(
        name=ROOT_AGENT,
        model=model,
        description="Onboards a dependency and delegates its security review.",
        instruction=_ROOT_INSTRUCTION,
        sub_agents=[review],
        before_model_callback=capture.before_model,
    )


def build_launch_readiness_workflow(
    *,
    model: str,
    before_model_callback: Any,
    cloud_run_probe: Any,
    storage_probe: Any,
    budget_report: dict[str, Any],
) -> SequentialAgent:
    """Build the fixed four-task workflow used in the Session Observer demo.

    A ``SequentialAgent`` makes the demo reliable: every named specialist runs
    once, every result lands in shared session state, and the final reviewer
    sees all three reports. The agents are direct children of the workflow so
    FleetScope's current one-level graph can display the whole team without
    inventing a second orchestration layer.
    """

    cloud_run_agent = LlmAgent(
        name="cloud_run_probe",
        model=model,
        description="Checks the configured Cloud Run service using one read-only tool.",
        instruction=(
            "Call inspect_cloud_run_service exactly once. Report whether the service is ready, "
            "which revision is ready, its URI, and the percent of traffic on the latest revision. "
            "Do not guess missing values and do not call any other agent."
        ),
        tools=[FunctionTool(cloud_run_probe)],
        output_key="cloud_run_report",
        before_model_callback=before_model_callback,
    )
    storage_agent = LlmAgent(
        name="storage_probe",
        model=model,
        description="Checks the configured Cloud Storage bucket using one read-only tool.",
        instruction=(
            "Call inspect_storage_bucket exactly once. Report the bucket location, storage class, "
            "uniform-access state, and versioning state. Do not list or read objects and do not "
            "guess missing values."
        ),
        tools=[FunctionTool(storage_probe)],
        output_key="storage_report",
        before_model_callback=before_model_callback,
    )
    budget_agent = LlmAgent(
        name="budget_guard",
        model=model,
        description="Checks the fixed model-call, timeout, and cloud-write limits.",
        instruction=(
            "Verify the server-owned budget report below. Confirm that the workflow is bounded to "
            "six model calls and 180 seconds or less, uses only two Cloud reads, performs no Cloud "
            "write during the agent workflow, and leaves FleetScope read-only. Do not call a tool "
            "or invent a different limit.\n\nBudget report:\n"
            + json.dumps(budget_report, separators=(",", ":"), sort_keys=True)
        ),
        output_key="budget_report",
        before_model_callback=before_model_callback,
    )
    reviewer = LlmAgent(
        name="launch_reviewer",
        model=model,
        description="Combines the three specialist reports into one evidence-based decision.",
        instruction=(
            "Review all three reports below. Return READY only when Cloud Run is ready, the bucket "
            "check succeeded, and the budget guardrails are bounded. Otherwise return NOT_READY. "
            "Name each failed or unknown condition and never claim that FleetScope performed an "
            "agent or Cloud action.\n\n"
            "Cloud Run report:\n{cloud_run_report}\n\n"
            "Cloud Storage report:\n{storage_report}\n\n"
            "Budget report:\n{budget_report}"
        ),
        output_key="launch_decision",
        before_model_callback=before_model_callback,
    )

    return SequentialAgent(
        name="launch_readiness",
        description="Runs four bounded Google Cloud launch-readiness tasks.",
        sub_agents=[cloud_run_agent, storage_agent, budget_agent, reviewer],
    )
