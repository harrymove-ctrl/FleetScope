# Session Observer design

**Status:** active

**Last updated:** 2026-08-30

## Mission

Project a producer's append-only session into one faithful, navigable
live-or-replayed model. Filesystem/network IO stays at the edges; the portable
projection remains deterministic and provider-neutral.

## Architecture

```mermaid
flowchart LR
  O[Operator script] --> A[Google ADK 2.8.0<br/>SequentialAgent]
  X[Antigravity CLI<br/>stream-json] --> J
  A --> V[Vertex AI<br/>Gemini 3.7 Flash]
  A --> R[Cloud Run Admin API<br/>services.get]
  A --> S[Cloud Storage API<br/>buckets.get]
  A --> J[Redacted append-only<br/>session.jsonl]
  J --> D[Discovery / follow]
  D --> G[google-adk@1 adapter]
  G --> P[ViewerSession<br/>portable projection]
  P --> T[CLI TUI]
  P --> B[Astro/WASM viewer]
  P --> I[fleetscope inspect]
  J -. explicit post-run upload .-> C[(Cloud Storage object)]
```

FleetScope begins at JSONL. ADK, Vertex, and the Google API calls are producer
responsibilities.

The optional Antigravity demo is a second producer boundary. It fans out real
`agy` processes in plan mode and translates their public `stream-json` events
to the same ADK-compatible append-only envelope. The metadata names
`antigravity-cli-bridge 1`; it does not claim ADK executed the workers and it
does not inspect Antigravity's private conversation database. The browser can
retain a user-granted file handle and poll `getFile()` to follow that growing
JSONL locally; no bytes leave the tab.

## Producer topology

A `SequentialAgent` guarantees order and visibility:

```text
launch_readiness
├── cloud_run_probe
├── storage_probe
├── budget_guard
└── launch_reviewer
```

The two probes are tool-using LLM agents. Each needs one turn to call the tool
and one turn to consume the response. `budget_guard` receives a server-owned
report in its instruction and uses one turn. `launch_reviewer` consumes three
`output_key` values and uses one turn. Expected and maximum calls are six, with
the same per-agent allocation enforced before each provider call.

The budget agent intentionally has no tool. Giving a third deterministic report
a function tool would require a seventh model call with no additional external
evidence.

## Closed Cloud boundary

Validated operator configuration fixes project, region, service, bucket, model,
object prefix, call ceiling, and timeout. Models cannot choose these values.

The Cloud Run projection keeps only service, location, URI, ready revision,
terminal readiness, and latest-traffic percentage. The Storage projection keeps
only bucket, location, storage class, uniform-access state, and versioning. Raw
error bodies, IAM principals, labels, object names, and private metadata are not
written into the session.

## Recorder

For every ADK `Event`:

1. serialize with SDK aliases;
2. recursively redact secret-shaped keys;
3. remove `content.parts[*].thought == true`;
4. stamp the fixed SequentialAgent parent path when ADK leaves `branch` empty;
5. attach `customMetadata.fleetscope`;
6. write one compact JSON object and newline;
7. flush before awaiting the next event.

Synthetic start/end events make the root and terminal outcome explicit. They do
not invent child success; child terminal state still comes from ADK events.

Before projection, the ADK adapter canonicalizes the input set: exact duplicate
records are removed by a stable identity-plus-content key, records are sorted by
producer timestamp with that key as the tie-breaker, and records without a valid
timestamp are placed after timestamped evidence in stable-key order using fixed
epoch-relative offsets. The fallback never reads wall-clock time. Agent
declarations are discovered from the complete canonical set before spawn events
are emitted, so a child observed before its transfer acknowledgement cannot
create a second edge.

The local proof manifest includes the JSONL SHA-256, resource identifiers,
configured model, observed provider model versions, ADK version, call/event
counts, session IDs, result, and optional uploaded object metadata.

## Metadata truth

| Field | Owner | Allowed claim |
|---|---|---|
| `configuredModel` | operator/producer config | intended model |
| `frameworkVersion` | installed producer package | ADK build |
| `modelVersion` | ADK/provider event | model observed executing |
| Cloud Run revision/URI | read-only API response | resource state at probe time |
| uploaded object generation | Cloud Storage upload response | artifact persisted |

The Rust adapter reports an observed model only from `modelVersion`; it never
falls back to `configuredModel`.

## Projection invariants

- Append-only events are the source of truth.
- Exact duplicate or reordered input converges under stable identity/order rules;
  records that reuse a provider id with different content remain distinct.
- Explicit ground truth outranks inferred status.
- A pending tool call prevents an idle/completed inference.
- Seeking rebuilds the view from an event prefix.
- Content time drives domain state; wall time only drives presentation.
- Live and replay share the same model; edge position determines transport state.
- Hidden reasoning cannot enter the model.

## Failure behavior

| Failure | Behavior |
|---|---|
| Invalid config | Refuse before output/client creation |
| Model budget exceeded | Refuse before the next call; append failed root end |
| Timeout | Cancel drain, append safe failed root end |
| Provider exception | Persist type only, not raw message |
| Session-state lookup fails | Persist type only and mark failed |
| Reviewer emits no decision | Mark failed |
| Cloud API non-200 | Return bounded error projection |
| Upload fails | Local session/proof remain; manifest records `failed` or `partial` upload status and no false uploaded-object claim |
| Partial final JSONL line | Follower waits for newline |
| Unsupported/malformed session | Adapter refuses by format/line |

## Rollout and rollback

The new producer is additive. Recorded viewing remains the safe default and
requires none of the Google configuration. Rollback is to stop invoking
`demo:google-session`; existing adapters and fixtures remain usable. No data
migration or dual-write path exists.

## Performance and limits

- maximum six provider calls;
- maximum 180 seconds;
- two workflow HTTP reads;
- zero workflow HTTP writes;
- JSONL writes are line-buffered and incremental;
- event/detail previews stay bounded by the existing adapter;
- uploads happen only after the file is complete.

## Acceptance

- [x] Fixed five-node topology is constructible with ADK 2.8.0.
- [x] Dry-run constructs no client and writes no output.
- [x] Safe API projections and redaction are unit tested.
- [x] Provider/config model distinction is unit tested in Python and Rust.
- [x] Rust adapter accepts the generated metadata and five-node graph.
- [ ] Real Vertex/Cloud session captured.
- [ ] Same session verified in CLI and browser.
- [ ] Cloud Run revision/URL and optional Storage generation captured.
- [ ] Browser interaction QA completed in a non-sandboxed desktop environment.

## Links

- [Requirements](../requirements/session-observer.md)
- [Product brief](../product/session-observer.md)
- [Runtime/runbook](hackathon-runtime.md)
- [ADR 0007](../decisions/0007-session-observer-scope.md)
