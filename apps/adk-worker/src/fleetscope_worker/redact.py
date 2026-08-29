"""What may be written down about a tool call.

# Why this is an allowlist and not a denylist

Tool arguments and responses are the widest channel in the system: they carry
whatever a model decided to send and whatever an upstream service decided to
return. A denylist has to anticipate every secret shape anyone will ever put in
one. An allowlist only has to name the handful of fields the evidence actually
needs, and everything else is summarised as a count rather than a value.

So the evidence records "this tool was called with the target we already know
about, plus three other fields we did not record", which is auditable, instead
of a verbatim payload that might contain a bearer token.
"""

from __future__ import annotations

import re
from typing import Any, Mapping

REDACTED = "<redacted>"
MAX_STRING = 120

#: Keys whose values are never recorded, whatever the allowlist says.
_SECRET_KEY = re.compile(
    r"(key|token|secret|password|passwd|credential|authorization|auth|cookie|bearer|"
    r"signature|private)",
    re.IGNORECASE,
)

#: Values that look like a credential even under an innocent key.
_SECRET_PREFIX = ("sk-", "ghp_", "gho_", "github_pat_", "AIza", "Bearer ", "xoxb-", "-----BEGIN")
_HIGH_ENTROPY = re.compile(r"^[A-Za-z0-9_\-+/=.]{20,}$")


def looks_secret(key: str, value: Any) -> bool:
    if _SECRET_KEY.search(key):
        return True
    if not isinstance(value, str):
        return False
    if value.startswith(_SECRET_PREFIX):
        return True
    # Long, unbroken, mixed letters-and-digits: the shape of a credential rather
    # than of prose. A repository name like "google/adk-python" contains a slash
    # and no digits, so it is not caught by this.
    return bool(_HIGH_ENTROPY.match(value)) and any(c.isdigit() for c in value) and any(
        c.isalpha() for c in value
    )


def _scalar(value: Any) -> Any:
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, str):
        return value if len(value) <= MAX_STRING else f"{value[:MAX_STRING]}...<truncated>"
    # Structured values are never recorded verbatim: their shape is enough to
    # audit the call, and their contents are exactly what we cannot vouch for.
    if isinstance(value, Mapping):
        return {"<object>": len(value)}
    if isinstance(value, (list, tuple)):
        return {"<array>": len(value)}
    return REDACTED


def redact_mapping(raw: Any, *, allow: frozenset[str]) -> dict[str, Any]:
    """Keep the allowlisted, non-secret fields; count everything else."""
    if not isinstance(raw, Mapping):
        return {"<not-an-object>": True}

    kept: dict[str, Any] = {}
    withheld = 0
    for key, value in raw.items():
        name = str(key)
        if name in allow and not looks_secret(name, value):
            kept[name] = _scalar(value)
        else:
            withheld += 1
    if withheld:
        kept["redactedFields"] = withheld
    return kept
