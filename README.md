# FleetScope

FleetScope is a read-only **Session Observer**: watch your agents work.
Gemini/ADK writes a JSONL session; FleetScope reads it and lays the session out
as a graph showing which agents ran and what each one is doing. Follow a
growing local session or replay a finished one.

The viewer never starts, retries, authorizes, or mutates an agent action. The
session log is the source of truth.

## Quick start

### CLI

```bash
cargo run -p fleetscope-cli --bin fleetscope -- \
  crates/fleetscope-cli/tests/fixtures/gemini-multi-agent --follow
```

```text
fleetscope <path>                    open/replay a session
fleetscope <path> --follow           park at the live edge and tail the file
fleetscope <path> --speed 4          replay four times faster
fleetscope <path> --format <id>      force an adapter
fleetscope --formats                 list readable formats
fleetscope inspect <path>            print a headless summary
```

Viewer keys: `space` play/pause, `←`/`→` step, `g`/`G` start/end, `f` follow,
`o` overview, `?` help, `q` quit.

### Browser

```bash
pnpm install
pnpm build:wasm
pnpm dev
```

Open [http://localhost:4321/viewer/](http://localhost:4321/viewer/). Load the
bundled demo, drop a JSONL file, or choose a session folder. Local files are
read in the browser and are not uploaded.

## What is implemented

- JSONL/JSON file and folder discovery.
- Google ADK format adapter (`google-adk@1`) for the hackathon demo path.
- Validation, ordering, de-duplication, tool-call pairing, and safe payload
  projection.
- Agent rail and parent/child graph.
- Event inspector for messages, tools, results, errors, and terminal state.
- Live follow/tailing in the CLI and replay in the CLI/browser.
- Play/pause, step, seek, speed, overview, and return-to-live-edge controls.
- Hidden reasoning (`thought: true`) is removed before it reaches the UI.
- Headless `inspect` output and a stable projection fingerprint.
- Native CLI and browser share the same projection core.

The renderer visualises one graph level. Deeper provider paths are preserved in
labels and the full tree appears in `inspect`.

## Architecture

```text
Gemini + Google ADK session
        │
        ▼
JSONL file/object ──► discovery or file input ──► provider adapter
                                                   │
                                                   ▼
                                      ViewerSession + projection core
                                      ├── Rust CLI TUI
                                      ├── Astro/WASM browser
                                      └── fleetscope inspect
```

The projection core is IO-free and provider-neutral. The CLI owns filesystem
discovery/tailing; the browser owns file/folder input; adapters own producer
dialects.

## Minimal Google hackathon path

The product does not need a database or an agent-control backend. The fixed
producer case is `google-cloud-launch-readiness`:

1. `cloud_run_probe` calls read-only Cloud Run `services.get`.
2. `storage_probe` calls read-only Cloud Storage `buckets.get`.
3. `budget_guard` verifies six model calls, a 180-second timeout, two reads,
   zero workflow writes, and FleetScope's read-only role.
4. `launch_reviewer` returns `READY` or `NOT_READY` from those reports.

Google ADK `2.8.0` runs all four as direct children of `launch_readiness` on
Vertex AI `gemini-3.7-flash`. Every ADK event is redacted and flushed to JSONL
as it arrives, so the CLI can follow it live. An explicit post-run `--upload`
may store the finished JSONL and proof manifest in Cloud Storage.

### Set up the producer

```bash
uv venv --python 3.12 apps/adk-worker/.venv
uv pip install --python apps/adk-worker/.venv/bin/python -e 'apps/adk-worker[dev]'
```

Validate the exact plan at zero cost (no ADC, network, or model call):

```bash
pnpm demo:google-session -- \
  --project example-project \
  --location us-central1 \
  --service fleetscope \
  --bucket fleetscope-sessions-demo
```

For the one real take, use ADC and explicit opt-ins:

```bash
export GOOGLE_GENAI_USE_VERTEXAI=true
export GOOGLE_CLOUD_PROJECT=<project-id>
export GOOGLE_CLOUD_LOCATION=us-central1
export FLEETSCOPE_CLOUD_RUN_SERVICE=<service-name>
export FLEETSCOPE_SESSION_BUCKET=<bucket-name>
export FLEETSCOPE_ALLOW_MODEL_CALLS=true

pnpm demo:google-session -- --run
```

The command prints `session_jsonl=<absolute path>` and the matching
`fleetscope ... --follow` command before the first provider event. Add
`--upload` only after the local run is understood and the bucket is ready.

The proof manifest keeps `configuredModel` separate from provider-observed
`modelVersion`. A configured string is never presented as execution evidence.

Do not add Firestore, Cloud SQL, Pub/Sub, Warden, Model Armor, or multi-week
Case orchestration to this demo. Those belong to a superseded enterprise
proposal, not to the Session Observer.

Local tests and recorded fixtures cost USD 0. Use the available Google Cloud
credit only for one bounded provider-backed take and deployment validation.

## Verification

Run the full local checks:

```bash
pnpm check
cargo test --workspace
PYTHONPATH=apps/adk-worker/src apps/adk-worker/.venv/bin/python -m pytest apps/adk-worker/tests
git diff --check
```

Current local status (2026-08-30): TypeScript/Astro checks, Vitest (503 passed,
1 skipped), Rust workspace tests, Python worker tests (167 passed), WASM check
and build, formatting, lint, docs links, and launchpad browser QA (all five
viewports) pass. Deep viewer Playwright QA still needs a normal desktop run:
the escalated process opened browser IPC but produced no output for 90 seconds
and was stopped; do not present that gate as passed.

## Docs

- [Session Observer product brief](docs/product/session-observer.md) — idea,
  feature map, UI/UX, pitch, and four-minute demo script.
- [Session Observer requirements](docs/requirements/session-observer.md) — what
  must be true, success measures, non-goals, and open points.
- [Session Observer design](docs/design/session-observer.md) — architecture,
  adapter contract, state/failure behavior, and hosted proof.
- [Hackathon checklist](docs/product/hackathon-submission-checklist.md) —
  exact proof gates and current gaps.
- [Docs index](docs/README.md) — navigation and historical/superseded docs.

The earlier enterprise CASE-1042 pitch/design/requirements remain in `docs/`
for traceability and are explicitly marked deprecated/superseded. Do not use
them to script the current demo.
