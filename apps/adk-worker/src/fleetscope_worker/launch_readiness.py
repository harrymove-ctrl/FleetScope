"""The fixed, read-only Google Cloud case used by the FleetScope demo.

The case is intentionally small and concrete: four Gemini agents check a
Cloud Run service, a Cloud Storage bucket, the demo's call/time budget, and
then produce one launch-readiness decision.  This module owns the closed
configuration and the safe projection of Google API responses.  It imports no
Google SDK so every rule can be tested without credentials, network, or model
calls.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Mapping, Protocol
from urllib.parse import quote

CASE_ID = "google-cloud-launch-readiness"
ROOT_AGENT = "launch_readiness"
SPECIALIST_AGENTS = (
    "cloud_run_probe",
    "storage_probe",
    "budget_guard",
    "launch_reviewer",
)

MODEL_CALLS_BY_AGENT = {
    "cloud_run_probe": 2,
    "storage_probe": 2,
    "budget_guard": 1,
    "launch_reviewer": 1,
}

_PROJECT = re.compile(r"^[a-z][a-z0-9-]{4,28}[a-z0-9]$")
_LOCATION = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)+$")
_SERVICE = re.compile(r"^[a-z](?:[a-z0-9-]{0,47}[a-z0-9])?$")
_BUCKET = re.compile(r"^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$")
_GEMINI_MODEL = re.compile(r"^gemini-(?P<major>[0-9]+)\.(?P<minor>[0-9]+)-[a-z0-9][a-z0-9.-]*$")

MAX_MODEL_CALLS = sum(MODEL_CALLS_BY_AGENT.values())
MAX_TIMEOUT_SECONDS = 180.0


class InvalidLaunchReadinessConfig(ValueError):
    """The operator supplied a value outside the closed demo contract."""


@dataclass(frozen=True)
class LaunchReadinessConfig:
    project: str
    location: str
    service: str
    bucket: str
    model: str = "gemini-3.7-flash"
    artifact_prefix: str = "fleetscope-sessions"
    max_model_calls: int = 6
    timeout_seconds: float = 180.0

    def validate(self) -> "LaunchReadinessConfig":
        checks = (
            ("project", self.project, _PROJECT),
            ("location", self.location, _LOCATION),
            ("service", self.service, _SERVICE),
            ("bucket", self.bucket, _BUCKET),
        )
        for name, value, pattern in checks:
            if not pattern.fullmatch(value):
                raise InvalidLaunchReadinessConfig(f"invalid {name}: {value!r}")
        model = _GEMINI_MODEL.fullmatch(self.model)
        if model is None or (int(model["major"]), int(model["minor"])) < (3, 5):
            raise InvalidLaunchReadinessConfig("model must be a Gemini 3.5+ model id")
        if self.max_model_calls != MAX_MODEL_CALLS:
            raise InvalidLaunchReadinessConfig(
                f"max_model_calls is fixed at {MAX_MODEL_CALLS} for this demo"
            )
        if not 30 <= self.timeout_seconds <= MAX_TIMEOUT_SECONDS:
            raise InvalidLaunchReadinessConfig(
                f"timeout_seconds must be between 30 and {MAX_TIMEOUT_SECONDS:g}"
            )
        prefix = self.artifact_prefix.strip("/")
        if not prefix or ".." in prefix or any(ord(char) < 32 for char in prefix):
            raise InvalidLaunchReadinessConfig("artifact_prefix must be a safe object prefix")
        return self

    @property
    def normalized_artifact_prefix(self) -> str:
        return self.artifact_prefix.strip("/")


@dataclass(frozen=True)
class JsonResponse:
    status_code: int
    body: Mapping[str, Any]


class ReadOnlyJsonClient(Protocol):
    def get_json(self, url: str) -> JsonResponse: ...


def cloud_run_service_url(config: LaunchReadinessConfig) -> str:
    return (
        "https://run.googleapis.com/v2/projects/"
        f"{quote(config.project, safe='')}/locations/{quote(config.location, safe='')}"
        f"/services/{quote(config.service, safe='')}"
    )


def storage_bucket_url(config: LaunchReadinessConfig) -> str:
    return f"https://storage.googleapis.com/storage/v1/b/{quote(config.bucket, safe='')}"


def inspect_cloud_run_service(
    config: LaunchReadinessConfig, client: ReadOnlyJsonClient
) -> dict[str, Any]:
    """Return only the Cloud Run facts the agents and public log may see."""
    try:
        response = client.get_json(cloud_run_service_url(config))
    except Exception as error:  # noqa: BLE001 - only the type crosses the boundary
        return {
            "status": "error",
            "service": config.service,
            "location": config.location,
            "failureType": type(error).__name__,
        }
    if response.status_code != 200:
        return {
            "status": "error",
            "service": config.service,
            "location": config.location,
            "httpStatus": response.status_code,
        }

    body = response.body
    terminal = body.get("terminalCondition")
    terminal = terminal if isinstance(terminal, Mapping) else {}
    traffic = body.get("traffic")
    traffic = traffic if isinstance(traffic, list) else []
    ready_percent = sum(
        _integer(item.get("percent"))
        for item in traffic
        if isinstance(item, Mapping) and item.get("type") == "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    )
    return {
        "status": "ok",
        "service": config.service,
        "location": config.location,
        "uri": _text(body.get("uri")),
        "latestReadyRevision": _leaf(_text(body.get("latestReadyRevision"))),
        "ready": terminal.get("state") == "CONDITION_SUCCEEDED",
        "latestTrafficPercent": ready_percent,
    }


def inspect_storage_bucket(
    config: LaunchReadinessConfig, client: ReadOnlyJsonClient
) -> dict[str, Any]:
    """Return bucket readiness without listing or downloading private objects."""
    try:
        response = client.get_json(storage_bucket_url(config))
    except Exception as error:  # noqa: BLE001 - only the type crosses the boundary
        return {
            "status": "error",
            "bucket": config.bucket,
            "failureType": type(error).__name__,
        }
    if response.status_code != 200:
        return {
            "status": "error",
            "bucket": config.bucket,
            "httpStatus": response.status_code,
        }

    body = response.body
    iam = body.get("iamConfiguration")
    iam = iam if isinstance(iam, Mapping) else {}
    uniform = iam.get("uniformBucketLevelAccess")
    uniform = uniform if isinstance(uniform, Mapping) else {}
    versioning = body.get("versioning")
    versioning = versioning if isinstance(versioning, Mapping) else {}
    return {
        "status": "ok",
        "bucket": config.bucket,
        "location": _text(body.get("location")),
        "storageClass": _text(body.get("storageClass")),
        "uniformAccess": uniform.get("enabled") is True,
        "versioning": versioning.get("enabled") is True,
    }


def inspect_budget_guardrails(config: LaunchReadinessConfig) -> dict[str, Any]:
    return {
        "status": "ok",
        "model": config.model,
        "maxModelCalls": config.max_model_calls,
        "modelCallsByAgent": dict(MODEL_CALLS_BY_AGENT),
        "timeoutSeconds": config.timeout_seconds,
        "cloudReads": 2,
        "cloudWritesDuringWorkflow": 0,
        "fleetScopeRole": "read-only observer",
    }


def artifact_object_name(config: LaunchReadinessConfig, session_id: str, filename: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9._-]+", filename):
        raise ValueError(f"unsafe artifact filename: {filename!r}")
    if not re.fullmatch(r"[A-Za-z0-9._-]+", session_id):
        raise ValueError(f"unsafe session id: {session_id!r}")
    return f"{config.normalized_artifact_prefix}/{session_id}/{filename}"


def _text(value: Any) -> str:
    return value if isinstance(value, str) else ""


def _leaf(value: str) -> str:
    return value.rsplit("/", 1)[-1] if value else ""


def _integer(value: Any) -> int:
    return value if isinstance(value, int) and not isinstance(value, bool) else 0
