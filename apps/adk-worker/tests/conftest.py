from dataclasses import dataclass
from typing import Any, Mapping

from fleetscope_worker.tools import HttpResponse

REPO_BODY: Mapping[str, Any] = {
    "default_branch": "main",
    "stargazers_count": 1234,
    "archived": False,
    "license": {"spdx_id": "Apache-2.0"},
}


@dataclass
class FakeHttp:
    """A read-only transport that records every URL it was asked for.

    It has no `post`, which is the point: a test cannot accidentally prove a
    write path that the production port does not expose either.
    """

    status: int = 200
    body: Mapping[str, Any] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        self.calls: list[str] = []
        if self.body is None:
            self.body = REPO_BODY

    def get(self, url: str, *, timeout_s: float) -> HttpResponse:
        self.calls.append(url)
        return HttpResponse(status=self.status, body=self.body)


def frozen_clock(start: int = 0):
    """A deterministic clock, so event order is proved by sequence rather than
    by whatever the wall clock happened to do."""
    counter = {"n": start}

    def tick() -> str:
        counter["n"] += 1
        return f"2026-08-29T12:00:{counter['n']:02d}.000Z"

    return tick
