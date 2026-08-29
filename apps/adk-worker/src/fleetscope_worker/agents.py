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

from typing import Any

from google.adk.agents import LlmAgent
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
