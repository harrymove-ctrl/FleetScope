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

For the copy-paste demo, use the checked-in example folder:

```bash
cargo run -p fleetscope-cli --bin fleetscope -- examples/gemini-session --follow
```

The CLI is the demo entry point. It reads the local `session.jsonl`, renders
the graph in the terminal, and never starts Gemini. The browser is an optional
second view of the same file; use `/viewer/` → **Open folder…** when you want
the graph and Inspector instead of the TUI.

For a cmux three-pane demo (Antigravity plan mode, native TUI, and browser
Viewer), run:

```bash
pnpm demo:cmux
```

The Antigravity pane uses `gemini-3.7-flash-low` by default. The TUI and browser
panes use the same checked-in recording so the cmux layout is repeatable and
free. Antigravity's private conversation database is not a supported
FleetScope input format.

For a real Antigravity CLI fan-out that the native TUI follows live, run:

```bash
pnpm demo:antigravity
```

This starts four parallel `agy --print --output-format stream-json` workers and
a fifth synthesizer against `examples/antigravity-project`. All workers use
`--mode plan`, so they can read the brief but cannot edit it. The bridge writes
their real responses incrementally to `.fleetscope/sessions/antigravity-live/`;
the TUI follows that file. The bridge is an explicit ADK-compatible envelope,
not a claim that FleetScope can read Antigravity's private conversation store.
Open `/viewer/`, choose **Follow folder…**, and select the printed session
directory to watch the same growing run in the browser. The handle is kept only
in that browser tab and the files are never uploaded.

```text
fleetscope <path>                    open/replay a session
fleetscope <path> --follow           park at the live edge and tail the file
fleetscope <path> --speed 4          replay four times faster
fleetscope <path> --format <id>      force an adapter
fleetscope --formats                 list readable formats
fleetscope inspect <path>            print a headless summary
```

Viewer keys: `space` play/pause, `[`/`]` step, `g`/`G` start/end, `f` follow,
`o` overview, `?` help, `q` quit.

### Browser

```bash
pnpm install
pnpm build:wasm
pnpm dev
```

Open [http://localhost:4321/viewer/](http://localhost:4321/viewer/). Copy the
CLI command shown at the top, then drop the generated JSONL file or choose its
session folder. The **Preview example** button is only a no-setup fallback;
local files are read in the browser and are not uploaded.

Judges who cannot log into Google Cloud should open
[http://localhost:4321/console](http://localhost:4321/console) (or the hosted
`/console` route). That page is a read-only Cloud Run / Storage / ADK evidence
console. It does not require IAM and does not start Vertex.

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
- Judge Cloud Console at `/console` and `GET /cloud/console` (recorded Cloud
  Run, Storage metadata, and the READY decision; no GCP login).

The renderer visualises one graph level. Deeper provider paths are preserved in
labels and the full tree appears in `inspect`.

## Architecture

The judge-ready diagram is available as an uploadable
[PNG](docs/product/fleetscope-devpost-architecture.png); its editable
[SVG source](docs/product/fleetscope-devpost-architecture.svg) is checked in
beside it.

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
                                      ├── fleetscope inspect
                                      └── /console + GET /cloud/console
```

The projection core is IO-free and provider-neutral. The CLI owns filesystem
discovery/tailing; the browser owns file/folder input; adapters own producer
dialects. `/console` serves the same recorded Cloud Run and Storage facts the
agents probed, so a judge does not need project IAM.

### Folder structure

```text
apps/adk-worker/     Google ADK SequentialAgent (launch_readiness)
apps/api/            health, capability, runs, GET /cloud/console
apps/web/            /dashboard /console /viewer /demo
crates/fleetscope-cli
crates/agent-viewer-*
packages/            shared TS libraries
examples/            checked-in Gemini and Antigravity inputs
docs/product/        pitch, feature inventory, Devpost packet
scripts/             producer, Antigravity bridge, Cloud Run deploy
```

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
uv venv --python 3.12 --allow-existing apps/adk-worker/.venv
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
export GOOGLE_GENAI_USE_ENTERPRISE=true
export GOOGLE_CLOUD_PROJECT=<project-id>
export GOOGLE_CLOUD_LOCATION=global
export FLEETSCOPE_CLOUD_RUN_LOCATION=us-central1
export FLEETSCOPE_CLOUD_RUN_SERVICE=<service-name>
export FLEETSCOPE_SESSION_BUCKET=<bucket-name>
export FLEETSCOPE_ALLOW_MODEL_CALLS=true

pnpm demo:google-session -- --run
```

The model endpoint and Cloud Run region are deliberately separate:
`gemini-3.7-flash` uses `global`, `us`, or `eu`, while the read-only Cloud Run
probe uses the service's regional location such as `us-central1`.

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

### API container smoke (recorded-only)

The Cloud Run image bundles the Node API, the pinned Python ADK worker, and the
run ledger. It is safe by default: `LIVE_MODE=false`, `workerMode=pure`, and
the pure worker uses an offline fixture.

```bash
docker build -f apps/api/Dockerfile -t fleetscope-api:local .
docker run --rm -p 8080:8080 fleetscope-api:local
curl -sS http://127.0.0.1:8080/health
curl -sS http://127.0.0.1:8080/runs/capability
```

The image must not be switched to ADK/Vertex mode until the frontend and local
flow are verified. The live deployment requires all of `LIVE_MODE=true`,
`FLEETSCOPE_RUN_WORKER_MODE=adk`, `FLEETSCOPE_ALLOW_MODEL_CALLS=true`,
`GOOGLE_GENAI_USE_VERTEXAI=true`, and valid Google Cloud project/region values;
ADC comes from the operator's local credential or the Cloud Run service
account, never from a checked-in key.

## Reproducible testing

The commands below reproduce the submission from a clean checkout without
credentials, paid model calls, or write access to Google Cloud. They exercise
the checked-in Google ADK recording, the provider adapter, the shared
projection core, the Rust CLI, and the browser build.

### Prerequisites

- Git.
- Node.js 22 and `corepack`.
- Rust 1.88 or newer with `rustup`.
- Python 3.12 and [`uv`](https://docs.astral.sh/uv/) for the ADK worker tests.

### Clean setup

Until PR [#1](https://github.com/jasong-03/FleetScope/pull/1) is merged, the
complete submission branch is public on the fork:

```bash
git clone --branch feat/agent-viewer-cli --single-branch \
  https://github.com/harrymove-ctrl/FleetScope.git
cd FleetScope

corepack enable
corepack prepare pnpm@11.24.0 --activate
pnpm install --frozen-lockfile

rustup toolchain install 1.88
rustup target add wasm32-unknown-unknown --toolchain 1.88

uv venv --python 3.12 --allow-existing apps/adk-worker/.venv
uv pip install --python apps/adk-worker/.venv/bin/python \
  -e 'apps/adk-worker[dev]'
```

### Deterministic no-cost checks

```bash
pnpm check
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo fmt --all -- --check
cargo test --manifest-path vendor/zoetrope/Cargo.toml
cargo clippy --manifest-path vendor/zoetrope/Cargo.toml \
  --all-targets -- -D warnings
cargo fmt --manifest-path vendor/zoetrope/Cargo.toml -- --check
PYTHONPATH=apps/adk-worker/src \
  apps/adk-worker/.venv/bin/python -m pytest apps/adk-worker/tests
pnpm build:wasm
git diff --check
```

Inspect the checked-in multi-agent session headlessly:

```bash
cargo run -p fleetscope-cli --bin fleetscope -- \
  inspect examples/gemini-session
```

Expected result: the command identifies the Google ADK format, reports the
recorded agents and events, and prints a stable projection fingerprint. To
exercise the interactive TUI instead, remove `inspect` and add `--follow`.

Build and preview the browser viewer:

```bash
pnpm --filter @fleetscope/web build
pnpm --filter @fleetscope/web exec astro preview \
  --host 127.0.0.1 --port 4321
```

Open <http://127.0.0.1:4321/viewer/>, choose **Preview example**, and verify
that the agent graph, event timeline, tool calls, and inspector render. The
example is bundled with the build; it makes no backend or model request.

Open <http://127.0.0.1:4321/console> and click Cloud Run, Cloud Storage, Vertex
/ ADK, and Invoke. The page is recorded evidence. It must not prompt for a
Google login and must not start a model.

### Hosted smoke test

No credentials are required. These endpoints are deployed on Google Cloud
Run in `us-central1`:

```bash
curl -fsS https://fleetscope-api-6tes2q7oqa-uc.a.run.app/health
curl -fsS https://fleetscope-api-6tes2q7oqa-uc.a.run.app/runs/capability
curl -fsS https://fleetscope-api-6tes2q7oqa-uc.a.run.app/cloud/console
curl -fsS -o /dev/null \
  https://fleetscope-web-6tes2q7oqa-uc.a.run.app/viewer/
```

The first two commands must return JSON with HTTP 200; the last command must
exit successfully. The hosted API deliberately runs in recorded-only mode, so
judging it cannot spend model tokens. The provider-backed evidence was produced
separately with Google ADK `2.8.0`, Vertex AI `gemini-3.7-flash`, read-only
Cloud Run `services.get`, and Cloud Storage `buckets.get`; the bounded live-run
procedure is documented in [Minimal Google hackathon path](#minimal-google-hackathon-path).

## Verification

Current local status (2026-08-30): TypeScript/Astro checks, the full Vitest
suite, Rust workspace tests, Python worker tests, WASM check and build,
formatting, lint, docs links, and launchpad browser QA (all five viewports)
pass. Deep viewer Playwright QA still needs a normal desktop run:
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
- [Feature inventory](docs/product/feature-inventory.md) — every surface and
  the command that invokes it.
- [Devpost additional-info](docs/product/devpost-additional-info.md) —
  field-by-field ticks and the private testing-instructions paste.
- [Docs index](docs/README.md) — navigation and historical/superseded docs.

The earlier enterprise CASE-1042 pitch/design/requirements remain in `docs/`
for traceability and are explicitly marked deprecated/superseded. Do not use
them to script the current demo.
