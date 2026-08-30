"""Run the real Google ADK multi-agent demo and write FleetScope-readable JSONL.

Nothing in this module is imported by the zero-cost worker path. A live run is
an explicit operator action, requires Vertex AI plus ADC, and is refused unless
``FLEETSCOPE_ALLOW_MODEL_CALLS=true``. Events are flushed one line at a time so
``fleetscope <session.jsonl> --follow`` can watch the agents while they work.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import re
import sys
import uuid
from dataclasses import asdict
from datetime import datetime, timezone
from importlib.metadata import version
from pathlib import Path
from typing import Any, Mapping, Sequence
from urllib.parse import quote

import google.auth
from google.adk.events import Event
from google.adk.models.google_llm import Gemini
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.auth.transport.requests import AuthorizedSession
from google.genai import types

from .agents import build_launch_readiness_workflow
from .capture import ModelBudget, ModelBudgetExceeded
from .launch_readiness import (
    CASE_ID,
    ROOT_AGENT,
    SPECIALIST_AGENTS,
    InvalidLaunchReadinessConfig,
    JsonResponse,
    LaunchReadinessConfig,
    MODEL_CALLS_BY_AGENT,
    artifact_object_name,
    inspect_budget_guardrails,
    inspect_cloud_run_service,
    inspect_storage_bucket,
)

FRAMEWORK = "google-adk"
FRAMEWORK_VERSION = version("google-adk")
USER_ID = "fleetscope-google-demo"
_SENSITIVE_KEY = re.compile(
    r"(?:^|_)(?:api_?key|authorization|cookie|credential|password|private_?key|secret|token)(?:$|_)",
    re.IGNORECASE,
)


class LiveRunRefused(RuntimeError):
    """A metered or cloud-mutating path was not explicitly enabled."""


class GoogleApiError(RuntimeError):
    """A Google API operation failed without exposing its response body."""


class AuthorizedGoogleClient:
    """ADC-backed Google API client with read-only workflow access.

    Upload is a separate method and is called only for an explicit ``--upload``
    run after all agents have finished. No credential or response body is ever
    copied into the session log.
    """

    def __init__(self, *, timeout_seconds: float = 20.0) -> None:
        credentials, _ = google.auth.default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        self._session = AuthorizedSession(credentials)
        self.credentials = credentials
        self._timeout_seconds = timeout_seconds

    def get_json(self, url: str) -> JsonResponse:
        response = self._session.get(url, timeout=self._timeout_seconds)
        try:
            body = response.json()
        except ValueError:
            body = {}
        return JsonResponse(
            status_code=response.status_code,
            body=body if isinstance(body, Mapping) else {},
        )

    def upload_bytes(
        self, *, bucket: str, object_name: str, content: bytes, content_type: str
    ) -> dict[str, Any]:
        url = (
            "https://storage.googleapis.com/upload/storage/v1/b/"
            f"{quote(bucket, safe='')}/o?uploadType=media&name={quote(object_name, safe='')}"
        )
        response = self._session.post(
            url,
            data=content,
            headers={"content-type": content_type},
            timeout=self._timeout_seconds,
        )
        if response.status_code not in {200, 201}:
            raise GoogleApiError(f"Cloud Storage upload returned HTTP {response.status_code}")
        try:
            body = response.json()
        except ValueError as error:
            raise GoogleApiError("Cloud Storage upload returned non-JSON metadata") from error
        return {
            "bucket": bucket,
            "object": object_name,
            "generation": str(body.get("generation", "")),
        }


class SessionRecorder:
    """Incremental, redacted ADK Event writer plus proof counters."""

    def __init__(
        self,
        path: Path,
        *,
        adk_session_id: str,
        config: LaunchReadinessConfig,
    ) -> None:
        self.path = path
        self._session_id = adk_session_id
        self._config = config
        self._out = path.open("x", encoding="utf-8", buffering=1)
        self._started = False
        self._primary_invocation_id: str | None = None
        self.event_count = 0
        self.provider_errors = 0
        self.observed_model_versions: set[str] = set()
        self.observed_invocation_ids: set[str] = set()

    @property
    def viewer_session_id(self) -> str:
        return self._primary_invocation_id or self._session_id

    def close(self) -> None:
        if not self._out.closed:
            self._out.close()

    def write_event(self, event: Event) -> None:
        invocation_id = str(getattr(event, "invocation_id", "") or "")
        if invocation_id:
            self.observed_invocation_ids.add(invocation_id)
        if self._primary_invocation_id is None and invocation_id:
            self._primary_invocation_id = invocation_id

        if not self._started:
            timestamp = float(getattr(event, "timestamp", 0.0) or 0.0)
            self._write(self._start_event(max(0.0, timestamp - 0.001)))
            self._started = True

        model_version = getattr(event, "model_version", None)
        safe_model_version = _safe_model_version(model_version)
        if safe_model_version is not None:
            self.observed_model_versions.add(safe_model_version)
        if getattr(event, "error_code", None) or getattr(event, "error_message", None):
            self.provider_errors += 1

        payload = event.model_dump(mode="json", by_alias=True, exclude_none=True)
        self._write(_redacted_event(payload, metadata=self._metadata()))

    def finish(self, *, succeeded: bool, detail: str) -> None:
        if not self._started:
            self._write(self._start_event(_epoch_now()))
            self._started = True
        event: dict[str, Any] = {
            "id": f"fleetscope-end-{self._session_id}",
            "invocationId": self.viewer_session_id,
            "author": ROOT_AGENT,
            "branch": ROOT_AGENT,
            "timestamp": _epoch_now(),
            "content": {
                "role": "model",
                "parts": [
                    {
                        "text": (
                            "Launch-readiness workflow finished. "
                            if succeeded
                            else "Launch-readiness workflow did not finish successfully. "
                        )
                        + detail[:160]
                    }
                ],
            },
            "customMetadata": {"fleetscope": self._metadata()},
        }
        if succeeded:
            event["turnComplete"] = True
        else:
            event["errorCode"] = "WORKFLOW_FAILED"
            event["errorMessage"] = detail[:160]
        self._write(event)

    def _start_event(self, timestamp: float) -> dict[str, Any]:
        return {
            "id": f"fleetscope-start-{self._session_id}",
            "invocationId": self.viewer_session_id,
            "author": "user",
            "branch": ROOT_AGENT,
            "timestamp": timestamp,
            "content": {
                "role": "user",
                "parts": [
                    {
                        "text": (
                            "Run the fixed Google Cloud launch-readiness case: inspect Cloud Run, "
                            "inspect the session bucket, verify the budget guardrails, and issue an "
                            "evidence-based launch decision."
                        )
                    }
                ],
            },
            "customMetadata": {"fleetscope": self._metadata()},
        }

    def _metadata(self) -> dict[str, Any]:
        return {
            "schema": "fleetscope.google-session.v1",
            "caseId": CASE_ID,
            "adkSessionId": self._session_id,
            "framework": FRAMEWORK,
            "frameworkVersion": FRAMEWORK_VERSION,
            # This is explicitly configuration. Execution proof comes from an
            # Event's provider-owned modelVersion and the proof manifest keeps
            # those two concepts separate.
            "configuredModel": self._config.model,
        }

    def _write(self, payload: Mapping[str, Any]) -> None:
        self._out.write(json.dumps(payload, separators=(",", ":"), sort_keys=True) + "\n")
        self._out.flush()
        self.event_count += 1


def _redacted_event(payload: Mapping[str, Any], *, metadata: Mapping[str, Any]) -> dict[str, Any]:
    clean = _redact_value(dict(payload))
    _sanitize_error_fields(clean)
    _sanitize_model_version(clean)
    # SequentialAgent runs its children in the same invocation context, so ADK
    # may leave `branch` empty even though the parent/child relationship is
    # fixed in the agent tree. Stamp that producer-owned topology explicitly so
    # a portable JSONL consumer does not need the in-memory ADK objects.
    author = clean.get("author")
    if author in SPECIALIST_AGENTS:
        clean["branch"] = f"{ROOT_AGENT}.{author}"
    elif author == ROOT_AGENT:
        clean["branch"] = ROOT_AGENT
    content = clean.get("content")
    if isinstance(content, dict):
        parts = content.get("parts")
        if isinstance(parts, list):
            content["parts"] = [
                part
                for part in parts
                if not (isinstance(part, Mapping) and part.get("thought") is True)
            ]
    custom = clean.get("customMetadata")
    if not isinstance(custom, dict):
        custom = {}
        clean["customMetadata"] = custom
    custom["fleetscope"] = dict(metadata)
    return clean


def _sanitize_error_fields(payload: dict[str, Any]) -> None:
    """Keep failure classification while dropping provider error messages.

    Provider messages can echo prompts, resource names, or request payloads.
    The viewer only needs an explicit failure marker and (when it is a simple
    enum-like value) its bounded code; never persist the raw message.
    """
    raw_code = payload.get("errorCode", payload.get("error_code"))
    has_error = (
        raw_code is not None
        or payload.get("errorMessage") is not None
        or payload.get("error_message") is not None
    )
    if not has_error:
        return
    payload.pop("error_message", None)
    payload.pop("errorMessage", None)
    if isinstance(raw_code, str) and re.fullmatch(
        r"[A-Za-z0-9_.:-]{1,64}", raw_code.strip()
    ):
        payload["errorCode"] = raw_code.strip().upper()
    else:
        payload["errorCode"] = "PROVIDER_ERROR"


def _sanitize_model_version(payload: dict[str, Any]) -> None:
    """Keep only identifier-shaped provider model versions in public JSONL."""
    raw = payload.get("modelVersion", payload.get("model_version"))
    if raw is None:
        return
    payload.pop("model_version", None)
    safe = _safe_model_version(raw)
    if safe is None:
        payload.pop("modelVersion", None)
    else:
        payload["modelVersion"] = safe


def _safe_model_version(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    return (
        normalized
        if re.fullmatch(r"[A-Za-z0-9._:-]{1,128}", normalized)
        else None
    )


def _redact_value(value: Any) -> Any:
    if isinstance(value, Mapping):
        result: dict[str, Any] = {}
        for raw_key, item in value.items():
            key = str(raw_key)
            normalized = re.sub(r"(?<!^)(?=[A-Z])", "_", key).lower()
            normalized = re.sub(r"[^a-z0-9]+", "_", normalized).strip("_")
            result[key] = "[REDACTED]" if _SENSITIVE_KEY.search(normalized) else _redact_value(item)
        return result
    if isinstance(value, list):
        return [_redact_value(item) for item in value]
    return value


def _specialist_inputs(
    config: LaunchReadinessConfig, client: AuthorizedGoogleClient
) -> tuple[Any, Any, dict[str, Any]]:
    # Zero-argument tools: the model cannot steer project, service, bucket, or
    # budget. All values come from validated operator configuration.
    def inspect_cloud_run_service_tool() -> dict[str, Any]:
        """Inspect the one configured Cloud Run service using a read-only API call."""
        return inspect_cloud_run_service(config, client)

    inspect_cloud_run_service_tool.__name__ = "inspect_cloud_run_service"

    def inspect_storage_bucket_tool() -> dict[str, Any]:
        """Inspect the one configured session bucket without reading any object."""
        return inspect_storage_bucket(config, client)

    inspect_storage_bucket_tool.__name__ = "inspect_storage_bucket"

    return (
        inspect_cloud_run_service_tool,
        inspect_storage_bucket_tool,
        inspect_budget_guardrails(config),
    )


async def run_live_session(
    config: LaunchReadinessConfig,
    *,
    adk_session_id: str,
    output_path: Path,
    client: AuthorizedGoogleClient,
) -> dict[str, Any]:
    recorder = SessionRecorder(output_path, adk_session_id=adk_session_id, config=config)
    try:
        budget = ModelBudget(config.max_model_calls)
        calls_by_agent = {agent: 0 for agent in SPECIALIST_AGENTS}

        def before_model(
            *args: Any,
            callback_context: Any = None,
            llm_request: Any = None,
            **_kwargs: Any,
        ) -> None:
            # ADK 2.8 invokes before_model_callback by keyword
            # (callback_context=, llm_request=). Older unit tests still pass
            # the context positionally.
            context = callback_context if callback_context is not None else (args[0] if args else None)
            agent_name = getattr(context, "agent_name", None)
            limit = MODEL_CALLS_BY_AGENT.get(agent_name)
            if limit is None:
                raise ModelBudgetExceeded("refused: an unexpected agent requested a model call")
            if calls_by_agent[agent_name] >= limit:
                raise ModelBudgetExceeded(
                    "refused: an agent exceeded its fixed model-call allocation"
                )
            budget.reserve()
            calls_by_agent[agent_name] += 1
            _ = llm_request

        error_detail = ""
        decision = ""
        try:
            # Keep all ADK construction inside the recorded boundary. If a
            # dependency/configuration error happens before the first provider
            # event, the local JSONL still contains a safe failed session.
            cloud_run_probe, storage_probe, budget_report = _specialist_inputs(config, client)
            model = Gemini(
                model=config.model,
                client_kwargs={
                    "enterprise": True,
                    "project": config.project,
                    "location": config.model_location,
                    # Supplying ADC explicitly makes it take precedence over
                    # any ambient API-key environment variable.
                    "credentials": getattr(client, "credentials", None),
                },
            )
            workflow = build_launch_readiness_workflow(
                model=model,
                before_model_callback=before_model,
                cloud_run_probe=cloud_run_probe,
                storage_probe=storage_probe,
                budget_report=budget_report,
            )
            sessions = InMemorySessionService()
            await sessions.create_session(
                app_name=CASE_ID,
                user_id=USER_ID,
                session_id=adk_session_id,
                state={"caseId": CASE_ID},
            )
            runner = Runner(app_name=CASE_ID, agent=workflow, session_service=sessions)
            message = types.Content(
                role="user",
                parts=[
                    types.Part.from_text(
                        text=(
                            "Execute every specialist task in the fixed launch-readiness workflow and "
                            "finish with one evidence-based READY or NOT_READY decision."
                        )
                    )
                ],
            )
            await asyncio.wait_for(
                _drain_runner(runner, recorder, adk_session_id, message),
                timeout=config.timeout_seconds,
            )
        except asyncio.TimeoutError:
            error_detail = f"workflow exceeded its {config.timeout_seconds:g}s timeout"
        except ModelBudgetExceeded as error:
            error_detail = str(error)
        except Exception as error:  # noqa: BLE001 - provider messages may contain request data
            error_detail = f"workflow raised {type(error).__name__}"

        if not error_detail and recorder.provider_errors:
            error_detail = f"provider emitted {recorder.provider_errors} error event(s)"

        if not error_detail:
            try:
                state = await sessions.get_session(
                    app_name=CASE_ID,
                    user_id=USER_ID,
                    session_id=adk_session_id,
                )
            except Exception as error:  # noqa: BLE001 - keep session details out of proof
                error_detail = f"session state lookup raised {type(error).__name__}"
            else:
                if state is not None:
                    raw_decision = state.state.get("launch_decision")
                    if isinstance(raw_decision, str):
                        decision = " ".join(raw_decision.split())[:500]

        succeeded = not error_detail and bool(decision)
        if not decision and not error_detail:
            error_detail = "the launch reviewer produced no final decision"
        safe_detail = _safe_decision_label(decision) if decision else error_detail
        recorder.finish(succeeded=succeeded, detail=safe_detail)

        return {
            "succeeded": succeeded,
            "detail": safe_detail,
            "modelCalls": budget.used,
            "modelCallsByAgent": calls_by_agent,
            "eventCount": recorder.event_count,
            "viewerSessionId": recorder.viewer_session_id,
            "observedInvocationIds": sorted(recorder.observed_invocation_ids),
            "observedModelVersions": sorted(recorder.observed_model_versions),
        }
    finally:
        recorder.close()


async def _drain_runner(
    runner: Runner,
    recorder: SessionRecorder,
    session_id: str,
    message: types.Content,
) -> None:
    async for event in runner.run_async(
        user_id=USER_ID,
        session_id=session_id,
        new_message=message,
    ):
        recorder.write_event(event)


def _proof(
    *,
    config: LaunchReadinessConfig,
    adk_session_id: str,
    session_path: Path,
    result: Mapping[str, Any],
    uploaded_session: Mapping[str, Any] | None,
    upload_failure_type: str | None = None,
) -> dict[str, Any]:
    observed = list(result.get("observedModelVersions", []))
    if upload_failure_type:
        upload_status = "partial" if uploaded_session is not None else "failed"
    elif uploaded_session is not None:
        upload_status = "uploaded"
    else:
        upload_status = "not_requested"
    return {
        "schema": "fleetscope.google-session-proof.v1",
        "caseId": CASE_ID,
        "adkSessionId": adk_session_id,
        "viewerSessionId": result.get("viewerSessionId"),
        "framework": FRAMEWORK,
        "frameworkVersion": FRAMEWORK_VERSION,
        "configuredModel": config.model,
        "observedModelVersions": observed,
        "modelEvidence": "observed" if observed else "missing",
        "googleCloud": {
            "project": config.project,
            "modelLocation": config.model_location,
            "cloudRunLocation": config.location,
            "cloudRunService": config.service,
            "storageBucket": config.bucket,
        },
        "workflow": {
            "rootAgent": ROOT_AGENT,
            "agents": [ROOT_AGENT, *SPECIALIST_AGENTS],
            "modelCalls": result.get("modelCalls"),
            "modelCallsByAgent": result.get("modelCallsByAgent"),
            "eventCount": result.get("eventCount"),
            "terminalResult": "succeeded" if result.get("succeeded") else "failed",
            "detail": result.get("detail"),
        },
        "jsonl": {
            "filename": session_path.name,
            "sha256": hashlib.sha256(session_path.read_bytes()).hexdigest(),
            "uploadedObject": dict(uploaded_session) if uploaded_session is not None else None,
            "uploadStatus": upload_status,
            "uploadFailureType": upload_failure_type,
        },
    }


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Run four real Gemini/ADK launch-readiness tasks and write a redacted JSONL session "
            "that FleetScope can follow and replay. Without --run this only validates and prints "
            "the plan; it makes no network or model call."
        )
    )
    parser.add_argument("--run", action="store_true", help="issue real Vertex AI and Google API calls")
    parser.add_argument("--upload", action="store_true", help="upload JSONL and proof to Cloud Storage after the run")
    parser.add_argument("--project", default=os.environ.get("GOOGLE_CLOUD_PROJECT", ""))
    parser.add_argument(
        "--location",
        default=os.environ.get("FLEETSCOPE_CLOUD_RUN_LOCATION", "us-central1"),
        help="regional Cloud Run location used by the read-only service probe",
    )
    parser.add_argument(
        "--model-location",
        default=os.environ.get("GOOGLE_CLOUD_LOCATION", "global"),
        choices=("global", "us", "eu"),
        help="Gemini 3.7 Flash Agent Platform endpoint",
    )
    parser.add_argument("--service", default=os.environ.get("FLEETSCOPE_CLOUD_RUN_SERVICE", ""))
    parser.add_argument("--bucket", default=os.environ.get("FLEETSCOPE_SESSION_BUCKET", ""))
    parser.add_argument("--model", default=os.environ.get("FLEETSCOPE_ADK_MODEL", "gemini-3.7-flash"))
    parser.add_argument("--artifact-prefix", default=os.environ.get("FLEETSCOPE_SESSION_PREFIX", "fleetscope-sessions"))
    parser.add_argument("--max-model-calls", type=int, default=6)
    parser.add_argument("--timeout-seconds", type=float, default=180.0)
    parser.add_argument("--session-id", default="")
    parser.add_argument("--output-root", type=Path, default=Path(".fleetscope/sessions"))
    return parser


def _config(args: argparse.Namespace) -> LaunchReadinessConfig:
    return LaunchReadinessConfig(
        project=args.project,
        location=args.location,
        service=args.service,
        bucket=args.bucket,
        model=args.model,
        model_location=args.model_location,
        artifact_prefix=args.artifact_prefix,
        max_model_calls=args.max_model_calls,
        timeout_seconds=args.timeout_seconds,
    ).validate()


def _session_id(raw: str) -> str:
    if raw:
        if not re.fullmatch(r"[A-Za-z0-9._-]+", raw):
            raise InvalidLaunchReadinessConfig("session-id contains unsupported characters")
        return raw
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return f"fs-{stamp}-{uuid.uuid4().hex[:8]}"


def _require_live_opt_in(args: argparse.Namespace) -> None:
    if args.upload and not args.run:
        raise LiveRunRefused("refused: --upload requires --run")
    if not args.run:
        return
    if os.environ.get("FLEETSCOPE_ALLOW_MODEL_CALLS") != "true":
        raise LiveRunRefused(
            "refused: --run can spend Google Cloud credit; set FLEETSCOPE_ALLOW_MODEL_CALLS=true"
        )
    enterprise_enabled = os.environ.get("GOOGLE_GENAI_USE_ENTERPRISE", "").lower() == "true"
    legacy_vertex_enabled = os.environ.get("GOOGLE_GENAI_USE_VERTEXAI", "").lower() == "true"
    if not (enterprise_enabled or legacy_vertex_enabled):
        raise LiveRunRefused(
            "refused: this proof requires Agent Platform; set "
            "GOOGLE_GENAI_USE_ENTERPRISE=true (or legacy GOOGLE_GENAI_USE_VERTEXAI=true)"
        )


def main(argv: Sequence[str] | None = None) -> int:
    parser = _parser()
    args = parser.parse_args(argv)
    try:
        config = _config(args)
        _require_live_opt_in(args)
        adk_session_id = _session_id(args.session_id)
    except (InvalidLaunchReadinessConfig, LiveRunRefused) as error:
        parser.error(str(error))

    plan = {
        "caseId": CASE_ID,
        "mode": "live" if args.run else "dry-run",
        "config": asdict(config),
        "agents": [ROOT_AGENT, *SPECIALIST_AGENTS],
        "cloudOperationsDuringWorkflow": ["Cloud Run services.get", "Cloud Storage buckets.get"],
        "fleetScopeRole": "read-only JSONL observer",
    }
    if not args.run:
        print(json.dumps(plan, indent=2, sort_keys=True))
        return 0

    try:
        # Validate ADC before touching the output tree. A missing credential or
        # malformed ADC file should not leave an empty session directory that
        # looks like a partially captured run.
        client = AuthorizedGoogleClient()
    except Exception as error:  # noqa: BLE001 - keep credential details private
        parser.error(f"Google client setup failed: {type(error).__name__}")

    session_dir = args.output_root / adk_session_id
    try:
        session_dir.mkdir(parents=True, exist_ok=False)
    except FileExistsError:
        parser.error(f"session directory already exists: {session_dir}")
    session_path = session_dir / "session.jsonl"
    proof_path = session_dir / "session.proof"

    print(f"session_jsonl={session_path.resolve()}", file=sys.stderr, flush=True)
    print(
        "watch_command="
        f"cargo run -q -p fleetscope-cli --bin fleetscope -- {session_path.resolve()} --follow",
        file=sys.stderr,
        flush=True,
    )

    result = asyncio.run(
        run_live_session(
            config,
            adk_session_id=adk_session_id,
            output_path=session_path,
            client=client,
        )
    )

    uploaded_session: dict[str, Any] | None = None
    upload_failure_type: str | None = None
    if args.upload:
        try:
            object_name = artifact_object_name(config, adk_session_id, session_path.name)
            uploaded_session = client.upload_bytes(
                bucket=config.bucket,
                object_name=object_name,
                content=session_path.read_bytes(),
                content_type="application/x-ndjson",
            )
        except Exception as error:  # noqa: BLE001 - retain local proof on upload failure
            upload_failure_type = type(error).__name__

    proof = _proof(
        config=config,
        adk_session_id=adk_session_id,
        session_path=session_path,
        result=result,
        uploaded_session=uploaded_session,
        upload_failure_type=upload_failure_type,
    )
    proof_path.write_text(json.dumps(proof, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    if args.upload and uploaded_session is not None:
        try:
            client.upload_bytes(
                bucket=config.bucket,
                object_name=artifact_object_name(config, adk_session_id, proof_path.name),
                content=proof_path.read_bytes(),
                content_type="application/json",
            )
        except Exception as error:  # noqa: BLE001 - retain local proof on upload failure
            upload_failure_type = type(error).__name__
            # The first upload may have succeeded while the proof upload did
            # not. Rewrite the local manifest so it records that partial state.
            proof = _proof(
                config=config,
                adk_session_id=adk_session_id,
                session_path=session_path,
                result=result,
                uploaded_session=uploaded_session,
                upload_failure_type=upload_failure_type,
            )
            proof_path.write_text(
                json.dumps(proof, indent=2, sort_keys=True) + "\n", encoding="utf-8"
            )

    output = {"session": str(session_path), "proof": str(proof_path), **result}
    if upload_failure_type:
        output["uploadFailureType"] = upload_failure_type
    print(json.dumps(output, sort_keys=True))
    return 0 if result.get("succeeded") and not upload_failure_type else 1


def _epoch_now() -> float:
    return datetime.now(timezone.utc).timestamp()


def _safe_decision_label(value: str) -> str:
    """Keep model-produced final output to a closed, non-sensitive label."""
    normalized = " ".join(value.split()).upper()
    if re.search(r"\bNOT[_ -]?READY\b", normalized):
        return "NOT_READY"
    if re.search(r"\bREADY\b", normalized):
        return "READY"
    return "DECISION_RECORDED"


if __name__ == "__main__":
    raise SystemExit(main())
