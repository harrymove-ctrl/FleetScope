# FleetScope Agent Viewer plan

Status: **redesigned**

FleetScope v1 starts as a local developer tool for viewing Gemini multi-agent
sessions, including Antigravity-style CLI workflows and Google ADK agents. It
is not an enterprise procurement dashboard in the first release.

## Product shape

The user-facing experience is **Agent Viewer**. `Fleet Cockpit` is retired as a
product name; it may remain as an internal Rust/component name during migration.

One developer opens one local session, which may contain a root agent and many
sub-agents. FleetScope does not start or govern the run in v1. It observes,
projects, and explains what happened.

## CLI first

The CLI is the primary entry point, with the browser as a second frontend over
the same portable core:

```bash
fleetscope ./session                 # follow latest local activity
fleetscope ./session/main.jsonl      # replay a recording
fleetscope ./session --follow        # open at the live edge
fleetscope ./session --speed 4       # change replay speed
fleetscope inspect ./session         # print a headless summary
```

Launch options only choose the initial target and playhead. Once running, the
same actions are always available: follow live, replay, pause, resume, seek,
and return to live.

## Agent Viewer flow

The first screen is a session viewer, not a catalog or case inbox. The developer
can:

- follow a running session;
- replay a recorded session;
- pause and resume playback;
- scrub the event timeline and seek into history;
- see the root agent and all sub-agents in an interactive graph;
- select an agent to inspect prompts, tool calls, outputs, and errors;
- see derived states such as running, waiting, completed, failed, or idle;
- switch between Overview and Follow camera views.

Following Zoetrope, `Live`, `Playing`, `Paused`, `History`, and `Idle` are
derived from the playhead and live edge rather than persisted mode flags.

## Architecture to retain from Zoetrope

FleetScope should reuse the proven shape, redesigned for Gemini/ADK events:

1. A portable, IO-free core owns event projection, replay/live convergence,
   timeline state, agent topology, and rendering data.
2. A native CLI frontend owns filesystem discovery, tailing, terminal input, and
   lifecycle.
3. A browser frontend owns file/folder upload, File System Access API support,
   and the same Agent Viewer interaction model.
4. Content-time (the session playhead) is separate from presentation-time (UI
   animation), so seeking is deterministic.
5. Ground-truth events outrank inferred liveness or timeout heuristics.
6. Replay and live delivery fold into the same projection and converge to the
   same final state regardless of event arrival order.

Zoetrope remains a pinned rendering reference/substrate. FleetScope must not
reuse its Claude-specific transcript parser as the domain model.

## Gemini and ADK adapter boundary

The first adapter reads local Gemini/Antigravity-style session artifacts and
Google ADK agent events, then converts them into FleetScope canonical events.
The canonical model represents agent identity and parent-child relationships,
prompts, model responses, tool calls, results, errors, timestamps, ordering,
explicit terminal events, and redacted display-safe detail.

Provider-specific parsing stays in adapters. The Agent Viewer and projection
operate on canonical events, making later provider onboarding additive.

## Delivery phases

### Phase 1 — local Gemini session — **DELIVERED**

- ~~Define the Gemini/ADK adapter contract.~~ `crates/fleetscope-cli/src/adapter/`:
  a `SessionAdapter` trait with scored detection, and `adk.rs` behind it.
- ~~Add one fixture containing a root agent and multiple sub-agents.~~
  `crates/fleetscope-cli/tests/fixtures/gemini-multi-agent/` — a coordinator,
  three sub-agents, a tool failure, a call that never returns.
- ~~Implement CLI launch, local discovery, replay, follow, pause, resume, and
  `inspect`.~~ `fleetscope` in `crates/fleetscope-cli`.
- ~~Render the Agent Viewer graph, timeline, and detail panel.~~ Through the
  vendored renderer's native frontend, `render-provenance` off.

**Gate: met.** `fleetscope inspect <dir>` reports the full agent tree, the
failure and the unanswered call from a local file with no server and no API key;
`fleetscope <dir> --follow` draws all four agents and seven tools in a terminal.
32 tests in `crates/fleetscope-cli/tests/` cover ingestion, the wire contract,
the fold into the real renderer, and the command surface.

**Two findings the plan did not anticipate:**

| Plan assumed | What is true |
|---|---|
| The Agent Viewer graph can show the session's agent tree | The renderer's graph is **one level deep** (`state/session.rs`: a sub-agent's `parent` is the main node or a workflow group). Deeper sessions are flattened, keep their real path in the label, and the viewer says so; `inspect` prints the true tree. |
| "A native CLI frontend owns filesystem discovery, tailing, terminal input, and lifecycle" could reuse the vendored tailer | The vendored tailer walks a Claude Code project layout and parses that dialect, so reusing it would make the Claude transcript format the domain model — the one thing this plan forbids. `follow.rs` owns discovery and IO instead; the renderer only ever receives already-compiled entries. |

### Phase 2 — browser parity — **DELIVERED, with one defect**

- ~~Feed the same canonical events to the browser/WASM frontend.~~ The core was
  split into `crates/agent-viewer-core` (projection, IO-free) and
  `crates/agent-viewer-render` (the fold), both of which compile for wasm32.
  `crates/agent-viewer-web` is the browser frontend over them.
- ~~Support bundled demo, drag-and-drop, and folder selection.~~ `/viewer`.
  Folder selection is what makes the per-agent companion tree readable.
- ~~Match CLI transport and graph interactions.~~ The same key and mouse
  bindings, over the same `App`.

**Gate: met for the projection, NOT for the visible timeline.** The CLI and the
browser report the same fingerprint for the same session
(`e2728f4f985c7f33`), which is pinned by a test, and the browser reads both
providers and refuses reasoning exactly as the CLI does. But the WebGL grid
comes out **zero columns wide**, so the graph canvas is blank. The container
measures correctly (1198px) and the row count is right; only the column count
is zero.

**This is pre-existing and not caused by this work:** the untouched `/cockpit`
route has the identical zero-width canvas. It is in the vendored renderer's
browser terminal backend, below anything FleetScope owns. The terminal frontend
draws the same session correctly, so the fault is isolated to that backend.
Phase 2 should not be called finished until it is fixed or worked around.

**One trap worth recording:** trunk CLEANS its `dist` on every build. Both
frontends originally targeted `apps/web/public/wasm`, so the second build
silently deleted the first and only the last-built renderer shipped. Each now
builds into its own `dist` and `scripts/build-wasm.sh` stages both.

### Phase 3 — provider onboarding — **DELIVERED**

- ~~Add adapters one provider at a time.~~ One added:
  `crates/agent-viewer-core/src/adapter/claude_code.rs`, reading a main
  transcript plus the per-agent companion tree beside it. It shares no parsing
  with the ADK adapter, and it does NOT borrow the vendored renderer's parser
  for the same dialect: that would make a provider transcript the domain model.
- ~~Keep provider differences at the ingestion boundary.~~ Adding it changed
  nothing outside `adapter/`. The viewer model, the wire emitter, `inspect` and
  both frontends were untouched, which is the only real test of the boundary.
  `SessionSource` gained companion files, because a session is not always one
  file; the frontend collects the tree structurally and the adapter decides what
  a path means.
- ~~Add format/version detection and clear unsupported-input errors.~~
  Detection is scored (`Confidence::{No,Maybe,Yes}`) and the two adapters
  decline each other outright, so the choice never depends on registry order.
  The producer version is read off the session and reported. An unrecognised
  file is refused by name and the error lists every readable format; `--format`
  forces one and `--formats` lists them, so "unsupported" is always actionable.

**Gate: met.** Both fixtures project through one pipeline to different adapter
ids, and the viewer reads real sessions off disk.

**Three bugs the fixtures could not have caught.** Every one passed against a
fixture written to match the parser and failed the first time the viewer was
pointed at a real session directory. They are the reason this phase is worth
more than its diff:

| Symptom | Cause |
|---|---|
| **Every** real session refused as unrecognised | Detection read only the first line. Real transcripts open with bookkeeping entries (`queue-operation`, `attachment`) before the first message. It probes a window now. |
| A 2-agent session reported as **82 agents** | Every `.jsonl` in the companion tree was treated as a sub-agent. One real session carries 127 workflow files under `subagents/workflows/`. Only files directly under `subagents/` count. |
| Sub-agent events **silently missing** | Files are named `agent-<id>.jsonl` but the lines inside carry `agentId: "<id>"` without the prefix, and that field is the join key. Both the graph and `inspect` walk down from the root, so orphaned events were not an error, just absent work. The prefix is stripped, and an event whose agent was never declared now surfaces as an extra node instead of disappearing. |

The lesson is recorded because it generalizes to every future adapter: a
provider fixture written from the parser proves the parser agrees with itself.
Point the viewer at real data before claiming an adapter works.


### Phase 4 — FleetScope platform — **NOT STARTED, deliberately**

Only after the local developer flow is reliable, consider remote sessions, team
workspaces, approvals, audit exports, catalogs, and enterprise users.

**Its precondition is not met.** "After the local developer flow is reliable" is
a gate, and phase 2 is sitting on a defect that makes the browser graph blank.
Building remote sessions and team workspaces on top of that would be adding
surface to something not yet reliable, which is the specific failure this
phase's ordering exists to prevent.

**Half of the list already exists, from before the pivot.** Approvals, audit
export and the catalog are live routes in `apps/web` with tests behind them,
built for the enterprise Case model. They are not missing; they are on the other
side of a boundary the v1 plan drew on purpose, and the plan lists them under
"Explicitly out of v1". Rebuilding them against the local session model would
mean two implementations of each, and the enterprise ones are the tested ones.

**What phase 4 actually needs first, in order:**

1. Fix the zero-width WebGL grid, so phase 2's gate is genuinely met.
2. Decide whether the local `ViewerSession` and the enterprise Canonical Event
   schema converge or stay separate. They are deliberately separate today (see
   `crates/agent-viewer-core/src/viewer.rs`): a local session has no registry
   resolution, no identity decision and no approval, and inventing them would
   put unrecorded fields into an audit vocabulary. Remote sessions and team
   workspaces are exactly where that decision has to be made, and it is a
   product decision, not an implementation detail.
3. Only then, remote transport and multi-user concerns.

Nothing in phase 4 was built. Recording why is the deliverable.

## Explicitly out of v1

- Agent Catalog
- Approval Inbox
- procurement Cases as the landing experience
- enterprise governance workflows
- a server requirement for local viewing
- pretending FleetScope can start an agent run when it only reads recordings

The north star is simple: **Zoetrope for Gemini/ADK multi-agent sessions, with
an Agent Viewer that can grow into FleetScope.**
