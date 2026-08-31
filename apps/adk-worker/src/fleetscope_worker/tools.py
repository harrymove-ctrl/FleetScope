"""The one external capability this worker has: an allowlisted, read-only read.

# Why the transport port has exactly one method

`ReadOnlyHttp` exposes `get` and nothing else. "No external write" is then a
property of the type rather than a promise in a comment: there is no method on
the port that could mutate anything, so no agent, prompt or injected string can
reach one. The real implementation pins the HTTP method to GET as well, so the
guarantee survives someone later adding a method to the port.

# Why the allowlist is a frozenset checked before anything else

The target is the one value in this system that an untrusted model output could
influence. It is compared against a closed set before a URL is built, so a
crafted target cannot become a request at all, and it fails closed: an unknown
target is refused, never attempted.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Protocol

from .attempts import AttemptStore, MemoryAttemptStore
from .faults import ControlledFault

#: Repositories this worker may read. Closed set, checked before URL building.
DEFAULT_ALLOWLIST: frozenset[str] = frozenset({"google/adk-python"})


class TargetNotAllowed(Exception):
    """The requested target is not in the allowlist. Not retryable, ever."""


@dataclass(frozen=True)
class ToolFailure(Exception):
    """A failed read that says what kind of failure it was."""

    message: str
    truth: str
    retryable: bool

    def __str__(self) -> str:
        return self.message


@dataclass(frozen=True)
class HttpResponse:
    status: int
    body: Mapping[str, Any]


class ReadOnlyHttp(Protocol):
    """A transport that can only read. There is deliberately no `post`."""

    def get(self, url: str, *, timeout_s: float) -> HttpResponse: ...


@dataclass(frozen=True)
class RepositoryFacts:
    """What the security review is allowed to learn. A closed shape, so a
    surprise field in an upstream response cannot reach the evidence."""

    target: str
    default_branch: str
    stars: int
    archived: bool
    license: str | None

    def to_payload(self) -> dict[str, Any]:
        return {
            "target": self.target,
            "defaultBranch": self.default_branch,
            "stars": self.stars,
            "archived": self.archived,
            "license": self.license,
        }


class RepositoryMetadataTool:
    """Reads public repository metadata for an allowlisted target.

    The read is idempotent: the same target yields the same facts and changes
    nothing upstream. That is what makes exactly-one-retry safe, and the tool
    records attempts per idempotency key so a test can prove the retry reused
    the key rather than starting a second logical operation.
    """

    name = "read_repository_metadata"
    side_effect_class = "idempotent_read"

    def __init__(
        self,
        transport: ReadOnlyHttp,
        *,
        allowlist: frozenset[str] = DEFAULT_ALLOWLIST,
        fault: ControlledFault | None = None,
        timeout_s: float = 10.0,
        attempts: AttemptStore | None = None,
    ) -> None:
        self._transport = transport
        self._allowlist = allowlist
        self._fault = fault
        self._timeout_s = timeout_s
        # A port, not a dict: the exactly-once claim is about a logical
        # operation, and a redelivery after a restart is the case it is about.
        self._attempts: AttemptStore = attempts or MemoryAttemptStore()

    def attempts_for(self, idempotency_key: str) -> int:
        return self._attempts.attempts(idempotency_key)

    def read(self, target: str, *, idempotency_key: str) -> RepositoryFacts:
        if target not in self._allowlist:
            raise TargetNotAllowed(
                f"{target!r} is not an allowlisted target; refusing to build a request"
            )

        # Reserved before anything is attempted, so a crash mid-flight counts.
        attempt = self._attempts.reserve(idempotency_key)

        if self._fault is not None and self._fault.applies_to(attempt):
            raise ToolFailure(
                message=self._fault.describe(),
                truth="controlled_fault",
                retryable=True,
            )

        response = self._transport.get(
            f"https://api.github.com/repos/{target}", timeout_s=self._timeout_s
        )
        if response.status != 200:
            raise ToolFailure(
                message=f"upstream returned HTTP {response.status}",
                truth="live",
                retryable=response.status >= 500,
            )

        body = response.body
        return RepositoryFacts(
            target=target,
            default_branch=str(body.get("default_branch", "")),
            stars=int(body.get("stargazers_count", 0)),
            archived=bool(body.get("archived", False)),
            license=(body.get("license") or {}).get("spdx_id"),
        )
