import pytest
from conftest import FakeHttp
from fleetscope_worker.faults import ControlledFault
from fleetscope_worker.tools import (
    DEFAULT_ALLOWLIST,
    ReadOnlyHttp,
    RepositoryMetadataTool,
    TargetNotAllowed,
    ToolFailure,
)

TARGET = "google/adk-python"


def test_a_target_outside_the_allowlist_never_becomes_a_request():
    # Fail closed, and fail BEFORE a URL exists: the transport must not even be
    # asked. The target is the one field an untrusted model output can steer.
    http = FakeHttp()
    tool = RepositoryMetadataTool(http)
    with pytest.raises(TargetNotAllowed):
        tool.read("attacker/exfil", idempotency_key="k1")
    assert http.calls == [], "a disallowed target reached the transport"


def test_path_traversal_in_the_target_is_refused_rather_than_encoded():
    http = FakeHttp()
    with pytest.raises(TargetNotAllowed):
        RepositoryMetadataTool(http).read("../../etc/passwd", idempotency_key="k1")
    assert http.calls == []


def test_the_transport_port_exposes_no_way_to_write():
    # "No external write" should be a property of the type, not a promise in a
    # comment. If someone adds `post` to the port, this test fails.
    assert set(dir(ReadOnlyHttp)) & {"post", "put", "patch", "delete"} == set()


def test_an_allowlisted_read_returns_a_closed_set_of_facts():
    facts = RepositoryMetadataTool(FakeHttp()).read(TARGET, idempotency_key="k1")
    assert facts.to_payload() == {
        "target": TARGET,
        "defaultBranch": "main",
        "stars": 1234,
        "archived": False,
        "license": "Apache-2.0",
    }


def test_an_unexpected_upstream_field_cannot_reach_the_evidence():
    http = FakeHttp(body={"default_branch": "main", "secret_token": "leaked"})
    payload = RepositoryMetadataTool(http).read(TARGET, idempotency_key="k1").to_payload()
    assert "secret_token" not in payload


def test_a_controlled_fault_is_labelled_as_one():
    # The whole risk of an injected failure is that it becomes indistinguishable
    # from a real outage. The label is the mitigation.
    tool = RepositoryMetadataTool(FakeHttp(), fault=ControlledFault(fails_attempts=1))
    with pytest.raises(ToolFailure) as caught:
        tool.read(TARGET, idempotency_key="k1")
    assert caught.value.truth == "controlled_fault"
    assert caught.value.retryable is True


def test_the_fault_stops_interfering_after_its_configured_attempts():
    http = FakeHttp()
    tool = RepositoryMetadataTool(http, fault=ControlledFault(fails_attempts=1))
    with pytest.raises(ToolFailure):
        tool.read(TARGET, idempotency_key="k1")
    assert http.calls == [], "the faulted attempt must not reach the network"
    assert tool.read(TARGET, idempotency_key="k1").default_branch == "main"
    assert len(http.calls) == 1


def test_attempts_are_counted_per_idempotency_key():
    tool = RepositoryMetadataTool(FakeHttp())
    tool.read(TARGET, idempotency_key="k1")
    tool.read(TARGET, idempotency_key="k1")
    tool.read(TARGET, idempotency_key="k2")
    assert tool.attempts_for("k1") == 2
    assert tool.attempts_for("k2") == 1


def test_repeating_the_read_yields_the_same_facts():
    # This is what makes exactly-one-retry safe to permit.
    tool = RepositoryMetadataTool(FakeHttp())
    first = tool.read(TARGET, idempotency_key="k1")
    assert tool.read(TARGET, idempotency_key="k1") == first


def test_a_server_error_is_retryable_and_a_client_error_is_not():
    with pytest.raises(ToolFailure) as server:
        RepositoryMetadataTool(FakeHttp(status=503)).read(TARGET, idempotency_key="k1")
    assert server.value.retryable is True and server.value.truth == "live"

    with pytest.raises(ToolFailure) as client:
        RepositoryMetadataTool(FakeHttp(status=404)).read(TARGET, idempotency_key="k1")
    assert client.value.retryable is False


def test_the_default_allowlist_is_exactly_the_demo_target():
    assert DEFAULT_ALLOWLIST == frozenset({TARGET})
