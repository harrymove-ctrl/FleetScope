"""The real read-only HTTP transport.

`urllib.request.Request` defaults to GET, but the method is pinned explicitly
anyway: the guarantee that this worker cannot write to the internet should be
readable in one line, not inferred from a default that a later edit could change.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request

from .tools import HttpResponse, ToolFailure

USER_AGENT = "fleetscope-adk-worker/0.1 (+read-only)"


class UrllibReadOnlyHttp:
    def get(self, url: str, *, timeout_s: float) -> HttpResponse:
        request = urllib.request.Request(
            url,
            method="GET",
            headers={"User-Agent": USER_AGENT, "Accept": "application/vnd.github+json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout_s) as response:
                return HttpResponse(
                    status=response.status, body=json.loads(response.read().decode("utf-8"))
                )
        except urllib.error.HTTPError as error:
            return HttpResponse(status=error.code, body={})
        except (urllib.error.URLError, TimeoutError) as error:
            raise ToolFailure(
                message=f"transport error: {error}", truth="live", retryable=True
            ) from error


#: A fixed response used when the worker is told to stay offline.
#:
#: This is a RECORDED reading of the allowlisted target, not a live one. It
#: exists so an end-to-end test can prove the whole pipeline without depending
#: on GitHub being reachable. It is only ever reachable in `pure` mode, whose
#: evidence is already labelled `recorded`, so it cannot turn into a live claim.
RECORDED_REPOSITORY = {
    "default_branch": "main",
    "stargazers_count": 21319,
    "archived": False,
    "license": {"spdx_id": "Apache-2.0"},
}


class RecordedReadOnlyHttp:
    """Answers from a recorded fixture. Performs no network call at all."""

    def get(self, url: str, *, timeout_s: float) -> HttpResponse:
        return HttpResponse(status=200, body=RECORDED_REPOSITORY)
