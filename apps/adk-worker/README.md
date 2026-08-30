# Google ADK session producer

This package runs the one bounded Google workflow used in FleetScope's
hackathon demo. Google ADK and Gemini do the work; FleetScope only watches the
append-only JSONL they produce.

## Demo workflow

`launch_readiness` is a Google ADK `SequentialAgent` with four direct children:

| Agent | Task | Google operation | Expected model calls |
|---|---|---|---:|
| `cloud_run_probe` | Check one configured Cloud Run service | `services.get` | 2 |
| `storage_probe` | Check one configured Cloud Storage bucket | `buckets.get` | 2 |
| `budget_guard` | Verify the fixed server-owned limits | none | 1 |
| `launch_reviewer` | Combine the three reports into `READY` or `NOT_READY` | none | 1 |

The root is not an LLM agent. Six calls is therefore both the expected path and
the enforced ceiling. The workflow timeout is at most 180 seconds.

The Cloud probes expose only allowlisted readiness fields. They never list or
download bucket objects, change Cloud Run traffic, deploy a revision, or write
an object. Upload is a separate operator action after the agents finish.

## Install

From the repository root:

```bash
uv venv --python 3.12 apps/adk-worker/.venv
uv pip install --python apps/adk-worker/.venv/bin/python -e 'apps/adk-worker[dev]'
```

The pinned runtime is `google-adk==2.8.0`. The local tests use real ADK event
and agent types with no provider call.

## Zero-cost dry-run

```bash
pnpm demo:google-session -- \
  --project example-project \
  --location us-central1 \
  --service fleetscope \
  --bucket fleetscope-sessions-demo
```

Without `--run`, the command validates the closed config and prints the exact
agent/Cloud plan. It does not construct an ADC client, write an output file, use
the network, or call a model.

## One real Vertex AI run

Authenticate with Application Default Credentials, then export the exact
resource names and both spend/provider opt-ins:

```bash
gcloud auth application-default login

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

`GOOGLE_CLOUD_LOCATION` is the Gemini endpoint. The current
`gemini-3.7-flash` model supports `global`, `us`, and `eu`; `global` is the
lowest-cost default. `FLEETSCOPE_CLOUD_RUN_LOCATION` is kept separate because
the probed Cloud Run service uses a regional location such as `us-central1`.

The script prints the absolute JSONL path and a corresponding FleetScope
`--follow` command before provider events begin. Open the second terminal using
that command to watch the four agents appear.

Add `--upload` only when the completed, redacted `session.jsonl` and
`session.proof` should be stored in the configured bucket:

```bash
pnpm demo:google-session -- --run --upload
```

No upload occurs during the agent workflow. Failed runs still retain their
local JSONL and proof for debugging. If an explicit upload fails, the local
proof records `uploadStatus` (`failed` or `partial`) and the exception type,
and the command exits non-zero.

## Evidence and redaction

Each event is written and flushed as one line. Before persistence:

- parts marked `thought: true` are removed;
- secret-shaped keys such as tokens, API keys, cookies, credentials, passwords,
  and private keys are replaced with `[REDACTED]`;
- Google API response bodies are reduced to the closed readiness projections;
- raw provider exception messages are not copied into the log.

`customMetadata.fleetscope` records the case, ADK version, and configured model.
The top-level ADK `modelVersion` remains separate provider-owned evidence. The
proof manifest labels model execution `observed` only when that provider field
appeared.

## Test

```bash
PYTHONPATH=apps/adk-worker/src \
  apps/adk-worker/.venv/bin/python -m pytest apps/adk-worker/tests
```

Important test coverage includes config refusal, read-only response projection,
fixed agent topology, exact six-call shape, incremental writes, thought/secret
redaction, configured-versus-observed model evidence, dry-run zero side effects,
and explicit `--run`/`--upload` gates.

## Legacy worker path

The package still contains the older `dependency_onboarding` runtime, MCP
server, recorded scenario, and Warden compatibility tests. They are not the
FleetScope product story and are not used by `demo:google-session`. They remain
only so existing repository contracts continue to pass while the Session
Observer demo is delivered.
