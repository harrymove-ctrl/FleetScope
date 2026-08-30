# FleetScope Agent Viewer plan

Status: **redesigned**

> The [frontend experience design](../design/fleetscope-frontend-experience.md)
> owns the public launchpad, onboarding, and visual enhancement gates. This
> plan remains the source for the Zoetrope event-sourcing/two-clock model,
> local CLI/WASM boundary, and `/viewer` graph. It does not authorize a graph on
> `/live` or a marketing carousel on evidence routes.

FleetScope v1 starts as a local developer tool for viewing Gemini multi-agent
sessions, including Antigravity-style CLI workflows and Google ADK agents. It
is not an enterprise procurement dashboard in the first release.

## Product shape

The user-facing experience is **Agent Viewer**. `Fleet Cockpit` is retired as a
product name; it may remain as an internal Rust/component name during migration.
The web Dashboard is the onboarding entry point: it verifies the local setup and
then hands the developer off to Agent Viewer.

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

## Dashboard → Agent Viewer flow

The first screen is a small onboarding Dashboard. It explains the local-only
boundary, checks the CLI and Gemini/ADK adapter, lets the developer choose a
workspace, and links to Agent Viewer. Inside Agent Viewer the developer can:

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
6. The ADK adapter canonicalizes exact duplicates and stable-sorts records
   before discovering agents and emitting edges, so replay and live delivery
   converge to the same projection regardless of event arrival order. Invalid
   or missing timestamps use deterministic epoch-relative offsets, never the
   wall clock.

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

### Phase 2 — browser parity — **DELIVERED**

- ~~Feed the same canonical events to the browser/WASM frontend.~~ The core was
  split into `crates/agent-viewer-core` (projection, IO-free) and
  `crates/agent-viewer-render` (the fold), both of which compile for wasm32.
  `crates/agent-viewer-web` is the browser frontend over them.
- ~~Support bundled demo, drag-and-drop, and folder selection.~~ `/viewer`.
  Folder selection is what makes the per-agent companion tree readable.
- ~~Match CLI transport and graph interactions.~~ The same key and mouse
  bindings, over the same `App`.

**Gate: met.** The CLI and browser report the same fingerprint for the same
session (`e2728f4f985c7f33`), which is pinned by a test, and the browser reads
both providers while refusing reasoning exactly as the CLI does. `pnpm
build:wasm` stages both renderer bundles; the build script normalizes the common
`NO_COLOR=1` shell convention to the boolean Trunk expects. Browser QA verifies
the standalone Agent Viewer and the existing Case Graph without console errors.

**One trap worth recording:** trunk CLEANS its `dist` on every build. Both
frontends originally targeted `apps/web/public/wasm`, so the second build
silently deleted the first and only the last-built renderer shipped. Each now
builds into its own `dist` and `scripts/build-wasm.sh` stages both.

### Graph-node selection — **DELIVERED**

Selecting an agent's graph node is the interaction the viewer is judged on, and
it was previously reported complete on inadequate evidence: the browser check
clicked the canvas at a fixed `{ x: 120, y: 200 }` and asserted only that *some*
selection signal arrived. It named no node, proved no node was hit, and would
have kept passing with selection entirely broken.

It was, in fact, broken. `agent_viewer_select_agent` set `pending_center` and
nothing else, so the camera glided to a node that never became selected, and the
shell decided the selection itself in TypeScript. The rail could therefore show
a selection the graph did not have.

**The contract now:**

- `agent_viewer_graph_nodes()` reports the nodes the renderer actually has. A
  DOM control is only presented as a graph-node control for an id that appears
  there, so no control can stand for a node the graph does not have.
- `agent_viewer_select_agent(id)` performs the selection and returns the
  renderer's answer: `selected`, `deselected`, or `unknown`. `unknown` is a real
  answer — the shell must render it, not the id it asked for.
- `agent_viewer_clear_selection()` is the Escape path.
- Every ABI answer is a **session agent id**. The renderer calls the root node
  `main`, its own id; `agent-viewer-render/src/selection.rs` owns that
  translation so the private vocabulary never escapes.
- `selectedAgentId` is now always serialized, explicitly `null` when nothing is
  selected. Omitting it made "nothing is selected" indistinguishable from "this
  build does not report selection".

**Two defects the fixed-pixel test could never have found**, both surfaced by
driving a named node in a real browser:

| Defect | Why it mattered |
|---|---|
| The root agent had no selectable control. The renderer names its node `main`; every other id in the system is a session agent id, so `coordinator` matched nothing and its rail row was disabled — the largest agent in the fixture, 8 events, unreachable. | A test that only ever drove a sub-agent would never notice. |
| The shell refreshes once a second and rebuilt the rail each time, destroying whichever control the keyboard user was on. Focus fell back to `<body>` within a second of arriving, so Enter reached nothing. | Invisible to a mouse, fatal to a keyboard. It made the browser check fail intermittently at one viewport before it was understood. |

Selecting an agent does not move the playhead, so the inspector can be left
holding another agent's event. It now says whose it is rather than rendering it
under the selected agent's heading.

**Gate: met, and the gate has teeth.** Reverting
`agent_viewer_select_agent` to its old centre-only behaviour fails 17 browser
checks across all three viewports while the canvas still exists and every
structural check still passes — which is exactly the failure mode the old test
missed. 17 Rust tests in `agent-viewer-render/src/selection.rs` cover the same
contract on the host, including that an unknown id cannot destroy a good
selection (`Flow::select_node` clears the selection for an unknown id, so
unknown ids never reach it).

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

Its precondition is the local CLI/browser flow remaining reliable in sequential
builds and browser QA. Remote sessions and team workspaces stay out of the
current implementation until that gate is deliberately reopened.

**Half of the list already exists, from before the pivot.** Approvals, audit
export and the catalog are live routes in `apps/web` with tests behind them,
built for the enterprise Case model. They are not missing; they are on the other
side of a boundary the v1 plan drew on purpose, and the plan lists them under
"Explicitly out of v1". Rebuilding them against the local session model would
mean two implementations of each, and the enterprise ones are the tested ones.

**What phase 4 actually needs first, in order:**

1. Decide whether the local `ViewerSession` and the enterprise Canonical Event
   schema converge or stay separate. They are deliberately separate today (see
   `crates/agent-viewer-core/src/viewer.rs`): a local session has no registry
   resolution, no identity decision and no approval, and inventing them would
   put unrecorded fields into an audit vocabulary. Remote sessions and team
   workspaces are exactly where that decision has to be made, and it is a
   product decision, not an implementation detail.
2. Only then, remote transport and multi-user concerns.

Nothing in phase 4 was built. Recording why is the deliverable.

## Next slice — CASE-1042 Story Mode — **PLANNED**

Specified in [case-1042-story-mode-plan.md](case-1042-story-mode-plan.md), not
implemented. Story Mode becomes the default `/cockpit/CASE-1042` view and the
existing renderer experience becomes Expert Mode, with one canonical Event
Cursor shared by both.

The whole point is that a governance card may only claim what the recording
proves. Four capabilities, four fixed slots, four states: `evidenced`, `absent`,
`unavailable`, `unsupported`. An evidenced card replaces its non-evidenced card
in the same slot rather than sitting beside it, and `absent` ("we looked, it is
not there") is never collapsed into `unavailable` ("we could not look").

The proof chains are verified against
`packages/fixtures/cases/CASE-1042/canonical-events.jsonl`, event by event, in
the plan. One correction worth recording: `caseSequence` is 0-based, so
`evt-NNNN` is sequence `NNNN - 1`. The primary destinations are sequences 15,
30, 35 and 52 — an earlier brief gave 31, 36 and 53 for the last three, which
are 1-based ordinals of the same events.

Two rules carry over from the Agent Viewer selection work and are not
negotiable in the Cockpit mapping: renderer node ids never escape the Rust
boundary, and a list of focusable controls is updated in place rather than
rebuilt, because rebuilding destroys keyboard focus.

## Explicitly out of v1

- Agent Catalog
- Approval Inbox
- procurement Cases as the landing experience
- enterprise governance workflows
- a server requirement for local viewing
- pretending FleetScope can start an agent run when it only reads recordings

The north star is simple: **Zoetrope for Gemini/ADK multi-agent sessions, with
an Agent Viewer that can grow into FleetScope.**

## Links

- [Frontend experience](../design/fleetscope-frontend-experience.md)

- [Agent Workspace normative pack](../design/agent-workspace/README.md)
