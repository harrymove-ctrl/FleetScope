"""How many times a logical operation has been attempted.

# Why this is a port and not a dictionary

The exactly-once claim is about a logical operation, not about one process. A
counter in memory answers "have I already tried this?" only until the worker
restarts, and a redelivery after a crash is precisely the case the claim is
about. Making the store a port means the in-memory version stays the fast
default for tests while a durable file can be injected wherever the guarantee
has to survive a restart.

# The limitation this does NOT solve

`FileAttemptStore` is append-only and single-process. Two workers sharing one
file could both read the same count before either appends. That is acceptable
today because the API admits exactly one active run at a time, and it is stated
here rather than implied away. A multi-process deployment needs a lock or a
transactional store before it may claim exactly-once.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Protocol


class AttemptStore(Protocol):
    def attempts(self, key: str) -> int: ...

    def reserve(self, key: str) -> int:
        """Record one more attempt and return its 1-based number.

        Called BEFORE the external request, so a crash between reserving and
        acting can never look like an attempt that did not happen.
        """
        ...


class MemoryAttemptStore:
    def __init__(self) -> None:
        self._counts: dict[str, int] = {}

    def attempts(self, key: str) -> int:
        return self._counts.get(key, 0)

    def reserve(self, key: str) -> int:
        nxt = self._counts.get(key, 0) + 1
        self._counts[key] = nxt
        return nxt


class FileAttemptStore:
    """Append-only JSONL, so a restart reads back what was already attempted."""

    def __init__(self, path: str | Path) -> None:
        self._path = Path(path)
        self._path.parent.mkdir(parents=True, exist_ok=True)

    def _counts(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        try:
            text = self._path.read_text(encoding="utf-8")
        except FileNotFoundError:
            return counts
        for line in text.splitlines():
            if not line.strip():
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                # A torn final write must not erase the attempts before it.
                continue
            key = record.get("key")
            if isinstance(key, str):
                counts[key] = counts.get(key, 0) + 1
        return counts

    def attempts(self, key: str) -> int:
        return self._counts().get(key, 0)

    def reserve(self, key: str) -> int:
        nxt = self._counts().get(key, 0) + 1
        with self._path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps({"key": key, "attempt": nxt}) + "\n")
            handle.flush()
        return nxt
