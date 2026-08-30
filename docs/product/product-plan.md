# FleetScope product plan

**Status:** active

**Last updated:** 2026-08-30

## Product outcome

Ship the smallest trustworthy version of “watch your agents work”:

```text
producer-owned JSONL
  → provider adapter
  → one deterministic session projection
  → CLI/browser graph + inspector + live edge + replay
```

The plan does not include CASE orchestration, Warden, Model Armor, Firestore,
Cloud SQL, Pub/Sub, approvals, or agent control.

## Current capability

- Google ADK adapter (`google-adk@1`)
- session file/folder discovery
- parent/child agent graph and agent rail
- message, tool, result, error, and terminal-state inspection
- local JSONL follow
- play, pause, seek, step, speed, and return to live edge
- explicit unknown/waiting states
- hidden-reasoning removal
- headless inspect and native/browser fingerprint parity

## Submission path

### Phase 1 — Fixed Google producer

Deliver `google-cloud-launch-readiness` with one ADK root and four visible
tasks. Enforce Vertex AI, Gemini 3.5+, six calls, 180 seconds, two read-only
Cloud API calls, zero workflow writes, and explicit post-run upload.

**Done when:** the zero-cost dry-run and Python contract suite pass.

### Phase 2 — Same-session proof

Record ADK framework/version in FleetScope metadata and accept only provider
`modelVersion` as model execution evidence. Show the root plus all four direct
children in `fleetscope inspect`.

**Done when:** a recorder-generated JSONL passes the Rust adapter and prints the
producer/model line without using `configuredModel`.

### Phase 3 — Viewer demo

Use the CLI for reliable live follow and `/viewer` for the visual graph,
inspector, and replay. Keep labels derived from the playhead and observed edge.

**Done when:** the same session opens in CLI and browser, agent/task details are
readable, and replay does not invoke the producer.

### Phase 4 — Google Cloud proof

Run one bounded provider-backed take. Show the Cloud Run service/revision,
Vertex execution log/model version, ADK version, Cloud Storage object (if
uploaded), and matching session ID.

**Done when:** every Google claim points to the same session/proof bundle and no
secret or hidden reasoning appears.

### Phase 5 — Submission package

Record a public video under four minutes, upload the architecture diagram,
finish spin-up instructions, test the hosted URL, confirm Taskmaster, add all
teammates, and verify repository access.

**Done when:** every item in the submission checklist is either checked with
evidence or explicitly marked missing; no configured value is presented as
runtime proof.

## Quality gates

```bash
pnpm check
cargo test --workspace
PYTHONPATH=apps/adk-worker/src \
  apps/adk-worker/.venv/bin/python -m pytest apps/adk-worker/tests
pnpm check:wasm
pnpm build:wasm
pnpm build:web
git diff --check
```

Browser interaction QA is a separate gate and must be rerun in an environment
where Playwright browser IPC is available.

## Links

- [Idea and pitch](idea-and-pitch.md)
- [Feature flows](feature-flows.md)
- [UI/UX plan](ui-ux-plan.md)
- [Requirements](../requirements/session-observer.md)
- [Design](../design/session-observer.md)
- [Submission checklist](hackathon-submission-checklist.md)
