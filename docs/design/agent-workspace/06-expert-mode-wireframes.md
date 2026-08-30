# Expert Mode wireframes

Grayscale only. No hue appears in this document. Every wireframe carries status as a
word, and hierarchy as weight, case, indent and rule position. Colour is assigned in a
later phase against the locked palette (blue selection, cyan live, violet Warden, orange
Controlled Fault only); if a wireframe here needs colour to be legible it is a broken
wireframe, because the shipped viewer already gives every status a word and a glyph
(`transportBadge` in `apps/web/src/features/viewer/shell.ts`, and its test "gives every
badge a glyph so status is not colour alone").

Expert Mode is opt in. Story Mode is what a reader gets by default, and everything in
this document is behind a deliberate switch.

## 0. What was read first, and which baseline this targets

The instruction was to read the existing viewer before designing anything around it. Two
baselines exist and they are far apart, so the document says which one each claim is
about.

| Path | At HEAD `cfdcca7` | In the dirty worktree |
|---|---|---|
| `apps/web/src/pages/viewer.astro` | 307 lines. Status line, canvas, `<pre>` summary. No rail, no timeline, no inspector, no mode switch. | 1348 lines. Adds Story card, agent rail, inspector, timeline footer, `data-expert` panels, `data-expert-toggle`. |
| `apps/web/src/features/viewer/shell.ts` | Does not exist. | 302 lines. Pure presentation logic with 26 unit tests in `apps/web/tests/viewer-shell.test.ts`. |
| `crates/agent-viewer-web/src/main.rs` | Present. | Modified. |

The worktree work is another agent's, in flight, and this document does not edit it. It is
cited because it is the nearest thing to an Expert surface that exists, and several of its
decisions are correct and should survive. Where this document disagrees with it, it says so
and gives the reason.

The vendored renderer is `crates/agent-viewer-render`, `crates/agent-viewer-core` and the
`zoetrope` substrate. Nothing in this document proposes editing them. Every interaction
below is expressed as a call to the published ABI in `crates/agent-viewer-web/src/main.rs`,
under the comment that already governs it at line 246: "These are the ONLY functions
`apps/web` may call."

## 1. The two data planes, and why the distinction decides the whole design

Expert Mode draws from two independent sources. Keeping them separate is not tidiness; it
is what makes the degraded states honest and what makes the cursor guarantee provable.

**The canonical plane.** `CanonicalEvent[]` over HTTP, fetched by
`apps/web/src/features/live/client.ts` from `GET /runs/:runId/events?after=<cursor>`. Nine
event kinds, four truth labels. This is the plane the run actually happened on. It has no
graph, no camera, no playhead, and no notion of a renderer entry.

**The renderer plane.** A session document handed to `agent_viewer_load(name, main,
companions)`, projected in Rust into `projection.session` plus a `ViewerManifest`, and
drawn by the WASM grid into `#agent-viewer-canvas`. It owns topology, the fold, camera,
selection and the playhead.

They are joined at exactly one point: a canonical sequence number. `ViewerManifest`
(`crates/agent-viewer-render/src/manifest.rs`) maps sequence to renderer entry indices and
back, and the ABI exposes that mapping through `agent_viewer_seek_sequence(sequence)`,
`agent_viewer_item_at(index)` and `agent_viewer_event_detail(sequence)`. Nothing else
crosses. The manifest's own comment at `manifest.rs:171-175` states the rule the UI must
inherit: a renderer index that rests on no event answers `None`, and "callers must not fall
back to a neighbour: reporting the wrong event is worse than reporting none."

Three consequences run through every wireframe below.

1. **The renderer has no append path.** The ABI has `agent_viewer_load` and
   `agent_viewer_load_demo` and nothing else that ingests data. `agent_viewer_load` is
   documented as "Load a session, replacing whatever is showing", and `Viewer::load`
   (`main.rs:77-96`) constructs a fresh `app` and `manifest` at fraction `1.0` with
   `Playhead::Edge`. There is no way to add event 9 to a graph already showing events 1
   through 8 without discarding camera, selection and playhead. A live run polled at 400ms
   would therefore reset the graph two and a half times per second. This is why Section 8
   makes reloading an explicit, reader initiated act with its cost stated, rather than
   something that happens on a timer.
2. **The renderer never tails anything.** `transportBadge` in `shell.ts` refuses to print
   the word "Live" at all, with the reason written into the source: "The browser reads
   finished files and never tails anything ... claiming live execution for a recording is
   the exact dishonesty the product forbids." Its `live` transport value means "at the
   live edge of the data that was loaded". So Expert Mode has two different edges and must
   never merge their vocabulary. Section 9 keeps them apart by name.
3. **They fail independently.** Losing the wasm module removes the graph and the agent
   tree. It does not remove the canonical timeline, provided the timeline is built from
   the canonical plane. Section 11 depends on this.

## 2. What each surface uniquely provides

The review rejected the earlier prototype partly because "sidebar and graph duplicat[ed]
each other". The fix is not to shrink one of them. It is to give each a question the other
cannot answer, and to be able to state that question in one line.

| Surface | The question only it answers | Evidence it is not a duplicate |
|---|---|---|
| **Graph canvas** | What is the shape of the call tree, and which agents are adjacent to the failure? | Position and size never cross the ABI boundary. `agent_viewer_graph_nodes()` is documented "No position or size crosses the boundary: layout stays in Rust." Nothing outside the canvas can reconstruct the shape. |
| **Agent rail** | Which agents exist at all, how deep is each one, how many events and errors did each produce, and did each one terminate? | The rail lists agents the graph does not have. `graphNodeIds()` returns the ids the renderer actually holds, and the worktree rail disables any row outside that set with the title "This agent has no graph node in the current fold." An agent dropped by the fold is invisible in the graph and present in the rail. |
| **Canonical timeline** | In what order did things happen, by canonical sequence, and which single event do I want to inspect? | The graph has a playhead, not an ordering. The rail has counts, not order. Only the timeline is addressable by sequence, which is the one key that reaches `agent_viewer_seek_sequence` and `agent_viewer_event_detail`. |
| **Inspector** | For the one event or agent now selected, what were the recorded field values? | Both other surfaces summarise. The inspector is the only place a `callId`, a `source` or a `rendererEntryIndices` list is readable. |
| **Decision Evidence** | Why was the retry permitted or refused? | Nothing else on the page answers a why. Section 7 explains why this is a separate panel and not five more rows in the inspector. |

Two properties the rail has and the graph structurally cannot:

* **It is reachable.** The canvas is a single `role="img"` element with an
  `aria-label` and an `aria-describedby`. A screen reader gets one sentence for the entire
  topology. The rail is a list of buttons: tab order, arrow keys, names, pressed state.
  The rail is not an accessibility courtesy bolted onto a visual feature, it is the only
  complete rendering of the agent set.
* **It shows depth the graph flattens.** The worktree page already says this in prose at
  `viewer.astro:160`, about the session summary: it "reports the full agent tree,
  including depth the graph flattens". `agentRows()` derives depth by walking the reported
  `parentId` chain, and deliberately not by counting separators in an id, because "the id
  format is an adapter's business". A flattened graph and an indented rail are two
  different true statements about the same session.

And one property the graph has that no list can fake: adjacency. Which agent sits next to
the one that failed is a spatial fact. That is the whole of the graph's job, and Section 4
sizes it accordingly.

## 3. The graph is evidence, not the homepage

Stated as four rules the wireframes obey.

1. **It is never the first thing.** In DOM order and in reading order the run identity, the
   outcome and the timeline precede it. The canvas is centre of the viewport because
   adjacency needs area, not because it is the lede.
2. **Nothing is only in the graph.** Every fact a reader could take from the canvas is also
   available as text somewhere on the page: membership and depth in the rail, order and
   identity in the timeline, values in the inspector. A reader who cannot see the canvas at
   all loses shape, and loses nothing else. This is what makes Section 11's degraded state a
   reduction rather than a failure.
3. **It follows, it does not lead.** Selection flows both ways, but the graph is never the
   only holder of a selection. When the renderer reports a selection the shell renders the
   renderer's answer, including `unknown`, which `agent_viewer_select_agent` documents as
   "a real answer, not an error". The worktree already implements this correctly in
   `selectAgent`, after an earlier version got it wrong in the other direction, and the
   comment records the failure it fixed: "the rail could show a selection the graph never
   had."
4. **It does not animate to look busy.** The renderer already freezes marching ant edges
   and camera glide when transport is `history` or `paused`, with the reason in
   `main.rs:275-278`: those effects "read as 'something is running right now'". Expert Mode
   must not add motion of its own on top of a parked playhead.

## 4. The frame

Grayscale legend, used by every wireframe below.

```
  ═  region boundary, drawn                UPPER  region label, 11px mono, tracked
  ─  hairline, drawn                       Bold   the one primary element in a region
  ·  hairline, implied by space only       [ x ]  a control
  ▸  disclosure, collapsed                 ( x )  a control in its pressed state
  ▾  disclosure, open                      « »    a slot the script writes
```

Desktop, 1440 wide. **Five labelled regions including A**, against the rejected
prototype's eight. The earlier draft of this line said "four regions" and then
drew five labels, which is the kind of miscount this pack's method exists to
catch. `10` D44 fixes the convention for both modes: region A is chrome in Story
and a counted region in Expert, because in Expert it carries content (the run
identity) rather than only the mode switch. `12` counts Story regions as direct
children of `#live-root` and Expert regions as the labelled surfaces, and states
both budgets.

The header reads `Source: live`, not `Controlled Fault`. An earlier draft drew
the latter; `10` C3 forbids it in both modes, because promoting one deliberate
beat to the run level claims the whole run was a fault, and D42 supplies the
provenance wording.

```
╔══════════════════════════════════════════════════════════════════════════════════════╗
║ run 019f2a  ·  Source: live  ·  8 events             [ Story ]  ( Expert )            ║  A  identity + mode
╠═══════════════════╤══════════════════════════════════════════════╤═══════════════════╣
║ AGENTS            │  GRAPH                                       │ INSPECTOR         ║
║                   │                                              │                   ║
║ ▾ onboarding      │              ┌─────────────┐                 │ Decision Evidence ║
║   8 events        │              │ onboarding  │                 │ ─────────────     ║
║   1 error         │              └──────┬──────┘                 │ «warden panel»    ║
║   completed       │                     │                        │                   ║
║                   │        ┌────────────┴────────────┐           │ Event 5           ║
║   warden          │        │                         │           │ ─────────────     ║
║   1 event         │  ┌─────▼─────┐            ┌──────▼──────┐    │ «field list»      ║
║   0 errors        │  │  warden   │            │ dependency  │    │                   ║
║   no terminal     │  └───────────┘            └─────────────┘    │                   ║
║     event         │                                              │                   ║
║                   │  ─────────────────────────────────────────   │                   ║
║ ─────────────     │  At latest loaded event · event 8 ·          │                   ║
║ 2 agents          │  renderer item 27 of 27                      │                   ║
║ 1 without a       │                        [ Fit ] [ Latest ]    │                   ║
║   graph node      │                                              │                   ║
╠═══════════════════╧══════════════════════════════════════════════╧═══════════════════╣
║ TIMELINE  ·  by canonical sequence                                  8 events loaded  ║
║                                                                                      ║
║   1  run_start        onboarding starts                                              ║
║   2  tool_call        fetch_dependency_manifest                                      ║
║   3  tool_result      upstream returned 503              Controlled Fault            ║
║   4  incident         dependency fetch failed            Controlled Fault            ║
║   5  intervention     warden decided                          « current »            ║
║   6  tool_call        fetch_dependency_manifest  retry                               ║
║   7  tool_result      manifest received                                              ║
║   8  run_end          run completed                                                  ║
╚══════════════════════════════════════════════════════════════════════════════════════╝
```

Region A carries three things and stops: which run, what its provenance is, and the mode
switch. The mode switch is the only always enabled control in region A, and it is a two
state segmented control rather than a link, because a reader must be able to see which
mode they are in without reading the page body.

Below 900px the three column body stacks to rail, timeline, inspector, and the canvas is
replaced by the block in Section 11.3. A 480px column cannot render a legible graph, and a
graph nobody can read is not evidence. Section 11.3 is not only the failure state, it is
the small viewport state.

## 5. Agent rail

The rail is the navigation and the accessible fallback. It is a `<ul role="list">` of
buttons, one per agent, ordered parents first by `agentRows()`.

```
╔═══════════════════════════════╗
║ AGENTS                        ║
║                               ║
║ ┌───────────────────────────┐ ║   row, not selected
║ │ ▾ onboarding              │ ║   label from AgentSummary.label
║ │   8 events · 1 error      │ ║   counts from the ABI, never counted here
║ │   completed               │ ║   statusLabel, a word
║ └───────────────────────────┘ ║
║ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ ║   row, SELECTED
║ ┃   warden                  ┃ ║   aria-pressed="true" aria-current="true"
║ ┃   1 event · 0 errors      ┃ ║   indent = depth * 14px, depth from parentId chain
║ ┃   no terminal event       ┃ ║   never rendered as success
║ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ ║
║ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ ║   row, DISABLED
║ │   hotel_search            │ ║   id is not in graphNodeIds()
║ │   3 events · 0 errors     │ ║
║ │   completed               │ ║
║ │   no graph node in this   │ ║   the reason, visible, not only a title attribute
║ │   fold                    │ ║
║ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ ║
║                               ║
║ ─────────────────────────     ║
║ 3 agents · 1 without a graph  ║   the count that makes the rail's job visible
║ node                          ║
╚═══════════════════════════════╝
```

Decisions.

* **The disabled reason is on screen, not in a `title`.** The worktree sets
  `button.title = 'This agent has no graph node in the current fold.'`, which is correct
  content in a place a touch user and most screen reader configurations never reach. The
  string moves into the row. This is the rail's single most distinguishing fact and hiding
  it inside a hover tooltip is what would make the rail look like a duplicate of the graph.
* **The footer count is required.** "3 agents, 1 without a graph node" is the sentence that
  tells a reader the two surfaces disagree and that the rail is the fuller one. Without it,
  a reader who never hovers a disabled row has no way to know the graph is a subset.
* **Status is the ABI's word, unmodified.** `agentStatus()` returns `no terminal event` for
  `terminal === null`, and its comment is the rule: "Silence stays silence ... it must not
  read as success." The rail prints that string. It does not shorten it to "unknown", which
  would sound like a lookup failure rather than an absence in the recording.
* **Depth is indentation only.** No connector glyphs are drawn between rail rows. Drawing a
  tree in the rail is precisely the duplication the review rejected, and it would also
  imply the rail knows sibling order, which `agentRows()` gets from insertion order and not
  from the session.
* **Activating a row is a toggle.** `aria-pressed` and not only `aria-current`, because
  `agent_viewer_select_agent` deselects an id that is already selected. The worktree
  comment states the reason and it is right.
* **A rail click never moves the playhead.** It calls `agent_viewer_select_agent` only.
  Section 6 covers what the inspector must do about that.

## 6. Selected agent

Selecting an agent changes topology focus. It does not change which event is being
inspected, because the ABI has no operation that does both, and inventing one in the shell
would mean the shell deciding which of that agent's events is "the" one.

```
╔═══════════════════╤═══════════════════════════════╤═══════════════════════════════════╗
║ AGENTS            │ GRAPH                         │ INSPECTOR                         ║
║                   │                               │                                   ║
║   onboarding      │        ┌────────────┐         │ AGENT                             ║
║   8 events        │        │ onboarding │         │ warden                            ║
║   completed       │        └─────┬──────┘         │ ───────────────────────────────   ║
║ ┏━━━━━━━━━━━━━━━┓ │              │                │ Kind          policy              ║
║ ┃   warden      ┃ │        ┏━━━━━▼━━━━━┓          │ Parent        onboarding          ║
║ ┃   1 event     ┃ │        ┃  warden   ┃  ← the   │ Events        1                   ║
║ ┃   no terminal ┃ │        ┗━━━━━━━━━━━┛  renderer│ Errors        0                   ║
║ ┃     event     ┃ │                       selected│ Terminal      no terminal event   ║
║ ┗━━━━━━━━━━━━━━━┛ │                               │                                   ║
║                   │                               │ ┌───────────────────────────────┐ ║
║                   │                               │ │ The event on show belongs to  │ ║
║                   │                               │ │ onboarding. Choose one of the │ ║
║                   │                               │ │ selected agent's events below.│ ║
║                   │                               │ └───────────────────────────────┘ ║
║                   │                               │                                   ║
║                   │                               │ WARDEN'S EVENTS                   ║
║                   │                               │   5  intervention  warden decided ║
╚═══════════════════╧═══════════════════════════════╧═══════════════════════════════════╝
```

The bordered note is `foreignEventNote()` from `shell.ts`, rendered verbatim. Its docstring
is the argument for the whole panel: "Selecting an agent does not move the playhead, so the
inspector can be left holding the previously selected event. Rendering it under a heading
naming another agent reads as 'this is what hotel_search did' when it is not."

So the selected agent state has three parts and the order matters: what the agent is, then
the warning that the event below belongs to somebody else, then the agent's own events as a
list of sequence keyed rows the reader can click. The reader is offered the correction; the
shell does not apply it for them by silently seeking to the agent's first event.

The timeline filters to the selected agent at the same moment, via `eventsForAgent()`, and
its header changes from `8 events loaded` to `1 of 8 loaded`. Section 10.4 covers what
filtering does to sequence contiguity.

Deselecting is the same control again, or Escape, which routes to
`agent_viewer_clear_selection()`. That function exists separately "so a caller can clear
without naming a node it would have to know is selected", and the rail uses it rather than
re-sending the selected id.

## 7. Selected event, and the Decision Evidence inspector

Two panels, stacked, in this order. They answer different questions and the review's fifth
complaint was that the technical one was showing up where the human one belonged.

### 7.1 Decision Evidence

Present only when the run contains an `intervention` event. It is the panel that answers
"why", and it is the reason a reader opens Expert Mode at all.

```
╔═══════════════════════════════════════════════════════════════════╗
║ DECISION EVIDENCE                                                 ║
║                                                                   ║
║ Warden permitted one retry.                                       ║   ← the verdict, 21px
║                                                                   ║
║ Decided at        event 5                                         ║
║ Deciding agent    warden                                          ║
║ Rule              «policy id from the intervention event»         ║
║ Rationale         «rationale string, verbatim, mono»              ║
║                                                                   ║
║ ─────────────────────────────────────────────────────────────     ║
║ WHAT IT DECIDED ABOUT                                             ║
║   4  incident      dependency fetch failed    Controlled Fault    ║
║ WHAT FOLLOWED                                                     ║
║   6  tool_call     fetch_dependency_manifest  retry               ║
║   7  tool_result   manifest received                              ║
╚═══════════════════════════════════════════════════════════════════╝
```

Rules for this panel.

* **The verdict is one sentence and it is the largest text in the region.** Four verdicts
  exist, because `recovery.py` defines four outcomes: permitted a retry, refused because
  the operation is not idempotent, refused because the budget is exhausted, refused because
  the failure is not retryable. The panel must be able to render all four. A panel that can
  only say "recovered" is the bug recorded in `04-state-model.md`, where three of four
  Warden outcomes narrate as an authorised retry.
* **`WHAT FOLLOWED` is a list that can be empty, and empty is rendered.** On a refusal there
  is no retry `tool_call`, and the panel says "Nothing followed. The run ended here." It
  does not omit the heading, because an omitted heading looks like a rendering gap rather
  than a recorded absence.
* **Every value is quoted from an event.** No sentence in this panel is composed from a
  template with a computed adjective. The verdict line is chosen from a fixed set of four
  by the recorded outcome, and everything else is a field.
* **It is not in Story Mode.** Story Mode says what happened and what FleetScope did.
  Decision Evidence says which rule fired and what it cited. That is the Expert half of the
  same fact.

### 7.2 Event inspector

```
╔═══════════════════════════════════════════════════════════════════╗
║ EVENT 5                                                           ║
║ ─────────────────────────────────────────────────────────────     ║
║ Sequence         5                                                ║
║ Agent            warden                                           ║
║ Event type       intervention                                     ║
║ Timestamp        2026-08-29T11:04:18.221Z                         ║
║ Status           ok                                               ║
║ Call id          «callId, or the row is absent»                   ║
║ Detail           «summary, verbatim»                              ║
║ Agent path       «agentId»                                        ║
║ Source           «source»                                         ║
║ Renderer items   14, 15                                           ║
╚═══════════════════════════════════════════════════════════════════╝
```

This is `inspectorFields(detail)` rendered in order, unchanged. The function is already
correct and its docstring carries the safety argument: every value "came through an adapter
that drops model reasoning at ingestion. This function introduces no new source of content,
so there is no path by which chain-of-thought or a credential appears here." The wireframe's
job is to place it, not to redesign it.

Placement decisions.

* **`Tool` and `Call id` rows appear only when present.** `inspectorFields` pushes them
  conditionally. The panel must not render an empty row with a dash, which reads as "the
  tool was blank" rather than "this kind of event has no tool".
* **`Renderer items` stays.** It is the only visible evidence of the manifest join, and it
  is the field that explains a `seek` that appeared to do nothing. A list, because one event
  can produce several entries, which is why `renderer_indices_for_sequence` returns a slice.
* **Timestamp is displayed and never used for layout.** See Section 10.2.
* **This panel is below Decision Evidence, and in Story Mode it is absent entirely.** The
  review's complaint was not that these fields are wrong, it was that they were the default
  view. Here they are the second panel of an opt-in mode.

## 8. Unread live events

The situation: a run is still producing events, the reader has scrubbed back to event 4 to
read the incident, and events 9 through 12 have arrived meanwhile. The reader must be told,
must not be moved, and must be able to catch up in one action whose cost is stated.

```
╔══════════════════════════════════════════════════════════════════════════════════════╗
║ TIMELINE  ·  by canonical sequence                    12 events · graph shows 8      ║
║                                                                                      ║
║   3  tool_result      upstream returned 503              Controlled Fault            ║
║ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  ║
║ ┃ 4  incident         dependency fetch failed            Controlled Fault        ┃  ║  ← playhead
║ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  ║
║   5  intervention     warden decided                                                 ║
║   6  tool_call        fetch_dependency_manifest  retry                               ║
║   7  tool_result      manifest received                                              ║
║   8  run_end          run completed                                                  ║
║ ─ ─ ─ ─ ─ ─ ─ ─ ─  the graph was loaded up to here  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ║
║   9  run_start        second attempt starts                       not in the graph   ║
║  10  tool_call        fetch_dependency_manifest                   not in the graph   ║
║  11  tool_result      manifest received                           not in the graph   ║
║  12  run_end          run completed                               not in the graph   ║
╠══════════════════════════════════════════════════════════════════════════════════════╣
║ 4 newer canonical events. The graph shows the session as of event 8.                 ║
║ [ Go to event 12 ]  moves the timeline only          [ Reload graph ]  resets the    ║
║                                                       camera, the selection and the  ║
║                                                       playhead                       ║
╚══════════════════════════════════════════════════════════════════════════════════════╝
```

### 8.1 Why two actions and not one

Because they cost different things, and merging them would hide a reset behind a word that
sounds free.

`agent_viewer_load` is the only way to put event 9 into the graph, and `Viewer::load` builds
a new `app` and a new `manifest` at fraction `1.0` with `Playhead::Edge`. Camera position,
graph selection and playhead do not survive it. A reader who scrubbed to event 4 and pressed
a single combined "catch up" button would lose the thing they were reading. So the reload is
its own control and its consequence is printed next to it, in the same size as the label.

`Go to event 12` is a timeline move. It calls `agent_viewer_seek_sequence(12)` if the
renderer has that event and otherwise moves only the canonical selection, and it never
reloads.

### 8.2 The counter counts canonical events

`4 newer canonical events`, not four renderer entries. One event can produce several entries,
which is why `renderer_indices_for_sequence` returns a slice and why the inspector's
`Renderer items` row is a list. A count of renderer entries would be a larger, unstable
number that means nothing to a reader and does not match the timeline rows they can see.

The count is derived as: highest canonical sequence in `client.ts`'s current page, minus the
highest sequence present in the loaded session. Both are integers the two planes already
hold. Nothing is timed, and nothing is inferred from arrival order.

### 8.3 The divider is a fact, not a decoration

The dashed rule says where the loaded session ends. Rows below it are marked
`not in the graph` in words, so a reader who clicks one and sees the graph not move has
already been told why. Without the divider, `agent_viewer_seek_sequence(11)` returns `false`
and the page has to explain a failure after the fact; the worktree already handles that case
correctly with "Event 11 produced no renderer entry, so the graph did not move", but an
explanation offered before the click is better than a message after it.

### 8.4 The counter does not appear on a finished run

When the run has ended and the loaded session covers every canonical event, the divider, the
marks and the bar are all absent. There is no residual "0 newer events" chrome. A control
that is present and inert is one of the eight regions the review rejected.

## 9. Return to live

There are three distinct destinations here and the earlier prototype's mistake would be to
call them all "live". They get three names, and the name says which plane it acts on.

| Control | Plane | Call | What it does | Reversible |
|---|---|---|---|---|
| `Latest loaded event` | renderer | `agent_viewer_go_live()` | Moves the playhead to the edge of the session already loaded. | Yes, scrub back. |
| `Go to event N` | canonical | `agent_viewer_seek_sequence(N)` plus timeline scroll | Moves to the newest canonical event, seeking the graph too when it holds that event. | Yes. |
| `Reload graph` | renderer | `agent_viewer_load(...)` | Rebuilds the session so the graph includes the newest events. | **No.** Camera, selection and playhead are lost. |

```
   parked in the past                            at the loaded edge
   ┌─────────────────────┐                       ┌─────────────────────┐
   │ History · event 4   │  [ Latest loaded ]──▶ │ At latest loaded    │
   │ renderer item 12/27 │                       │ event · item 27/27  │
   └─────────────────────┘                       └─────────────────────┘
             │                                             │
             │  4 newer canonical events exist             │
             ▼                                             ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │ [ Reload graph ]   states: resets camera, selection and playhead  │
   └──────────────────────────────────────────────────────────────────┘
```

The word "Live" appears in Expert Mode only against the canonical plane, and only when the
run's own truth label says so. The renderer's edge is always "latest loaded event". This is
not a stylistic preference: `transportBadge` already refuses to print "Live" for a recording
and returns `At latest event` instead, and its unit test is named "never says 'live' for a
recording". Expert Mode inherits that vocabulary rather than reintroducing the word one
layer up.

The `Latest loaded event` control is disabled, not hidden, when `snapshot.atEdge` is true.
Hiding it would make the control appear and disappear as the reader scrubs, which is motion
in the chrome. Disabled with the position readout beside it reading `renderer item 27 of 27`
says the same thing and stays still.

## 10. The canonical event indexed timeline

### 10.1 One row per event, equal height, sequence in the gutter

```
  ┌──────┬──────────────────┬────────────────────────────────┬────────────────────────┐
  │ seq  │ kind             │ label                          │ marks                  │
  ├──────┼──────────────────┼────────────────────────────────┼────────────────────────┤
  │   1  │ run_start        │ onboarding starts              │                        │
  │   2  │ tool_call        │ fetch_dependency_manifest      │                        │
  │   3  │ tool_result      │ upstream returned 503          │ Controlled Fault       │
  │   4  │ incident         │ dependency fetch failed        │ Controlled Fault       │
  │   5  │ intervention     │ warden decided                 │ Warden                 │
  │   6  │ tool_call        │ fetch_dependency_manifest      │ retry                  │
  │   7  │ tool_result      │ manifest received              │                        │
  │   8  │ run_end          │ run completed                  │                        │
  └──────┴──────────────────┴────────────────────────────────┴────────────────────────┘
     ▲                                                          ▲
     │ mono, right aligned, the canonical key                   │ words, never only a hue
     │ this is the ONLY thing a click sends to Rust
```

The row is a `<button data-sequence="N">`. Its click handler calls
`agent_viewer_seek_sequence(N)` and nothing else. The worktree already builds it this way
and its comment names the rule: "The canonical key, and the only thing a click sends back to
Rust."

### 10.2 Never by wall-clock proportion

Three separate reasons, any one of which is sufficient.

1. **The ABI already offers the wrong thing and the shell already refuses it.**
   `agent_viewer_seek(fraction: f64)` is exported and documented as "the scrubber's own
   input". The `Api` type declared in `viewer.astro` lists sixteen functions and
   `agent_viewer_seek` is deliberately not one of them. That omission is the existing
   position and this document keeps it. Expert Mode must not add it back.
2. **Proportional layout hides the evidence.** In the eight event MCP transcript the
   incident and the intervention are milliseconds apart while the run may wait far longer
   for a tool. Laid out in proportion to elapsed time, the three rows that carry the entire
   governance story collapse into one pixel band and the empty wait dominates the surface.
   The timeline exists to make the decision findable.
3. **There is no latency to lay out.** `CanonicalEvent` carries a timestamp, not a duration.
   Any bar width would be a difference the UI computed between two adjacent timestamps and
   then presented as if it were recorded. `01-prototype-autopsy.md` records the rejected
   prototype displaying three invented latencies for exactly this reason.

The timestamp is still shown, in the inspector, as a field, at full precision. It is
displayed and never measured.

Note that even the renderer's internal `fraction_for_renderer_index` is index proportional,
`index / last`, and not time proportional. So the sequence indexed timeline agrees with the
renderer's own model rather than fighting it. The manifest's comment draws the line this
document also draws: "Fractions are for the scrubber, where the fraction IS the user's
input. Nothing derives identity from one."

### 10.3 Paging is by count, and the count is honest

The footer reads `8 events loaded` or `8 of 24 loaded`, and `Load more events` appears only
when `hasMore` is true. "Loaded" rather than "total", because `agent_viewer_events(offset,
limit)` returns a window and the shell holds a prefix of the session. Printing a total the
page does not yet have rows for would be a number the reader cannot reconcile with what is
on screen.

### 10.4 Filtering by agent must not close a gap silently

When an agent is selected, `eventsForAgent()` filters the rows and the sequences stop being
contiguous. Rows that follow a gap get a gap marker rather than sitting flush against each
other.

```
  │   2  │ tool_call        │ fetch_dependency_manifest      │
  │      ·  3 events from other agents                       ·
  │   6  │ tool_call        │ fetch_dependency_manifest      │
```

Without the marker, sequences 2 and 6 adjacent read as "nothing happened in between", which
is false and is the exact class of error the manifest's "must not fall back to a neighbour"
rule exists to prevent. The marker counts events, not time.

## 11. Renderer unavailable

### 11.1 What actually fails

`boot()` can fail in three places, and the reader should be told which.

1. `waitForMeasuredHost('agent-viewer-canvas')` gives up after 5 seconds. The host was never
   measured, so the grid would be built at zero width.
2. `loadGlue()` rejects. `/wasm/viewer.js` is missing or threw, usually because
   `pnpm build:wasm` has not run.
3. The module loads but `agent_viewer_load_demo` is not a function. The page asserts the ABI
   by name "so a partial load fails here rather than at the first call site with an
   unhelpful 'not a function'".

### 11.2 The state

```
╔═══════════════════╤══════════════════════════════════════════════╤═══════════════════╗
║ AGENTS            │ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │ INSPECTOR         ║
║                   │                                              │                   ║
║ The agent tree    │ │  GRAPH UNAVAILABLE                      │  │ Decision Evidence ║
║ comes from the    │                                              │ ─────────────     ║
║ renderer, which   │ │  The Agent Viewer renderer could not be │  │ «warden panel»    ║
║ did not load.     │    loaded (the renderer loaded without       │                   ║
║                   │ │  its expected ABI). Run pnpm build:wasm.│  │ Event 5           ║
║ The events below  │                                              │ ─────────────     ║
║ are unaffected.   │ │  Topology and the agent tree are        │  │ «canonical fields»║
║                   │    unavailable. Every event below is         │                   ║
║                   │ │  still readable.                        │  │                   ║
║                   │ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │                   ║
╠═══════════════════╧══════════════════════════════════════════════╧═══════════════════╣
║ TIMELINE  ·  by canonical sequence                                  8 events         ║
║   1  run_start        onboarding starts                                              ║
║   …                                                                                  ║
╚══════════════════════════════════════════════════════════════════════════════════════╝
```

How much survives depends on which plane the surface reads, which is the point of Section 1.

| Surface | Survives a renderer failure | Because |
|---|---|---|
| Timeline | **Yes**, in the agent workspace | Rows come from `client.ts` over HTTP. No ABI call. |
| Decision Evidence | **Yes** | The intervention event and its rationale are canonical fields. |
| Event inspector | **Partly** | Canonical fields survive. `Renderer items` is dropped, because the manifest is gone. The row is removed, not shown empty. |
| Agent rail | **No** | Membership, depth, counts and terminal status all come from `agent_viewer_agents()`. |
| Graph | **No** | |

On `/viewer`, which reads local files and has no server, there is no canonical plane. A
renderer failure there means there is no session at all, and the honest page is the message
alone. That difference is a property of the deployment, not of the design, and it should be
written down rather than papered over with a rail that renders an empty list.

**A defect this replaces.** In the current `boot()`, the catch path calls `say(...)` but
never removes `fallbackEl`. `fallbackEl?.remove()` runs only on the success branch. So after
a failure the status line says the renderer could not be loaded while the canvas continues to
read `Loading the Agent Viewer…` indefinitely. Two contradictory statements are on screen at
once and the more prominent one is the false one. The wireframe above requires the canvas
placeholder to be rewritten, not left, on failure.

### 11.3 The same block at small viewports

Below roughly 900px the canvas is replaced by this block with a different second paragraph:

```
  │  GRAPH NOT SHOWN AT THIS WIDTH                              │
  │                                                              │
  │  The graph needs more width than this screen has. Every      │
  │  event is still readable below.                              │
```

Not a scaled down graph, and not a horizontally scrolling one. A graph too small to read is
not evidence, and the QA suite asserts zero horizontal overflow at 480px. Stating the reason
costs two lines and removes the suspicion that something is broken.

## 12. No matching event: the sidecar state

The renderer's playhead can rest on an item that no event produced. A sub agent sidecar is
real renderer state with no canonical origin.

The shell learns this by being told, not by asking. After an input the renderer handled
itself, `selection_payload` pushes `{selectedAgentId, sequence, rendererEntryIndex}` on the
`fleetscope:viewer-selection` event, and it fills `sequence` from
`manifest.sequence_at(entry_index)`, which is `None` for a sidecar. The comment above that
line is the rule this section renders: "A renderer item that came from no viewer event
reports `null`, and the shell must say so rather than showing the nearest event under a wrong
heading." `agent_viewer_item_at(index)` answers the same question on demand, and
`Snapshot.sequence` carries it too, documented as "`null` is a real answer".

```
╔═══════════════════╤═══════════════════════════════╤═══════════════════════════════════╗
║ AGENTS            │ GRAPH                         │ INSPECTOR                         ║
║                   │                               │                                   ║
║   onboarding      │   ┏━━━━━━━━━━━━━━━━━━━━━┓     │ ┌───────────────────────────────┐ ║
║   8 events        │   ┃ « sidecar item »    ┃     │ │ Renderer selection has no     │ ║
║                   │   ┗━━━━━━━━━━━━━━━━━━━━━┛     │ │ matching viewer event.        │ ║
║                   │                               │ └───────────────────────────────┘ ║
║                   │  ───────────────────────────  │                                   ║
║                   │  History · renderer item 14   │ There is nothing to inspect here. ║
║                   │  of 27 · no event here        │ Choose an event from the timeline.║
║                   │                               │                                   ║
╠═══════════════════╧═══════════════════════════════╧═══════════════════════════════════╣
║ TIMELINE  ·  by canonical sequence                                  8 events loaded  ║
║   no row is marked current                                                           ║
╚══════════════════════════════════════════════════════════════════════════════════════╝
```

Rules.

* **The message is `NO_EVENT_MESSAGE`, verbatim.** It is exported from `shell.ts` with the
  argument attached: "Choosing the nearest event instead would put real content under a
  wrong heading, which is worse than admitting there is nothing to show." Rendering the
  constant rather than a retyped sentence keeps the page and the unit test that asserts it
  ("has a message that refuses to guess") describing the same string.
* **The position readout is `positionLabel(snapshot)`, verbatim**, which produces
  `renderer item 14 of 27 · no event here` for this case. The reader is told where the
  playhead is even though there is no event, so the state does not read as a hang.
* **The previous event's fields are cleared, not left standing.** Leaving event 5's fields
  under a heading while the playhead sits on a sidecar is the same class of error
  `foreignEventNote` exists to prevent, one level down.
* **No timeline row is marked current.** `aria-current` is false on every row. Marking the
  nearest row would be the neighbour fallback the manifest forbids.
* **Decision Evidence stays.** It is keyed to the run's intervention event, not to the
  playhead, so it does not blank when the playhead lands on a sidecar. This is the one panel
  that survives, and it should, because the reason it exists has not stopped being true.

## 13. Entering and leaving Expert Mode moves nothing

This is a guarantee, so it needs a mechanism and a test, not an assurance.

### 13.1 What could move

Four pieces of state could plausibly be disturbed by a mode switch:

1. the renderer playhead (`Snapshot.entryIndex`, `Snapshot.sequence`),
2. the renderer selection (`Snapshot.selectedAgentId`),
3. the renderer transport (`Snapshot.transport`, `Snapshot.atEdge`),
4. the canonical cursor in `client.ts`.

### 13.2 The mechanism

**The mode switch calls no ABI function.** It writes `data-mode` on the root, flips `hidden`
on the panels, and updates `aria-expanded`. That is the whole handler. The worktree's
existing `data-expert-toggle` listener already has this shape: it sets `aria-expanded`, swaps
the button label, and sets `panel.hidden` for each `[data-expert]` element. No `api.*` call
appears in it. This document keeps that property and states it as a rule rather than leaving
it as an accident of the current implementation.

**Every path that moves the playhead is enumerable, and none is on the mode path.**
`agent_viewer_seek_sequence` has exactly one call site, inside `selectEvent(sequence)`, and
`selectEvent` is reached from exactly two handlers: a timeline row click and a chapter click.
`agent_viewer_go_live` is reached from the `Latest loaded event` button.
`agent_viewer_load` is reached from the file input, the folder input, the demo button and the
`Reload graph` button. A mode switch is none of these, and the funnel through a single
`selectEvent` is what makes the claim checkable by grep rather than by inspection.

**The canonical cursor is not UI state.** `client.ts` refetches `?after=0` on every tick and
renders whatever comes back, with the reason in its own header comment: "There is no local
notion of progress; if the API returns no events, the page shows no story." Since the cursor
is not held by the view, no view change can move it. A mode switch also does not issue a
request, so it cannot cause a re run: the only `POST /runs` in the client sits inside the
`live-start` click handler, and its body is documented as "The ONLY field. No prompt, target,
budget or model can be sent." 

**The graph is never unmounted.** This is the subtle one. **Amended by `10` C33
in favour of D22:** `#agent-viewer-canvas` must never be *constructed* inside a
subtree that Expert Mode hides or that can be zero width, and must never be moved
in the DOM between modes. Once it is built, hiding and revealing it is safe;
`06` section 14 item 3 records that the shipped `/viewer` canvas already sits
outside the mode panels and is visible in both modes. The original wording here,
"must never be inside a subtree that Expert Mode hides", forbids something that
is not the hazard and would have sent phase 7 in the opposite direction to D22. The renderer measures its host when the WebGL2 grid is constructed, which is why
`boot()` awaits `waitForMeasuredHost` before `loadGlue`. A canvas hidden in Story Mode and
revealed in Expert Mode would either be measured at zero width and stay blank, or need a
rebuild, and a rebuild is `agent_viewer_load`, which resets everything. The same hazard is
already documented for the other renderer host in `CockpitMount.astro`.

The consequence for the wireframes is concrete: in Story Mode the canvas is not
`display: none`. It is not in the Story DOM at all on first paint, and it is constructed once
when Expert Mode is entered for the first time, after its host has been measured, and then
never torn down. Entering Expert Mode a second time reveals an already built graph in the
state the reader left it.

### 13.3 The test

```
  const before = JSON.parse(api.agent_viewer_snapshot());
  toggleMode();            // Story -> Expert
  toggleMode();            // Expert -> Story
  toggleMode();            // Story -> Expert
  const after  = JSON.parse(api.agent_viewer_snapshot());

  expect(after.entryIndex).toBe(before.entryIndex);
  expect(after.sequence).toBe(before.sequence);
  expect(after.selectedAgentId).toBe(before.selectedAgentId);
  expect(after.transport).toBe(before.transport);
  expect(after.atEdge).toBe(before.atEdge);
```

Run it from a non default position, that is after seeking to a middle sequence and selecting
an agent, or it passes trivially against the edge state every fresh load produces. In the
browser suite, add a network assertion for the same window: zero requests to `/runs` during
the three toggles. Together those two cover "does not move the cursor" and "does not re run".

## 14. Defects found while reading, which these wireframes assume are fixed

Recorded here because the wireframes depend on them, not as a change list for this document
to act on.

1. **The failed boot leaves a false placeholder.** `fallbackEl` is removed only on the
   success branch of `boot()`, so a renderer failure shows `Loading the Agent Viewer…` on the
   canvas forever, contradicting the status line. Section 11.2.
2. **The disabled rail row explains itself only on hover.** The "no graph node in the current
   fold" reason is in a `title` attribute. It is the rail's most load bearing sentence.
   Section 5.
3. **The expert toggle hides the timeline and the summary but not the canvas.** The current
   `[data-expert]` panels are the timeline footer and the summary card; the canvas sits
   outside them and is visible in both modes. The locked direction is that Story Mode has no
   graph, so the canvas needs to join the mode switch, under the constraint in Section 13.2
   that it must not be hidden and revealed by `hidden` alone.
4. **`/viewer` runs its own light theme.** Paper `#f6f7fb`, Georgia at up to 58px, a gradient
   filled primary button and a conic gradient orb. Expert Mode is specified here against the
   shared near black surface. Reconciling those two is a separate task and this document does
   not assume it has happened.

## 15. What this document does not decide

* Exact hex values, type sizes in px and spacing steps. Grayscale only here by instruction.
* Whether Expert Mode is a route, a query parameter or in page state. The guarantee in
  Section 13 holds for in page state and for a query parameter that does not remount; it does
  **not** hold for a route change, which destroys the renderer and forces an
  `agent_viewer_load` on the way back. If a route is chosen later, Section 13 has to be
  redone and the "moves nothing" claim withdrawn or re-earned.
* The keyboard map. The renderer already binds Space, arrows, `g`, `o` and `?` inside the
  canvas. Expert Mode's own controls need a map that does not collide with those, and it
  needs the canvas focus boundary drawn explicitly.
* Whether the agent workspace's Expert Mode and `/viewer` are one surface or two. They share
  the ABI and the shell module; they do not share a data plane. Section 1 gives the criterion
  for answering it and Section 11 shows where the answer changes the result.
