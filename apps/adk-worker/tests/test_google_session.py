from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
from typing import Any

import pytest
from google.adk.events import Event
from google.genai import types

from fleetscope_worker.agents import build_launch_readiness_workflow
from fleetscope_worker.google_session import (
    FRAMEWORK_VERSION,
    LiveRunRefused,
    SessionRecorder,
    _proof,
    _redacted_event,
    _require_live_opt_in,
    _safe_decision_label,
    main,
    run_live_session,
)
from fleetscope_worker.launch_readiness import (
    ROOT_AGENT,
    SPECIALIST_AGENTS,
    LaunchReadinessConfig,
)


def config() -> LaunchReadinessConfig:
    return LaunchReadinessConfig(
        project="example-project",
        location="us-central1",
        service="fleetscope",
        bucket="fleetscope-sessions-demo",
    ).validate()


def test_workflow_has_four_fixed_direct_children_and_six_call_shape() -> None:
    def inspect_cloud_run_service() -> dict[str, str]:
        return {"status": "ok"}

    def inspect_storage_bucket() -> dict[str, str]:
        return {"status": "ok"}

    workflow = build_launch_readiness_workflow(
        model="gemini-3.7-flash",
        before_model_callback=lambda *_: None,
        cloud_run_probe=inspect_cloud_run_service,
        storage_probe=inspect_storage_bucket,
        budget_report={"maxModelCalls": 6, "timeoutSeconds": 180, "cloudReads": 2},
    )

    assert workflow.name == ROOT_AGENT
    assert tuple(agent.name for agent in workflow.sub_agents) == SPECIALIST_AGENTS
    assert [agent.output_key for agent in workflow.sub_agents] == [
        "cloud_run_report",
        "storage_report",
        "budget_report",
        "launch_decision",
    ]
    assert [tool.name for tool in workflow.sub_agents[0].tools] == [
        "inspect_cloud_run_service"
    ]
    assert [tool.name for tool in workflow.sub_agents[1].tools] == ["inspect_storage_bucket"]
    assert workflow.sub_agents[2].tools == []


def test_redaction_removes_thought_parts_and_secret_shaped_fields() -> None:
    redacted = _redacted_event(
        {
            "content": {
                "parts": [
                    {"text": "hidden", "thought": True},
                    {"text": "visible"},
                    {
                        "functionCall": {
                            "name": "safe_tool",
                            "args": {
                                "apiKey": "one",
                                "x-goog-api-key": "two",
                                "private_key": "three",
                                "safe": "kept",
                            },
                        }
                    },
                ]
            },
            "customMetadata": {"accessToken": "four"},
        },
        metadata={"framework": "google-adk"},
    )

    assert redacted["content"]["parts"] == [
        {"text": "visible"},
        {
            "functionCall": {
                "name": "safe_tool",
                "args": {
                    "apiKey": "[REDACTED]",
                    "x-goog-api-key": "[REDACTED]",
                    "private_key": "[REDACTED]",
                    "safe": "kept",
                },
            }
        },
    ]
    assert redacted["customMetadata"] == {
        "accessToken": "[REDACTED]",
        "fleetscope": {"framework": "google-adk"},
    }


def test_provider_error_messages_are_removed_but_failure_code_survives() -> None:
    redacted = _redacted_event(
        {
            "author": "cloud_run_probe",
            "errorCode": "deadline_exceeded",
            "errorMessage": "secret prompt and resource payload",
        },
        metadata={"framework": "google-adk"},
    )

    assert redacted["errorCode"] == "DEADLINE_EXCEEDED"
    assert "errorMessage" not in redacted
    assert "secret prompt" not in json.dumps(redacted)


def test_provider_error_without_a_safe_code_gets_a_generic_marker() -> None:
    redacted = _redacted_event(
        {"errorMessage": "secret provider response", "error_code": {"private": "value"}},
        metadata={"framework": "google-adk"},
    )

    assert redacted["errorCode"] == "PROVIDER_ERROR"
    assert "errorMessage" not in redacted


def test_unsafe_provider_model_version_is_not_persisted() -> None:
    redacted = _redacted_event(
        {"modelVersion": "gemini-3.7-flash\nprivate-token"},
        metadata={"framework": "google-adk"},
    )

    assert "modelVersion" not in redacted


def test_recorder_flushes_incremental_redacted_jsonl_and_tracks_provider_model(
    tmp_path: Path,
) -> None:
    path = tmp_path / "session.jsonl"
    recorder = SessionRecorder(path, adk_session_id="adk-1", config=config())
    event = Event(
        id="provider-1",
        invocation_id="inv-1",
        author="cloud_run_probe",
        timestamp=1_787_900_001.0,
        model_version="gemini-3.7-flash-001",
        custom_metadata={"apiKey": "must-not-persist"},
        content=types.Content(
            role="model",
            parts=[
                types.Part(text="private chain", thought=True),
                types.Part(text="Cloud Run is ready."),
            ],
        ),
    )

    recorder.write_event(event)
    lines_while_open = [json.loads(line) for line in path.read_text().splitlines()]
    assert len(lines_while_open) == 2, "line-buffered output must be visible before close"
    assert lines_while_open[0]["author"] == "user"
    assert lines_while_open[1]["content"]["parts"] == [{"text": "Cloud Run is ready."}]
    assert lines_while_open[1]["branch"] == "launch_readiness.cloud_run_probe"
    assert lines_while_open[1]["customMetadata"]["apiKey"] == "[REDACTED]"
    assert lines_while_open[1]["customMetadata"]["fleetscope"]["frameworkVersion"] == FRAMEWORK_VERSION
    assert recorder.observed_model_versions == {"gemini-3.7-flash-001"}
    assert recorder.viewer_session_id == "inv-1"

    recorder.finish(succeeded=True, detail="READY")
    recorder.close()
    recorder.close()
    assert len(path.read_text().splitlines()) == 3


def test_proof_keeps_configured_and_provider_observed_models_separate(tmp_path: Path) -> None:
    session = tmp_path / "session.jsonl"
    session.write_text('{"author":"root"}\n', encoding="utf-8")
    proof = _proof(
        config=config(),
        adk_session_id="adk-1",
        session_path=session,
        result={
            "viewerSessionId": "inv-1",
            "observedModelVersions": ["gemini-3.7-flash-001"],
            "modelCalls": 6,
            "eventCount": 20,
            "succeeded": True,
            "detail": "READY",
        },
        uploaded_session=None,
    )

    assert proof["configuredModel"] == "gemini-3.7-flash"
    assert proof["observedModelVersions"] == ["gemini-3.7-flash-001"]
    assert proof["modelEvidence"] == "observed"
    assert proof["jsonl"]["uploadedObject"] is None
    assert proof["workflow"]["agents"] == [ROOT_AGENT, *SPECIALIST_AGENTS]


def test_final_model_output_is_reduced_to_a_closed_decision_label() -> None:
    assert _safe_decision_label("READY — URI https://private.example and token=secret") == "READY"
    assert _safe_decision_label("NOT_READY because Cloud Storage failed") == "NOT_READY"
    assert _safe_decision_label("provider returned an unparseable answer") == "DECISION_RECORDED"


def test_dry_run_performs_no_client_construction_or_output_write(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    def forbidden_client(*_args: Any, **_kwargs: Any) -> None:
        raise AssertionError("dry-run constructed a network client")

    monkeypatch.setattr("fleetscope_worker.google_session.AuthorizedGoogleClient", forbidden_client)
    output_root = tmp_path / "sessions"
    assert (
        main(
            [
                "--project",
                "example-project",
                "--location",
                "us-central1",
                "--service",
                "fleetscope",
                "--bucket",
                "fleetscope-sessions-demo",
                "--output-root",
                str(output_root),
            ]
        )
        == 0
    )
    assert json.loads(capsys.readouterr().out)["mode"] == "dry-run"
    assert not output_root.exists()


def test_run_and_upload_require_explicit_independent_gates(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with pytest.raises(LiveRunRefused, match="--upload requires --run"):
        _require_live_opt_in(argparse.Namespace(run=False, upload=True))

    args = argparse.Namespace(run=True, upload=False)
    monkeypatch.delenv("FLEETSCOPE_ALLOW_MODEL_CALLS", raising=False)
    monkeypatch.delenv("GOOGLE_GENAI_USE_VERTEXAI", raising=False)
    with pytest.raises(LiveRunRefused, match="can spend Google Cloud credit"):
        _require_live_opt_in(args)

    monkeypatch.setenv("FLEETSCOPE_ALLOW_MODEL_CALLS", "true")
    with pytest.raises(LiveRunRefused, match="requires Vertex AI"):
        _require_live_opt_in(args)

    monkeypatch.setenv("GOOGLE_GENAI_USE_VERTEXAI", "true")
    _require_live_opt_in(args)


def test_setup_failure_is_recorded_before_adk_session_exists(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    def fail_setup(**_kwargs: Any) -> Any:
        raise RuntimeError("dependency detail must not reach the proof")

    monkeypatch.setattr(
        "fleetscope_worker.google_session.build_launch_readiness_workflow", fail_setup
    )
    path = tmp_path / "session.jsonl"
    result = asyncio.run(
        run_live_session(
            config(),
            adk_session_id="adk-setup-failure",
            output_path=path,
            client=object(),  # setup fails before this client can be used
        )
    )

    assert result["succeeded"] is False
    assert result["detail"] == "workflow raised RuntimeError"
    assert result["modelCalls"] == 0
    assert len(path.read_text(encoding="utf-8").splitlines()) == 2
    assert json.loads(path.read_text(encoding="utf-8").splitlines()[-1])["errorCode"] == "WORKFLOW_FAILED"


def test_adc_setup_failure_does_not_create_an_empty_session_folder(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setenv("FLEETSCOPE_ALLOW_MODEL_CALLS", "true")
    monkeypatch.setenv("GOOGLE_GENAI_USE_VERTEXAI", "true")

    def fail_client(*_args: Any, **_kwargs: Any) -> Any:
        raise RuntimeError("credential detail must not reach the user")

    monkeypatch.setattr("fleetscope_worker.google_session.AuthorizedGoogleClient", fail_client)
    with pytest.raises(SystemExit) as error:
        main(
            [
                "--run",
                "--project",
                "example-project",
                "--location",
                "us-central1",
                "--service",
                "fleetscope",
                "--bucket",
                "fleetscope-sessions-demo",
                "--output-root",
                str(tmp_path / "sessions"),
            ]
        )

    assert error.value.code == 2
    assert not (tmp_path / "sessions").exists()


def test_upload_failure_keeps_local_proof_and_returns_nonzero(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("FLEETSCOPE_ALLOW_MODEL_CALLS", "true")
    monkeypatch.setenv("GOOGLE_GENAI_USE_VERTEXAI", "true")

    class FakeClient:
        def upload_bytes(self, **_kwargs: Any) -> dict[str, Any]:
            raise RuntimeError("upload detail must not reach the proof")

    async def fake_run_live_session(
        _config: LaunchReadinessConfig, *, output_path: Path, **_kwargs: Any
    ) -> dict[str, Any]:
        output_path.write_text('{"author":"launch_readiness"}\n', encoding="utf-8")
        return {
            "succeeded": True,
            "detail": "READY",
            "modelCalls": 6,
            "eventCount": 2,
            "viewerSessionId": "inv-1",
            "observedInvocationIds": ["inv-1"],
            "observedModelVersions": ["gemini-3.7-flash-001"],
        }

    monkeypatch.setattr("fleetscope_worker.google_session.AuthorizedGoogleClient", FakeClient)
    monkeypatch.setattr("fleetscope_worker.google_session.run_live_session", fake_run_live_session)
    output_root = tmp_path / "sessions"
    assert (
        main(
            [
                "--run",
                "--upload",
                "--project",
                "example-project",
                "--location",
                "us-central1",
                "--service",
                "fleetscope",
                "--bucket",
                "fleetscope-sessions-demo",
                "--session-id",
                "adk-upload-failure",
                "--output-root",
                str(output_root),
            ]
        )
        == 1
    )

    output = json.loads(capsys.readouterr().out)
    proof_path = Path(output["proof"])
    proof = json.loads(proof_path.read_text(encoding="utf-8"))
    assert output["uploadFailureType"] == "RuntimeError"
    assert proof["jsonl"]["uploadStatus"] == "failed"
    assert proof["jsonl"]["uploadFailureType"] == "RuntimeError"
    assert proof["jsonl"]["uploadedObject"] is None
