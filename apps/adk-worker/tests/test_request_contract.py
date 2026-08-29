"""The closed request contract, and the scenario values it cannot reach."""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from fleetscope_worker.request import InvalidRequest, parse_request
from fleetscope_worker.scenario import DEPENDENCY_ONBOARDING, UnknownScenario, find_scenario

VALID = {
    "runId": "run-1",
    "sessionId": "sess-1",
    "correlationId": "corr-1",
    "scenarioId": "dependency_onboarding",
    "mode": "pure",
}


def test_the_identifier_only_request_is_accepted():
    request = parse_request(VALID)
    assert request.run_id == "run-1"
    assert request.scenario_id == "dependency_onboarding"


def test_mode_defaults_to_the_one_that_cannot_spend_anything():
    assert parse_request({k: v for k, v in VALID.items() if k != "mode"}).mode == "pure"


@pytest.mark.parametrize(
    "field",
    [
        "target",
        "model",
        "prompt",
        "url",
        "toolArgs",
        "maxRetries",
        "maxModelCalls",
        "faultAttempts",
        "controlledFault",
        "allowlist",
    ],
)
def test_a_field_that_could_steer_execution_is_refused_by_name(field: str):
    # Refused, not ignored: a caller who sends `target` and gets a run back has
    # every reason to think it worked, and the next permissive `.get()` turns
    # that belief into a vulnerability.
    with pytest.raises(InvalidRequest, match=re.escape(field)):
        parse_request({**VALID, field: "anything"})


def test_several_unknown_fields_are_all_named():
    with pytest.raises(InvalidRequest) as caught:
        parse_request({**VALID, "target": "x", "model": "y"})
    assert "model" in str(caught.value) and "target" in str(caught.value)


@pytest.mark.parametrize("field", ["runId", "sessionId", "correlationId", "scenarioId"])
def test_a_missing_or_blank_identifier_is_refused(field: str):
    with pytest.raises(InvalidRequest, match=field):
        parse_request({**VALID, field: "   "})
    with pytest.raises(InvalidRequest, match=field):
        parse_request({k: v for k, v in VALID.items() if k != field})


def test_an_unknown_mode_is_refused():
    with pytest.raises(InvalidRequest, match="mode"):
        parse_request({**VALID, "mode": "live"})


def test_an_unknown_scenario_is_refused():
    with pytest.raises(UnknownScenario):
        find_scenario("../../etc/passwd")


# ── the values a caller cannot reach ────────────────────────────────────────


def test_the_scenario_owns_everything_that_spends_or_reaches_out():
    scenario = find_scenario("dependency_onboarding")
    assert scenario.target == "google/adk-python"
    assert scenario.max_model_calls == 6
    assert scenario.max_retries == 1
    assert scenario.fault_attempts == 1


def test_the_worker_and_the_api_agree_on_the_scenario():
    # The API admits a run against the TypeScript definition and this worker
    # executes it against the Python one. Two files, two languages, one set of
    # numbers: asserted rather than assumed.
    source = (
        Path(__file__).resolve().parents[3]
        / "packages"
        / "run-ledger"
        / "src"
        / "scenario.ts"
    ).read_text()

    def field(name: str) -> str:
        match = re.search(rf"{name}:\s*'?([^,'\n]+)'?,", source)
        assert match is not None, f"{name} not found in scenario.ts"
        return match.group(1).strip()

    assert field("id") == DEPENDENCY_ONBOARDING.id
    assert field("rootAgent") == DEPENDENCY_ONBOARDING.root_agent
    assert field("delegatedAgent") == DEPENDENCY_ONBOARDING.delegated_agent
    assert field("target") == DEPENDENCY_ONBOARDING.target
    assert field("recoveryAction") == DEPENDENCY_ONBOARDING.recovery_action
    assert field("sideEffectClass") == DEPENDENCY_ONBOARDING.side_effect_class
    assert int(field("maxModelCalls")) == DEPENDENCY_ONBOARDING.max_model_calls
    assert int(field("maxWardenRetries")) == DEPENDENCY_ONBOARDING.max_retries


def test_the_request_contract_is_json_serialisable_as_documented():
    # The API will construct this body; it must be plain JSON with no extras.
    assert json.loads(json.dumps(VALID)) == VALID
