# Session Observer requirements

**Status:** active

**Last updated:** 2026-08-30

## Problem

A multi-agent runtime writes a long append-only session, but a developer cannot
quickly identify the agent tree, current activity, unanswered tool, explicit
failure, or the moment history diverged. Raw JSONL is poor live UI and poor
replay UI.

## Outcome

FleetScope turns one producer-owned session into a synchronized graph, agent
rail, event inspector, and replay timeline without taking ownership of agent
execution.

## Viewer requirements

### Must

- MUST open a supported JSONL/JSON file or session folder.
- MUST recognize the Google ADK format used by the demo.
- MUST preserve every parsed agent's provider path and parent relationship.
- MUST show messages, tool calls/results, errors, and explicit terminal status.
- MUST tail complete appended JSONL lines in local follow mode.
- MUST support play/pause, step, seek, speed, and return to live edge.
- MUST show unanswered tools and missing terminal evidence as waiting/unknown.
- MUST remove `thought: true` before any renderable projection.
- MUST provide a headless summary from the same projection as the viewer.
- MUST require no model, API key, cloud service, or network for recorded mode.

### Should

- SHOULD report producer framework/version and provider-observed model version.
- SHOULD accept camelCase and snake_case ADK field names.
- SHOULD expose a stable projection fingerprint for native/browser parity.
- SHOULD identify malformed recognized input by line.
- SHOULD preserve deeper agent paths even when the visual renderer flattens them.

## Demo producer requirements

- MUST use a real Google agent framework; current pin is Google ADK 2.8.0.
- MUST use Vertex AI and a Gemini 3.5+ model for the provider-backed take.
- MUST build root `launch_readiness` with exactly four direct child tasks:
  `cloud_run_probe`, `storage_probe`, `budget_guard`, and
  `launch_reviewer`.
- MUST limit execution to six model calls and at most 180 seconds.
- MUST expose exactly two read-only Google API operations during the workflow:
  Cloud Run `services.get` and Cloud Storage `buckets.get`.
- MUST perform zero cloud writes during the agent workflow.
- MUST make live execution an explicit `--run` action guarded by
  `FLEETSCOPE_ALLOW_MODEL_CALLS=true` and
  `GOOGLE_GENAI_USE_VERTEXAI=true`.
- MUST make upload a separate explicit `--upload` action after the agents stop.
- MUST flush redacted events one line at a time for `--follow`.
- MUST remove thought parts and redact secret-shaped keys before persistence.
- MUST keep configured model and provider-observed `modelVersion` separate.
- MUST retain a local JSONL and proof manifest for a completed or failed run.
- MUST enforce the six-call ceiling both globally and per specialist allocation:
  Cloud Run 2, Storage 2, budget 1, reviewer 1.

## Non-goals

- Agent orchestration by FleetScope
- Start, retry, approval, authorization, or mutation controls
- CASE-1042, Warden, Model Armor, ERP, or enterprise case management
- Firestore, Cloud SQL, Pub/Sub, or a transactional job ledger
- Hidden chain-of-thought rendering
- Arbitrary prompts, targets, models, or Cloud operations from the browser
- Claiming a configured model or fixture as live execution proof

## Success measures

1. A developer identifies all five demo nodes in under 30 seconds.
2. A developer finds an unanswered/failed tool in under 30 seconds.
3. The recorder-generated JSONL opens in FleetScope while still growing.
4. CLI and browser agree on the final projection fingerprint.
5. Ten local replays produce the same summary and zero external calls.
6. The real take ties ADK version, provider model version, Cloud Run
   service/revision, optional Storage object, and graph to one session ID.
7. The four-minute video demonstrates live follow and finished replay without a
   second provider run.

## Locked decisions

- **D1 — Unit:** session, not enterprise Case.
- **D2 — Boundary:** FleetScope reads; the producer acts.
- **D3 — Timeline:** live and replay are one event list with a moving/fixed edge.
- **D4 — Ground truth:** explicit terminal/tool facts outrank derivation.
- **D5 — Google workflow:** fixed launch-readiness sequence with four direct
  children.
- **D6 — Model:** Vertex default `gemini-3.7-flash`; provider availability and
  `modelVersion` must be proven live.
- **D7 — Storage:** local JSONL first; optional post-run Cloud Storage upload.
- **D8 — Category:** Taskmaster. Official rubric 40% action / 30% architecture
  / 30% demo; deadline 1 Sep 2026 07:00 GMT+7
  ([hackathon-official](../product/hackathon-official.md)). Fleet track
  reconsidered and rejected (no production-data/compliance proof).
- **D9 — Cost:** exact six-call ceiling; dry-run remains zero-cost.

## Unverified external inputs

- Real project, region, service, bucket, and ADC identity
- Vertex model availability for the chosen project/region
- Cloud Run deployment URL/revision
- Cloud Storage upload permission
- Devpost authenticated fields and public video

## Links

- [Product brief](../product/session-observer.md)
- [Design](../design/session-observer.md)
- [ADR 0007](../decisions/0007-session-observer-scope.md)
