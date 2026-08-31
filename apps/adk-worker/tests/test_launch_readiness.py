from __future__ import annotations

from typing import Any

import pytest

from fleetscope_worker.launch_readiness import (
    MAX_MODEL_CALLS,
    InvalidLaunchReadinessConfig,
    JsonResponse,
    LaunchReadinessConfig,
    artifact_object_name,
    cloud_run_service_url,
    inspect_budget_guardrails,
    inspect_cloud_run_service,
    inspect_storage_bucket,
    storage_bucket_url,
)


def config(**overrides: Any) -> LaunchReadinessConfig:
    values = {
        "project": "example-project",
        "location": "us-central1",
        "service": "fleetscope",
        "bucket": "fleetscope-sessions-demo",
    }
    values.update(overrides)
    return LaunchReadinessConfig(**values)


class FakeJsonClient:
    def __init__(self, responses: dict[str, JsonResponse]) -> None:
        self.responses = responses
        self.calls: list[str] = []

    def get_json(self, url: str) -> JsonResponse:
        self.calls.append(url)
        return self.responses[url]


class FailingJsonClient:
    def get_json(self, _url: str) -> JsonResponse:
        raise TimeoutError("private transport detail")


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("project", "UPPER", "invalid project"),
        ("location", "local", "invalid location"),
        ("service", "bad_service", "invalid service"),
        ("bucket", "BadBucket", "invalid bucket"),
        ("model", "gemini-3.4-flash", "Gemini 3.5+"),
        ("model", "not-gemini", "Gemini 3.5+"),
        ("model_location", "us-central1", "global, us, or eu"),
        ("max_model_calls", 7, "fixed at 6"),
        ("timeout_seconds", 181, "between 30 and 180"),
    ],
)
def test_closed_config_rejects_values_outside_the_demo_contract(
    field: str, value: Any, message: str
) -> None:
    with pytest.raises(InvalidLaunchReadinessConfig, match=message):
        config(**{field: value}).validate()


def test_cloud_run_probe_returns_only_safe_readiness_fields() -> None:
    cfg = config().validate()
    url = cloud_run_service_url(cfg)
    client = FakeJsonClient(
        {
            url: JsonResponse(
                200,
                {
                    "name": "projects/secret/locations/us-central1/services/fleetscope",
                    "uid": "do-not-persist",
                    "uri": "https://fleetscope.example.run.app",
                    "latestReadyRevision": "projects/p/locations/l/services/s/revisions/fs-00012",
                    "terminalCondition": {"state": "CONDITION_SUCCEEDED", "message": "private"},
                    "traffic": [
                        {
                            "type": "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST",
                            "percent": 100,
                            "revision": "private-revision-path",
                        }
                    ],
                    "labels": {"owner": "private"},
                },
            )
        }
    )

    assert inspect_cloud_run_service(cfg, client) == {
        "status": "ok",
        "service": "fleetscope",
        "location": "us-central1",
        "uri": "https://fleetscope.example.run.app",
        "latestReadyRevision": "fs-00012",
        "ready": True,
        "latestTrafficPercent": 100,
    }
    assert client.calls == [url]


def test_model_and_cloud_run_locations_are_independent() -> None:
    cfg = config(model_location="global").validate()
    assert cfg.model_location == "global"
    assert "/locations/us-central1/services/" in cloud_run_service_url(cfg)


def test_storage_probe_does_not_list_or_return_objects_or_iam_details() -> None:
    cfg = config().validate()
    url = storage_bucket_url(cfg)
    client = FakeJsonClient(
        {
            url: JsonResponse(
                200,
                {
                    "name": cfg.bucket,
                    "location": "US-CENTRAL1",
                    "storageClass": "STANDARD",
                    "iamConfiguration": {
                        "uniformBucketLevelAccess": {"enabled": True},
                        "publicAccessPrevention": "enforced",
                    },
                    "versioning": {"enabled": True},
                    "owner": {"entity": "project-owner-private"},
                    "objects": ["must-not-leak"],
                },
            )
        }
    )

    assert inspect_storage_bucket(cfg, client) == {
        "status": "ok",
        "bucket": cfg.bucket,
        "location": "US-CENTRAL1",
        "storageClass": "STANDARD",
        "uniformAccess": True,
        "versioning": True,
    }
    assert client.calls == [url]


def test_failed_reads_expose_status_but_not_google_response_bodies() -> None:
    cfg = config().validate()
    run_client = FakeJsonClient(
        {cloud_run_service_url(cfg): JsonResponse(403, {"error": {"message": "secret"}})}
    )
    storage_client = FakeJsonClient(
        {storage_bucket_url(cfg): JsonResponse(404, {"error": {"message": "secret"}})}
    )

    assert inspect_cloud_run_service(cfg, run_client) == {
        "status": "error",
        "service": cfg.service,
        "location": cfg.location,
        "httpStatus": 403,
    }
    assert inspect_storage_bucket(cfg, storage_client) == {
        "status": "error",
        "bucket": cfg.bucket,
        "httpStatus": 404,
    }


def test_transport_failures_expose_only_the_exception_type() -> None:
    cfg = config().validate()
    assert inspect_cloud_run_service(cfg, FailingJsonClient()) == {
        "status": "error",
        "service": cfg.service,
        "location": cfg.location,
        "failureType": "TimeoutError",
    }
    assert inspect_storage_bucket(cfg, FailingJsonClient()) == {
        "status": "error",
        "bucket": cfg.bucket,
        "failureType": "TimeoutError",
    }


def test_budget_and_artifact_names_are_fixed_and_safe() -> None:
    cfg = config().validate()
    assert inspect_budget_guardrails(cfg) == {
        "status": "ok",
        "model": "gemini-3.7-flash",
        "maxModelCalls": MAX_MODEL_CALLS,
        "modelCallsByAgent": {
            "cloud_run_probe": 2,
            "storage_probe": 2,
            "budget_guard": 1,
            "launch_reviewer": 1,
        },
        "timeoutSeconds": 180.0,
        "cloudReads": 2,
        "cloudWritesDuringWorkflow": 0,
        "fleetScopeRole": "read-only observer",
    }
    assert (
        artifact_object_name(cfg, "fs-session-1", "session.jsonl")
        == "fleetscope-sessions/fs-session-1/session.jsonl"
    )
    with pytest.raises(ValueError, match="unsafe session id"):
        artifact_object_name(cfg, "../escape", "session.jsonl")
