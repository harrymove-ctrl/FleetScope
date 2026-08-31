# 0007 — Read-only Session Observer with a fixed Google producer

- **Status:** Accepted
- **Date:** 2026-08-30

## Context

The earlier CASE-1042 plan turned FleetScope into an enterprise orchestration
and policy runtime. That contradicted the actual product goal: let a developer
watch existing agents work from their append-only session, live or later.

The hackathon still requires a real autonomous Gemini workflow, a Google agent
framework, and Google Cloud proof. That producer must be concrete without
moving execution responsibility into FleetScope.

## Decision

FleetScope is a read-only **Session Observer**. A producer-owned JSONL session
is the source of truth. One provider-neutral projection feeds the CLI, browser,
and headless inspect surface.

The shipped hackathon build exposes only the Google ADK adapter. The historical
Claude dialect is retained behind the explicit `legacy-claude` Cargo feature so
old fixtures remain testable, but it is not registered by default and is not a
supported demo path.

For the Google demo, the producer is the fixed
`google-cloud-launch-readiness` workflow:

- Google ADK 2.8.0 `SequentialAgent`;
- root `launch_readiness`;
- direct children `cloud_run_probe`, `storage_probe`, `budget_guard`, and
  `launch_reviewer`;
- Vertex AI default `gemini-3.7-flash`;
- Cloud Run `services.get` and Cloud Storage `buckets.get`;
- six model calls, at most 180 seconds, zero cloud writes during workflow;
- incremental redacted JSONL;
- optional explicit post-run Cloud Storage upload.

Configured model and provider-observed `modelVersion` are separate evidence
concepts. FleetScope reports only the latter as observed execution.

The submission category is **The Taskmaster** because the producer completes a
fixed multi-step operational workflow. FleetScope supplies the observability and
replay that make its work understandable.

## Alternatives considered

### CASE-1042 enterprise runtime

Rejected for this product and demo. Warden, Model Armor, ERP, Firestore, Pub/Sub,
identity, approvals, and multi-week case management change FleetScope from an
observer into an operator and expand the proof surface dramatically.

### Firestore or Cloud SQL

Rejected. Immutable JSONL plus optional object storage needs no transactional
database. Reconsider only if FleetScope later owns concurrent writes/actions.

### Cloud Storage as the only Google service

Insufficient for the strongest video proof. Storage remains the artifact store;
Cloud Run supplies a visible deployed backend/read-only endpoint.

### Collaborative Partner category

Rejected. The fixed workflow does not center clarification and adaptive user
feedback. Taskmaster matches the actual multi-step action.

### Three tool-using specialist agents

Rejected for the fixed six-call budget. A deterministic budget report does not
need a tool call; using one would add an unnecessary seventh model turn.

## Consequences

- The product promise is small and coherent: ingest, graph, inspect, follow,
  replay, and redact.
- FleetScope cannot claim it started, fixed, authorized, or retried anything.
- Local recorded use remains zero-cost and offline.
- The demo topology fits the renderer's current one-level graph.
- Live proof needs one bounded provider run, not a database or job platform.
- Historical enterprise files remain only as explicitly superseded context.
- ADK `SequentialAgent` deprecation is visible in 2.8.0 tests; migration to
  `Workflow` is deferred until that API can preserve the required child-agent
  behavior and event shape.

## Links

- [Requirements](../requirements/session-observer.md)
- [Design](../design/session-observer.md)
- [Product brief](../product/session-observer.md)
- [Runtime runbook](../design/hackathon-runtime.md)
