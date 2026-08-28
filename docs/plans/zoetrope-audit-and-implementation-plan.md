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

### Phase 2 — browser parity

- Feed the same canonical events to the browser/WASM frontend.
- Support bundled demo, drag-and-drop, and folder selection.
- Match CLI transport and graph interactions.

**Gate:** the same fixture produces the same projection and visible timeline in
native and browser builds.

### Phase 3 — provider onboarding

- Add adapters one provider at a time.
- Keep provider differences at the ingestion boundary.
- Add format/version detection and clear unsupported-input errors.

### Phase 4 — FleetScope platform

Only after the local developer flow is reliable, consider remote sessions, team
workspaces, approvals, audit exports, catalogs, and enterprise users.

## Explicitly out of v1

- Agent Catalog
- Approval Inbox
- procurement Cases as the landing experience
- enterprise governance workflows
- a server requirement for local viewing
- pretending FleetScope can start an agent run when it only reads recordings

The north star is simple: **Zoetrope for Gemini/ADK multi-agent sessions, with
an Agent Viewer that can grow into FleetScope.**
