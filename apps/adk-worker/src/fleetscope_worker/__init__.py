"""The FleetScope ADK worker.

Import layers deliberately:

* `contract`, `faults`, `tools` and `capture` import NO vendor SDK. They are the
  canonical event shape, the fault definition, the allowlisted read and the
  translation from a runtime callback into a FleetScope event.
* `agents` is the ONLY module that imports `google.adk`.

That split is what lets the whole contract be tested with no SDK, no API key and
no network, and it is what keeps the vendor's event shape from leaking into
FleetScope's evidence.
"""

from .contract import SCHEMA, EventStream, WorkerEvent

__all__ = ["SCHEMA", "EventStream", "WorkerEvent"]
