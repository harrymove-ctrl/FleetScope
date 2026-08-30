# FleetScope feature flows

**Status:** active

**Last updated:** 2026-08-30

## Flow 1 — Validate the Google producer at zero cost

```text
operator supplies project/location/service/bucket identifiers
  → closed config validates resource names, Gemini 3.5+ model, six-call ceiling,
    and timeout ≤ 180s
  → command prints the fixed agent tree and two read-only Cloud operations
  → process exits without ADC, network, model call, output directory, or upload
```

Command:

```bash
pnpm demo:google-session -- \
  --project example-project \
  --location us-central1 \
  --service fleetscope \
  --bucket fleetscope-sessions-demo
```

## Flow 0 — Run the checked-in example from the CLI

```text
operator runs the example folder
  → fleetscope discovers examples/gemini-session/session.jsonl
  → Google ADK adapter parses the recording
  → native TUI renders the same graph used by the browser
```

```bash
cargo run -p fleetscope-cli --bin fleetscope -- examples/gemini-session --follow
cargo run -p fleetscope-cli --bin fleetscope -- inspect examples/gemini-session
```

This is the recommended first demo: it needs no model, credentials, network,
or web button. The browser `/viewer/` is an optional visual companion and can
open the same folder with **Open folder…**.

## Flow 2 — Watch one real session

```text
explicit Vertex + spend opt-ins
  → Google ADK creates launch_readiness
  → cloud_run_probe calls services.get
  → storage_probe calls buckets.get
  → budget_guard verifies fixed limits
  → launch_reviewer emits READY / NOT_READY
  → each redacted ADK Event is flushed to session.jsonl
  → fleetscope <session.jsonl> --follow tails the moving right edge
```

Before the first provider event, the producer prints the absolute JSONL path and
the exact FleetScope watch command. The operator runs that command in a second
terminal.

Expected graph:

```text
launch_readiness
├── cloud_run_probe
├── storage_probe
├── budget_guard
└── launch_reviewer
```

All four are direct children so the current renderer does not need to flatten
the demo topology.

## Flow 3 — Inspect an agent task

1. Select an agent in the rail or graph.
2. The timeline highlights only events at the current playhead.
3. Select a function call or response.
4. The inspector shows the safe tool name, bounded arguments/result, provider
   status, and explicit terminal evidence.
5. An unanswered call remains “waiting on a tool result”. Silence is not success.

## Flow 4 — Move from live to replay and back

```text
JSONL grows + playhead at edge → Local live follow
user pauses or seeks backward   → History / paused replay
user steps or changes speed     → same event timeline, earlier playhead
user returns to edge            → follow resumes; new complete lines append
producer stops                  → right edge becomes fixed; session remains replayable
```

Live and replay are not different session models. They are the same ordered
event list with a moving or fixed right edge.

## Flow 5 — Persist optional cloud proof

```text
agents finish
  → local session.jsonl remains available
  → local session.proof records SHA-256, ADK version, configured model,
    provider-observed modelVersion values, session IDs, resources, and result
  → only with explicit --upload:
      session.jsonl → Cloud Storage
      session.proof → Cloud Storage
```

No Cloud Storage write occurs during the agent workflow. Upload failure cannot
turn an unobserved model into observed evidence.

## Failure flows

| Failure | Required result |
|---|---|
| Invalid resource/model/budget config | Refuse before any client or output exists |
| `--upload` without `--run` | Refuse |
| `--run` without spend opt-in | Refuse |
| `--run` without Vertex opt-in | Refuse |
| Cloud API non-200 | Record only operation/status/resource, never raw response body |
| Model call 7 | Refuse before the call |
| Specialist exceeds its allocation | Refuse before the call (2/2/1/1 fixed by agent) |
| Workflow exceeds timeout | Record safe failure type and terminal failure event |
| Provider emits an error | Preserve error evidence; do not claim success |
| Reviewer produces no decision | Mark workflow failed |
| `thought: true` or secret-shaped field | Remove/redact before the line is persisted |
| Malformed JSONL in viewer | Refuse with format and line instead of drawing a guessed graph |

## Surface hand-off

| From | Action | To | Truth label |
|---|---|---|---|
| README / terminal | Run dry-run | Printed plan | Dry-run |
| Producer terminal | Copy watch command | CLI Agent Viewer | Local live follow |
| CLI | Inspect file headlessly | `fleetscope inspect` | Observed session |
| Browser landing | Open Agent Viewer | `/viewer` | Recorded until a growing local source is observed |
| Live edge | Seek backward | Same viewer timeline | History / replay |
| Finished session | Open proof manifest | Evidence review | Observed only where provider fields exist |

## Links

- [Idea and pitch](idea-and-pitch.md)
- [Session Observer](session-observer.md)
- [UI/UX plan](ui-ux-plan.md)
- [Runtime design](../design/hackathon-runtime.md)
