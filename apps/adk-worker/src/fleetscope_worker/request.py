"""The closed request contract.

# Why unknown fields are rejected rather than ignored

Ignoring an unknown field is indistinguishable, from the caller's side, from
honouring it. A caller who sends `{"target": "attacker/repo"}` and gets a
successful run back has every reason to believe the field worked, and the next
person to add a permissive `request.get("target", ...)` turns that belief into a
vulnerability. Rejecting names the field, so the contract is enforced instead of
merely documented.

The request carries identifiers ONLY. Everything that spends money or reaches
the network is declared in `scenario.py`, in server source.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal, Mapping

#: The complete set of fields a caller may send. Anything else is refused.
ALLOWED_FIELDS: frozenset[str] = frozenset(
    {"runId", "sessionId", "correlationId", "scenarioId", "mode"}
)

REQUIRED_FIELDS: tuple[str, ...] = ("runId", "sessionId", "correlationId", "scenarioId")

#: `pure` replays the scenario deterministically with no runtime and no model,
#: and labels its evidence `recorded`. `adk` invokes a real ADK runtime.
Mode = Literal["pure", "adk"]
MODES: frozenset[str] = frozenset({"pure", "adk"})


class InvalidRequest(Exception):
    """The request is not a shape this worker will act on."""


@dataclass(frozen=True)
class RunRequest:
    run_id: str
    session_id: str
    correlation_id: str
    scenario_id: str
    mode: Mode


def parse_request(raw: Mapping[str, Any]) -> RunRequest:
    if not isinstance(raw, Mapping):
        raise InvalidRequest("request must be a JSON object")

    unknown = sorted(set(raw) - ALLOWED_FIELDS)
    if unknown:
        # Named explicitly: a caller must not be able to believe a field worked.
        raise InvalidRequest(
            f"refused: these fields are not part of the contract and cannot steer "
            f"a run: {', '.join(unknown)}"
        )

    for field in REQUIRED_FIELDS:
        value = raw.get(field)
        if not isinstance(value, str) or value.strip() == "":
            raise InvalidRequest(f"refused: {field} must be a non-empty string")

    mode = raw.get("mode", "pure")
    if mode not in MODES:
        raise InvalidRequest(f"refused: mode must be one of {sorted(MODES)}, got {mode!r}")

    return RunRequest(
        run_id=str(raw["runId"]),
        session_id=str(raw["sessionId"]),
        correlation_id=str(raw["correlationId"]),
        scenario_id=str(raw["scenarioId"]),
        mode=mode,  # type: ignore[arg-type]
    )
