# ADK worker

A real [google-adk](https://pypi.org/project/google-adk/) 2.8.0 worker: a root
agent `dependency_onboarding` that delegates a security review to a sub-agent
`security_review`, which reads public metadata for one allowlisted repository.

## The request contract is closed

A caller sends identifiers and nothing else:

```json
{ "runId": "...", "sessionId": "...", "correlationId": "...",
  "scenarioId": "dependency_onboarding", "mode": "pure" }
```

Target, model, retry budget, fault policy and call ceiling all live in
[`scenario.py`](src/fleetscope_worker/scenario.py), in server source. Any other
field is **refused by name**, not ignored, because a caller who sends `target`
and gets a run back has every reason to believe it worked.

## Two modes, two truth labels

| Mode | What runs | Evidence labelled | Cost |
|---|---|---|---|
| `pure` (default) | deterministic replay, no runtime, no model | `recorded` | none |
| `adk` | a real ADK `Runner` executes the agent tree | `live` for what it observed | metered |

`adk` refuses to start unless `FLEETSCOPE_ALLOW_MODEL_CALLS=true`. Nothing can
promote `recorded` evidence to `live`.

## Where the SDK is, and how it is tested for free

Only [`agents.py`](src/fleetscope_worker/agents.py) and
[`adk_runtime.py`](src/fleetscope_worker/adk_runtime.py) import `google.adk`;
`test_sdk_boundary.py` enforces that by parsing imports. `main.py` imports the
runtime lazily, so the contract stays usable without the SDK.

`AdkRuntime` takes an injected **runner factory**. Tests supply a fake Runner
that yields real `google.adk.events.Event` objects, so the agent-tree
construction, the session creation, the `run_async` call and the event
translation are all genuinely exercised. Only the model is absent.

```bash
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -e '.[dev]'
.venv/bin/python -m pytest        # zero cost
```

## Running it

```bash
echo '{"runId":"run-1","sessionId":"sess-1","correlationId":"corr-1",
       "scenarioId":"dependency_onboarding"}' \
  | PYTHONPATH=src .venv/bin/python -m fleetscope_worker.main
```

Emits canonical JSONL events plus a `fleetscope.worker.summary.v1` record, and
tells the five-beat story:

```
Start -> Delegate -> Tool failure -> Warden retry -> Result
```

## Safety properties, and where each is enforced

| Property | Enforced by |
|---|---|
| A caller cannot steer a run | `request.py` refuses unknown fields by name |
| No external write | `ReadOnlyHttp` exposes only `get`; `transport.py` pins GET |
| Target cannot be steered | allowlist narrowed to the scenario's own target, checked before a URL exists |
| No secret is ever written down | `redact.py` allowlists fields and detects secret shapes; applied to every tool arg and response |
| Hidden reasoning is dropped | `thought` parts are discarded at ingestion |
| A replay cannot claim to be live | `ScriptedRuntime` labels its evidence `recorded` |
| Missing delegation is not success | `AdkRuntime` returns `incomplete` and labels the outcome `unknown` |
| Timeout and crash are visible | `asyncio.wait_for`; a crash records its exception *type*, never its message |
| A model call cannot exceed its ceiling | `ModelBudget.reserve()` in `before_model`, counted before the call |
| A retry is not a second operation | the retry reuses the first attempt's idempotency key |
| Attempts survive a restart | `FileAttemptStore` (injected via `FLEETSCOPE_ATTEMPT_LEDGER`) |

## Known limitation

`FileAttemptStore` is append-only and **single-process**. Two workers sharing one
file could both read the same count before either appends. That is acceptable
today because the API admits exactly one active run at a time. A multi-process
deployment needs a lock or a transactional store before it may claim
exactly-once.

## Running your own agent against FleetScope (no credits required)

FleetScope holds no model credential. The model runs where you already pay
nothing for it: inside your own Gemini or Antigravity CLI session. FleetScope
supplies the tool that session calls, and keeps everything worth governing.

| | |
|---|---|
| your CLI | the model, the prompt, the agent loop |
| FleetScope | the tool, the Controlled Fault, the policy, the Warden retry, the idempotency key, the evidence |

Add the server to `~/.gemini/antigravity-cli/mcp_config.json` (or the IDE's
`~/.gemini/antigravity/mcp_config.json`) alongside whatever is already there:

```json
{
  "mcpServers": {
    "fleetscope": {
      "command": "<repo>/apps/adk-worker/.venv/bin/python",
      "args": ["-m", "fleetscope_worker.mcp_server"],
      "env": {
        "PYTHONPATH": "<repo>/apps/adk-worker/src",
        "FLEETSCOPE_API": "http://127.0.0.1:8080"
      }
    }
  }
}
```

Then:

1. start the API with `FLEETSCOPE_RUN_DRIVER=mcp`;
2. admit a run (`POST /runs {"scenarioId":"dependency_onboarding"}`), which
   returns `awaitingAgent: true` because nothing is executing yet;
3. in your CLI, ask the agent to review the dependency;
4. when it calls `read_repository_metadata`, FleetScope fails the first attempt
   as a labelled Controlled Fault, authorises exactly one idempotent retry, and
   returns the authoritative result to your agent;
5. poll `/runs/:runId/events?after=<highWaterMark>` to watch the story.

**The tool refuses outside an admitted run.** Without one it has no budget, no
ledger entry and no idempotency key, so it declines and says how to start one.
That refusal is the governance boundary working, not a bug.

**What this runtime cannot show.** Gemini CLI has no ADK sub-agents, so
delegation is not observable. `run_end` reports `delegationObserved: false`
rather than asserting a delegation that did not happen.
