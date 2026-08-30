# Component contracts

Phase 9 of the agent workspace redesign. This is the document a coding agent
builds against. Every component below is specified by its mode, its props, the
exact API field or canonical event each prop derives from, every state it can
occupy including empty and error, its keyboard behaviour and place in the focus
order, its behaviour at three viewports, and what it is forbidden from
displaying.

## Why this document exists

The four earlier phases decided what the reader meets and in what order. None of
them decided what a component *is*. Without that, the same fact gets derived
twice in two places, drifts, and the page starts disagreeing with itself. That
is the mechanism behind the review's fourth complaint, sidebar and graph
duplicating each other: it was not a layout mistake, it was two components each
computing "what is the status of the read" from the same events and rendering
the answer in two different vocabularies.

So each contract below names exactly one owner for each fact. If a fact appears
in two components, one of them holds it and the other references it, and the
contract says which.

The second purpose is the truth restrictions. Every component has a section
saying what it may not render and what it must say when the evidence is absent.
Those are not stylistic notes. They are the difference between a page that
reports and a page that narrates, and they are written per component because
that is where the temptation actually appears: a graph with one node looks
broken, and the fix a developer reaches for first is to draw the node that
should be there.

## 0. What this document inherits, and what it decides

Inherited and not reopened:

| Inherited | Value | Source |
|---|---|---|
| Reading order, seven items | truth, outcome, causal progress, incident or result, action, topology, evidence | `03` section 1.1 |
| Story regions | 3: Verdict, Progress, Action | `03` section 3.1 |
| Story word budget above the fold | 62 | `03` section 2.1 |
| Story interactive elements in the body | 1 before a run, 0 during, 2 after | `03` section 3.2 |
| Story animations | 0 | `02` section 3.1 |
| State enum | twelve values, listed in `04` section 8.1 | `04` |
| `provenance` on `LiveView` | derived from events, never from capability | `04` section 6 |
| Absence must never be rendered as a value | | `01` section 6 |

This document decides: the fourteen component boundaries, their props and the
field each prop reads, their state tables, one global focus order, three
viewport behaviours each, and the per component truth restrictions.

This document does not decide colour values, spacing units, type sizes or file
layout. It names hue *roles* only where a role is load bearing for honesty, for
example that a Warden refusal may not be painted in the success role.

## 1. The wire, verbatim

Every prop below traces to one of these three responses. They were read from
source rather than recalled, and the payload table was read from all three event
producers rather than from the eight event MCP transcript alone.

### 1.1 GET /runs/capability

`apps/api/src/routes/runs.ts:108-138`.

```jsonc
{
  "liveMode":      true,          // boolean
  "durableLedger": true,          // boolean
  "workerMode":    "pure",        // 'pure' | 'adk'
  "runDriver":     "mcp",         // 'worker' | 'mcp'
  "scenarios": [{                 // LIVE_SCENARIOS, packages/run-ledger/src/scenario.ts
    "id": "dependency_onboarding",
    "description": "...",
    "rootAgent": "dependency_onboarding",
    "delegatedAgent": "security_review",
    "target": "google/adk-python",
    "externalOperation": "read-only repository metadata",
    "recoveryAction": "retry_idempotent_read",
    "sideEffectClass": "idempotent_read",
    "maxWardenRetries": 1,
    "maxModelCalls": 6,
    "timeoutMs": 90000
  }],
  "budget": { "used": 0, "limit": 60, "perRunCeiling": 6 },
  "activeRunId": null             // string | null
}
```

**Type gap the coding agent will hit.** `Capability` in
`apps/web/src/features/live/state.ts:76-86` declares only `liveMode`,
`runDriver`, `durableLedger`, `budget` and `activeRunId`. It does **not** declare
`workerMode` or `scenarios`. Any component that wants the scenario target, the
side effect class or the retry ceiling needs the interface widened first. Widen
it by adding optional fields, because a deployment on an older API build will
not send them and a required field would turn that into a parse failure rather
than a missing value.

### 1.2 GET /runs/:runId

`runs.ts:142-157`.

```jsonc
{
  "run": {                        // RunRecord, packages/run-ledger/src/record.ts:29-52
    "runId": "run-...", "sessionId": "sess-...", "scenarioId": "dependency_onboarding",
    "mode": "live",               // 'live' | 'recorded_fallback'
    "state": "running",           // 'admitted'|'running'|'completed'|'failed'|'stopped'|'timed_out'
    "startedAt": "...", "endedAt": null,
    "modelCalls": 0, "estimatedCostUsd": 0, "interventionCount": 0,
    "terminalResult": "unknown",  // 'succeeded'|'failed'|'timed_out'|'stopped'|'unknown'
    "idempotencyKey": "run-...:retry_idempotent_read:1",
    "correlationId": "corr-..."
  },
  "phase": "starting",            // 'starting'|'delegated'|'incident'|'intervening'|'finished'
  "highWaterMark": 0,
  "observed": { "modelCalls": 0, "toolCalls": 0, "wardenActions": 0 }
}
```

`RunSnapshot` in `state.ts:53-59` picks five of those thirteen fields. Reading
`interventionCount`, `correlationId`, `idempotencyKey` or `estimatedCostUsd`
requires widening it. `estimatedCostUsd` is set to 0 in `newRun`
(`record.ts:70`) and is never written again by anything, so it is forbidden
outright in section 4 rather than merely unwired.

### 1.3 GET /runs/:runId/events?after=N

`runs.ts:169-189`. `after` is parsed with `Number.parseInt` and clamped to 0 for
anything non finite or non positive, so a malformed cursor silently returns the
whole run rather than erroring.

```jsonc
{
  "runId": "run-...", "state": "running", "phase": "incident",
  "events": [ /* RunEvent[], packages/run-ledger/src/event.ts:32-44 */ ],
  "highWaterMark": 8,
  "complete": false,              // run.endedAt !== null
  "observed": { "modelCalls": 0, "toolCalls": 2, "wardenActions": 1 },
  "replay":   { "modelCalls": 0, "toolCalls": 0, "wardenActions": 0 }   // literal zeroes
}
```

One `RunEvent`:

```jsonc
{ "record": "event", "runId": "...", "correlationId": "...", "sequence": 1,
  "ts": "2026-01-01T00:00:00.000Z", "agent": "external_agent",
  "kind": "run_start", "truth": "live", "payload": { } }
```

`CanonicalEvent` in `state.ts:42-48` omits `ts` and `correlationId`. Any
component wanting a timestamp column needs the interface widened. There is no
duration, no latency and no elapsed field anywhere on this shape, which is why
section 4.13 forbids them.

### 1.4 Payloads by kind, by producer

Three producers write events and they do not agree on payload shape. A component
that reads `payload.idempotencyKey` and finds it missing has not hit a bug, it
has hit the ADK producer. Every payload read in section 4 is therefore specified
with a fallback.

| Kind | MCP, `mcp_server.py` | Scripted, `session.py` | ADK, `adk_runtime.py` and `capture.py` |
|---|---|---|---|
| `run_start` | `{target, driver:'mcp', client}` | `{target}` | `{target, model, runtime:'google-adk'}` |
| `agent_start` | not emitted | `{}` | `{}` |
| `delegation` | **never emitted** | `{to, reason}` | `{to, branch}` |
| `model_call` | never emitted | never emitted | `{call, limit}` |
| `tool_call` | `{tool, target, idempotencyKey, attempt}` | same | `{tool, args:{target}}` redacted |
| `tool_result` ok | `{tool, status:'ok', target, defaultBranch, stars, archived, license}` | same | shape from the tool |
| `tool_result` failed | `{tool, status:'failed', reason}` | same | as emitted |
| `tool_result` refused | `{tool, status:'refused', reason}` or `{tool, status:'refused', requested}` | `{tool, status:'refused', reason}` | n/a |
| `incident` | `{tool, reason, sideEffectClass, retryable}` | same | `{...}` from the runtime error code |
| `intervention` | `{outcome, rationale, idempotencyKey, retriesUsed, maxRetries}`, agent `warden` | same | same |
| `agent_end` | not emitted | `{}` | `{}` |
| `run_end` | `{terminalResult, delegationObserved:false}` | `{terminalResult}` | `{terminalResult, ...}` |

Truth labels by producer: MCP writes `live` on everything except the fault
carried result and its incident, which carry `controlled_fault`
(`tools.py:122-126`). Scripted writes `recorded` on everything except the same
two, which is exactly why `04` section 6 derives provenance with
`some(truth === 'live')` and not `every(truth === 'recorded')`.

`license` is `str | None` (`tools.py:68`), so it is the one tool result field
that can legitimately be null, and section 4.7 says what to render for it.

### 1.5 The `model_call` finding, and what it forbids

`observedWork` counts events of kind `model_call` (`event.ts:123`). Only
`capture.py:93` emits that kind, and only under `workerMode: 'adk'`. On the MCP
path and on the scripted path no `model_call` event exists, ever.

The consequence runs further than it first appears. `runs.ts:265` writes
`run.modelCalls = work.modelCalls` at `run_end`, `callsUsed`
(`admission.ts:75-77`) sums `run.modelCalls` across the ledger, and
`capability.budget.used` returns that sum. So on the live MCP path
`budget.used` is **permanently 0**, and `observed.modelCalls` is permanently 0.

Rendering `0 / 60 model calls` beside a live run therefore states something
false by implication. A model did run: it ran in the developer's own Gemini or
Antigravity CLI, on that CLI's own auth, which is the entire architecture
(`mcp_server.py` header). FleetScope cannot see it and must say so rather than
report a zero. Section 4.7 fixes the wording, and the current string is not
protected: `scripts/qa-live.ts` asserts only that `#live-budget` contains the
substring `model calls`, so a longer honest string still passes.

## 2. Shared vocabulary every component uses

### 2.1 The absence vocabulary

Four distinct reasons a value can be missing. They must never collapse into one
word, because they mean different things about the system.

| Word | Meaning | Example |
|---|---|---|
| `Unknown` | The runtime cannot report this. It is not a gap in FleetScope. | Delegation on the MCP path. |
| `Not observed` | Reportable in principle, and no event carries it yet. | The acting agent before the first event. |
| `None` | An event exists and its value is genuinely empty. | `license` is null on a repository with no licence. |
| `Not applicable` | The field cannot exist in this configuration. | `idempotencyKey` on an ADK `tool_call`. |

Forbidden in every component, without exception: `0`, `-`, `N/A`, `--`, an
empty string, a spinner that never resolves, or a plausible default. A dash in
a cell is indistinguishable from a rendering bug and reads as "nothing
happened", which is a claim.

### 2.2 The mode contract, and why the order is load bearing

Expert Mode is not a CSS class. It is a three part signal that the WASM renderer
already listens for, and the ordering is a correctness constraint rather than a
preference.

1. `[data-story]` root carries `data-mode="story" | "expert"`.
2. `document.documentElement` carries `data-cockpit-mode` with the same value.
3. `document` receives `CustomEvent('fleetscope:mode', { detail: { mode } })`.

All three exist today in `apps/web/src/components/StoryPanel.astro:326-344` and
are read in `apps/web/src/features/cockpit/CockpitMount.astro:200-216`.

**Why the reveal must precede the mount.** ratzilla sizes the terminal grid from
`parent.client_width()` exactly once, at construction, and nothing re derives it
(`CockpitMount.astro:147-155`). `html[data-cockpit-mode='story'] [data-expert-surface]`
is `display: none` (`html[data-cockpit-mode='story'] [data-expert-surface]`, `global.css:1764` at HEAD and `:2108` in the dirty worktree; cite it by selector, per `10` C39), which reports a zero width. A grid
built at zero columns draws nothing, forever, while the status line, the summary
and the fingerprint all still look correct. So the attribute flip must happen
before the mount is awaited, which is what `waitForExpertMode` then
`waitForMeasuredHost` already encodes. Any new mode switch that sets the
attribute after mounting, or that mounts the graph inside a collapsed column,
reintroduces a failure that presents as a blank canvas with no error.

At 390px this is the reason Expert Mode becomes a tab set rather than a narrow
third column: a column collapsed to zero width is the same bug as a hidden one.

### 2.3 One global focus order

Focus order is specified once here rather than per component, because tab order
is a property of the page and a per component statement cannot be checked.

Story Mode, in DOM order:

```text
1  skip link                    (BaseLayout, existing)                1 stop
2  site nav                     (Nav.astro) brand anchor + 8 links    9 stops
3  mode switch                  RunCommandBar                         1 stop
4  #live-start                  region C, always in the DOM           1 stop
5  #live-replay                 present only when canReplay           1 stop
6  #live-replay-back            present only when historical_replay   1 stop
```

**The nav is nine stops, not one. Corrected by `10` C37.** `Nav.astro:32` renders
a brand anchor and `Nav.astro:15-23` maps seven links, which `10` D2 takes to
eight by adding `/live`. Counting the nav as one entry made `12` A4 read "six
stops" for a page that has fourteen, so a reviewer tabbing a correct build would
have recorded a failure against the item rather than against the page. A4 now
reads "six stops after the site nav".

Expert Mode inserts, after 6:

```text
7  AgentRail                    one tab stop for the rail, arrow keys within
8  EventConsole                 one tab stop, arrow keys within rows
9  CanonicalTimeline            one tab stop, arrow keys within rows
```

**There is no graph canvas stop on `/live`.** Removed by `10` D18 and C22: Expert
Mode on that route has no canvas. The canvas stop belongs to `/viewer`, where
`06` specifies it. `12` A5's "four more stops" becomes three.

Rules that hold across both:

* Each list like surface is **one** tab stop with roving `tabindex`, not one
  stop per row. An eight event run would otherwise cost eight tab presses to
  cross, and a longer one proportionally more.
* Switching mode moves focus to the first heading of the newly revealed region
  and announces it through the existing `[data-story-announce]` live region.
  Leaving focus on the switch means a screen reader user is told nothing
  changed.
* Nothing autofocuses on load. The reader has not asked for anything yet.
* No component may add a positive `tabindex`.

### 2.4 The three viewports

| Viewport | What actually constrains it | Consequence |
|---|---|---|
| 1440x900 | nothing | Story is one column with a measure cap. Expert can be three columns. |
| 1280x720 | **height**, not width | 720 minus browser chrome leaves roughly 600px. The Story fold shrinks; Expert drops to two columns so the console keeps usable rows. |
| 390x844 | width | Single column everywhere. Expert becomes a tab set. |

`scripts/qa-live.ts` runs at 1440x900 and 480x900 and asserts zero horizontal
overflow at the narrow one. 390 is narrower than 480, so a layout that is clean
at 390 is clean at the width QA actually measures. Build and check at 390; the
QA viewport then follows.

## 3. Ownership map

One fact, one owner. Read this before writing any component, because it is the
answer to the review's fourth complaint.

| Fact | Owner | Everyone else |
|---|---|---|
| Run level truth and provenance | ModeTruthBadge | may not render a truth word at run level |
| The outcome sentence | OutcomeHero | may not restate it |
| Per beat status and per beat truth | CausalProgress | AgentRail and CanonicalTimeline show sequence, not status |
| Delegation observability | CurrentAgent | RuntimeEdge shows absence of an edge, not the words |
| Incident reason in plain language | IncidentExplanation | DecisionEvidence shows the raw payload |
| Warden outcome and rationale | DecisionEvidence | IncidentExplanation may name the outcome only |
| Terminal result and budget | ResultSummary | nobody else |
| Event cursor and high water mark | RunCommandBar | CanonicalTimeline shows per event sequences |
| Agent identity and last action sequence | AgentRail | AgentNode renders topology, not a status dot |
| Raw payload text | EventConsole | nobody else renders a payload verbatim |

## 4. The fourteen contracts

> **This section is edited in place when `10` overrules it.** The README's policy
> of leaving lane documents as written protects the reasoning behind a decision,
> which is worth keeping. It does not protect a typed component contract, because
> an implementer copies one of these rather than reading it. `10` D48 makes
> component contracts and drawn strings the exception: where a resolution in `10`
> changes what a component renders, the change is applied here and marked, with a
> pointer to the decision that made it. Every marker below is one of those.

Each contract lists props with the field they read, states, keyboard, three
viewports, and truth restrictions. Props are described as an interface because
the target is Astro plus a small typed client, and the shape is what matters
rather than the framework.

### 4.1 RunCommandBar

**Mode** Both. This is the only chrome in Story Mode and it is deliberately thin.

**Purpose** Say which run is on screen and offer the one control that changes
the surface rather than the run. It holds no verdict, no progress and no
primary action, because those are regions A, B and C and this bar is not a
region (`03` section 3.1).

```ts
interface RunCommandBarProps {
  runId: string | null;          // GET /runs/:runId -> run.runId, else null before a run
  scenarioId: string | null;     // run.scenarioId, or capability.scenarios[0].id before a run
  cursor: number;                // events.highWaterMark  (LiveView.cursor)
  eventCount: number;            // events.length. NEVER cursor, NEVER highWaterMark
  mode: 'story' | 'expert';      // client owned, mirrored to the URL
}
```

**`cursor` and `eventCount` are two numbers and must not be conflated.** Added by
`10` C34. `highWaterMark` is the last stored event's `sequence`
(`apps/api/src/routes/runs.ts:152, 183, 276`), not a count.
`RunEventLedger.all` drops any line that fails `parseWorkerEvent` and any
duplicate sequence, and `POST /runs/:runId/events` counts rejections and stores
nothing for them, so one rejected event in a batch leaves `highWaterMark` one
higher than the number of events that exist. Any rendered count of events is
`events.length`. A cursor is labelled as a cursor wherever it is visible, and it
may legitimately exceed the count.

**`expertAvailable` was removed** by `10` C35. `10` D18 takes the renderer off
`/live` entirely, so no wasm module loads on that page and nothing could ever set
the flag false. A prop with no field behind it is what `12` section 9 item 2
exists to catch. The renderer unavailable state lives in `06` section 11, on
`/viewer`.

`cursor` is rendered in Expert only. In Story it stays in the DOM inside
`#live-cursor` because `qa-live.ts` reads it with `textContent()`, which
resolves without a visibility check.

**States**

| State | Rendering |
|---|---|
| No run yet | Scenario id in mono. No run id. Mode switch enabled. |
| Run admitted | Run id in mono, truncated visually to the last 8 characters with the full id in `title` and copyable. |
| ~~Expert unavailable~~ | **Removed by `10` C35.** Unreachable on `/live`: there is no renderer to fail. The equivalent state on `/viewer` is `06` section 11. |
| Error | This component has no error state of its own. A dead API produces `runId: null`, which is the first row. |

**Keyboard** Two buttons, `[data-mode-story]` and `[data-mode-expert]`, each
carrying `aria-current` as the string `"true"` or `"false"`, matching
`StoryPanel.astro:329-330`. Left and Right arrows move between them, Enter and
Space activate, per the tab pattern. **On `/live` activation writes `data-mode`
on `#live-root` and mirrors `?mode=`, and does nothing else** (`10` C24): the
other two parts of section 2.2's signal exist so `CockpitMount` can order its
reveal before its mount, and no renderer is mounted on `/live`. The three part
contract stays as written on `/cockpit` and `/viewer`.

**The bar is not inside `#live-root`** (`10` D46). It sits inside the `.aw`
wrapper, beside `#live-root`, because `12` G1.1 and P7 cap the direct children
of `#live-root` at the three regions. The token scope and the region container
are two elements, and the checks name which one they read.

**Responsive** 1440 and 1280: single row, run identity left, mode switch right.
390: same single row, run id truncated to the last 6 characters, mode switch
becomes two equal width buttons on the row below. Never a hamburger; two buttons
behind a menu is worse than two buttons.

**Truth restrictions**

* May not display `estimatedCostUsd`. It is initialised to 0 and never written.
* May not display elapsed time or a duration. `CanonicalEvent` carries no `ts`
  and the wire's `ts` is a producer clock, not a measured interval.
* May not show a connection or health indicator. The client polls every 400ms
  (`client.ts:22`) and a failed poll is indistinguishable from a slow one at
  that interval, so a green dot would be a guess.
* Before any run, `runId` is genuinely absent. Render nothing in its place, not
  a placeholder id, not `Unknown`. An id that does not exist yet is not an
  unknown value.

### 4.2 ModeTruthBadge

**Mode** Both. Reading order item 1, so it is the first thing rendered in
region A.

```ts
interface ModeTruthBadgeProps {
  state: LiveState;              // LiveView.state
  provenance: Truth;             // LiveView.provenance, 04 section 6
  runStartTruth: Truth | null;   // events.find(e => e.kind === 'run_start')?.truth ?? null
  runDriver: 'worker' | 'mcp';   // GET /runs/capability -> runDriver
}
```

**Corrected. The first draft of this block followed `03` section 2.3 exactly and
two of its four branches were superseded before this pack was finished.** `10` C1
removed the `Unknown` branch and `10` C2 removed the `historical_replay` branch;
`10` D42 supplies the wording. Both supersessions are recorded in `10` section 6,
but this is the block an implementer builds from, so it is corrected here rather
than left to be discovered. The branch that mattered most: built from the old
list, pressing `Replay evidence` after a live run flipped the chip to `Recorded`
and stated that the run had been a recording.

```text
state === 'unavailable'        -> 'Unavailable'
events.length === 0            -> render nothing. No element, not an empty one.
provenance === 'live'          -> 'Source: live'
provenance === 'recorded'      -> 'Source: recorded'
```

`provenance` is `LiveView.provenance`, derived from events alone (`04` section 6,
`10` D5): `some(e => e.truth === 'live')` gives `live`, a non empty event list
with no live event gives `recorded`. It is never read from `capability`, and it
never branches on `state`, so replaying a live run keeps `Source: live`.

Renders into `#live-provenance[data-provenance]` (`04` section 8.3). That handle
is new (`10` D39), so no shipped check reads it and the wording is free.

**States** `Unavailable`, `Source: live`, `Source: recorded`, and absent. The
`Unknown` state is gone: `provenance` still returns `'unknown'` internally for an
empty event list, and this component renders nothing for it.

**Why the label names its axis.** `10` D42. A bare `Live` is item 1 in the
reading order, so on `historical_replay` a reader meets the word `Live` before
the headline `Replaying`. The chip means *produced live*; a reader parses it as
*happening now*. One chip was carrying two meanings on the one screen where being
wrong is expensive, and `03` section 2.3's own argument, "truth is the frame;
everything after it is the picture", is what put it first. Naming the axis is
cheaper than moving it and it keeps the word present under forced colours, which
`12` A11 and void condition 7 require.

**Keyboard** Not focusable. It is a label. If the distinction needs explaining,
the explanation belongs in OutcomeHero's sentence, not in a tooltip that a
keyboard user reaches by tabbing to a non control.

**Responsive** Identical at all three. It is at most two words and must never
wrap or truncate.

**Truth restrictions**

* **May never render `Controlled Fault` at run level.** It is an event level
  label. Promoting it claims the whole run was a fault, which is the inverse of
  what happened: the fault was one deliberate beat inside a successful recovery.
  `03` section 2.3 states this and it is repeated here because this component is
  where the mistake would be made.
* May not derive the label from `capability.workerMode`. Capability describes
  the deployment now; events describe the run then. A deployment that changed
  mode between the run and the read would silently relabel history.
* May not fall back to `Live` when `runStartTruth` is null. Zero events means
  `Unknown`, and `Unknown` is a real answer.
* Colour may accompany the word but may never replace it. The word is always
  present in the accessible name.

### 4.3 OutcomeHero

**Mode** Both, with different weight. In Story it is the largest type on the
page. In Expert it is a single line above the graph, because the reader who
opened Expert has already read it.

```ts
interface OutcomeHeroProps {
  sentence: string;              // LiveView.sentence, produced by deriveLive
  state: LiveState;              // LiveView.state
  provenance: Truth;             // adds one clause in three states, 04 section 6.1
  awaitingLines: readonly string[];  // AWAITING_AGENT_LINES, state.ts:119-122
  startCommand: string | null;   // Expert only; the copyable command, see below
}
```

Renders into `#live-sentence` with `role="status"` and `aria-live="polite"`, as
shipped.

**States**

| `state` | Rendering |
|---|---|
| `unavailable` | The reason sentence. No CTA below it, because there is nothing to press. |
| `ready` | The ready sentence, or the blocked reason when `blockedReason !== null`. |
| `starting` | `Admitting a run against the fixed scenario.` One shot, bound to the POST promise. |
| `awaiting_agent` | The two `AWAITING_AGENT_LINES` verbatim, plus the copyable command. **This is the product's most important screen** (`04` section 3.5): FleetScope genuinely cannot act, and a human is typing in another window. |
| `running`, `controlled_fault`, `warden_authorized`, `recovering` | The derived sentence for that state. |
| `completed`, `failed` | The terminal sentence, plus the provenance clause when `provenance === 'recorded'`. |
| `historical_replay` | The replay sentence. ReplayBanner carries the cost note, not this. |
| Empty | There is no empty state. `deriveLive` is total and always returns a sentence. |
| Error | A failed start renders `#live-start-error` beneath, not inside, the sentence. Overwriting the sentence with an error would lose the state the reader is actually in. |

**Keyboard** The sentence is not focusable. The copy control on the
`awaiting_agent` command is a real `<button>` with an accessible name that names
what it copies, and it announces success through the existing live region rather
than through a toast.

**Responsive** 1440: measure capped at roughly 62 characters so a 20 word
sentence lands in two or three lines. 1280: unchanged; the sentence is the one
element that keeps its size when height is tight, and Progress gives up space
instead. 390: same measure rule, which at this width is the viewport. The
`awaiting_agent` prompt wraps with `overflow-wrap: anywhere` and never scrolls
horizontally. **The reason is the design rule, not the QA check.** `10` C28
found that the shipped assertion at `qa-live.ts:300-303` cannot fail, because
`global.css:70-74` puts `overflow-x: hidden` on the root and the viewport stops
reporting scrollable width. `10` D47 replaces the measurement with a geometric
one; the rule that wide content scrolls inside its own container stands either
way, and it is now checkable.

**Truth restrictions**

* **No motion, in any state, and specifically not in `awaiting_agent`.** Nothing
  is working during that state. A pulse, a shimmer or a progress bar would
  animate the absence of activity, which is the closest this page could come to
  fake typing. `02` section 4 rejects it and `04` section 3.5 gives the reason.
* May not synthesise a sentence. Every string comes from `deriveLive` or from
  the two exported constants, so a state with no copy is a missing case in the
  reducer, not a template default.
* May not restate the terminal result as a separate emphasis. ResultSummary owns
  it (section 3).
* The provenance clause is additive and appended. It may not replace the
  sentence, because the causal account is true on a recorded run too.
* The `awaiting_agent` copy may not promise a timeout or an ETA. There is no
  timeout transition out of that state and `04` section 5 explains why one must
  not be added.

### 4.4 CausalProgress

**Mode** Both. Reading order item 3, region B. In Expert it stays, because it is
the only surface that states which beats did **not** happen.

```ts
interface CausalProgressProps {
  beats: readonly Beat[];        // LiveView.beats, from deriveBeats(events)
  state: LiveState;
}
```

`Beat` is `state.ts:90-98` and is unchanged: `id`, `label`, `status`, `truth`,
`sequence`, `note`. The five ids are `start`, `read`, `fault`, `retry`,
`result`, matched to kinds `run_start`, `tool_call`, `incident`, `intervention`,
`run_end` (`state.ts:124-130`).

**DOM contract, not negotiable.** Each beat is
`[data-beat="<id>"][data-status="<BeatStatus>"]` containing
`.live-beat__status`. `qa-live.ts` reads the attribute for status and the class
for the truth word, and asserts `Controlled Fault` out of the latter at
`qa-live.ts:240`. `04` section 7.4 records that the class name says status and
contains a truth label, and rules that it is fixed by addition rather than by
renaming. Do not rename it.

**States** Per beat: `pending`, `active`, `done`, `failed`, `unknown`. Whole
component: five pending before anything ran, which is the empty state and is
correct rather than degraded. There is no error state; an unreachable API yields
zero events and therefore five pending beats.

**Keyboard** In Story, not focusable. Five chips that do nothing are five wasted
tab stops. In Expert, one tab stop for the list with Left and Right moving a
roving `tabindex`, and Enter seeking the CanonicalTimeline to `beat.sequence`.
A beat with `sequence === null` is not activatable and says so through
`aria-disabled`, because there is no event to seek to.

**Responsive** 1440: five items in one row. 1280: one row still; five short
labels fit and wrapping them costs vertical space that 720 does not have. 390:
a vertical list, one beat per row, label left and status right. Not a horizontal
scroller: a beat scrolled out of view is a beat the reader does not know exists,
and the set of beats that did not happen is the point of the component.

**Truth restrictions**

* A beat is `done` **only** because an event of its kind exists. No beat may be
  marked from a state name, a phase, or the passage of time.
* A finished run whose beat never occurred stays `pending`. Not `skipped`, not
  `failed`, not hidden. `deriveBeats` comments this at `state.ts:141-144` and the
  rendering must not add a fourth interpretation on top.
* No progress percentage, no `3 / 5`, no fraction anywhere. The rejected
  prototype stated progress four times in two incompatible systems (`01`
  section 5). Five labelled beats already are the progress.
* The `fault` beat renders the words `Controlled Fault` when its truth says so,
  and the orange role is reserved for exactly this. A `truth: 'live'` incident
  is a real failure and may not borrow the deliberate colour.
* No beat may show a duration. There is no field for one.

### 4.5 CurrentAgent

**Mode** Both. This is reading order item 6 in its Story form: one line, at most
8 words, **visible from the first canonical event onward** (`10` D40).

```ts
interface CurrentAgentProps {
  agent: string | null;          // LiveView.agent (state.ts:233):
                                 //   lastOf(events,'tool_call')?.agent
                                 //   ?? events.at(-1)?.agent ?? null
  delegation: { observed: boolean; text: string };  // LiveView.delegation
  runDriver: 'worker' | 'mcp';   // capability.runDriver, names which runtime is described
}
```

Renders into `#live-delegation[data-observed]`. `qa-live.ts` asserts both the
substring `Unknown / not observable in this runtime` and
`data-observed === "false"` after a completed live run.

**States**

| Condition | Rendering |
|---|---|
| No events | **Attached, not rendered. Amended by `10` D40 and C26.** The whole line is in the DOM with `#live-delegation` carrying `DELEGATION_UNKNOWN` verbatim and `data-observed="false"`, and it is visually hidden until the first canonical event exists. Stating a non observation about a run that has produced nothing invites the reader to think an observation was attempted and failed, which is `10` C1's argument for the chip applied to the same four states: `unavailable`, `ready`, `starting`, `awaiting_agent`. `12` P6 and H1 read the node with `textContent()` and `getAttribute()`, which resolve hidden nodes, so nothing is lost. |
| MCP run, any stage | Agent is `external_agent` at every stage, **including the two Warden screens**. `mcp_server.py:253` emits the intervention with `agent="warden"`, but the derivation reads the last `tool_call` first and one exists at sequence 2, so `warden` never reaches this line. `10` C26 corrects `05` sections 3.5 and 3.7, which drew `warden` here. Who decided is named in region A's sentence, where the Warden is the grammatical subject; this line names who acted. Delegation stays `DELEGATION_UNKNOWN` forever, because the MCP producer emits no `delegation` event at all. |
| Scripted or ADK run with a `delegation` event | `Delegation: observed at event N`, `data-observed="true"`. |
| Error | None. Absence is a value here, not a failure. |

**Keyboard** Not focusable in Story. In Expert it is the AgentRail's caption and
inherits the rail's single tab stop rather than adding one.

**Responsive** One line at 1440 and 1280. At 390 it wraps to two lines and does
not truncate: `DELEGATION_UNKNOWN` is 7 words and must survive verbatim in both
modes (`01` section 6). An ellipsis on that string would delete the honesty it
exists to carry.

**Truth restrictions**

* **May never fabricate a delegation.** `DELEGATION_UNKNOWN`, the exact string
  `Delegation: Unknown / not observable in this runtime`
  (`state.ts:117`), is rendered character for character. Not paraphrased, not
  shortened, not softened to `No delegation`, which would claim an observation.
* Must not render `Unknown` in the failure treatment. It is an absence of
  observation, not an absence of behaviour, and `deriveBeats` gives it a
  separate `BeatStatus` for precisely that reason (`state.ts:12-16`).
* Where both provenances can appear on one screen, the line names the runtime it
  describes, per `04` section 6.2. A live run showing less than a recorded one on
  this single axis is the live run being truthful, and a reader comparing the two
  side by side will otherwise read it as worse instrumented.
* `agent` is an id from the event stream, not a display name. It may be
  presented in mono and may not be title cased into something that looks like a
  product name.

### 4.6 IncidentExplanation

**Mode** Both. In Story it is plain language inside region A. In Expert it stays
in the DOM but yields the detail to DecisionEvidence.

```ts
interface IncidentExplanationProps {
  reason: string | null;         // LiveView.incidentReason = incident.payload.reason
  truth: Truth | null;           // the incident event's truth
  sideEffectClass: string | null;// incident.payload.sideEffectClass
  retryable: boolean | null;     // incident.payload.retryable
  outcome: string | null;        // intervention.payload.outcome, named only
}
```

Renders into `#live-incident`. `qa-live.ts` asserts its text contains
`Controlled Fault` after a completed run, which the reason string satisfies
because `ControlledFault.describe()` produces it.

**States**

| Condition | Rendering |
|---|---|
| No incident | `Not observed`. **Corrected by `10` C36.** The shipped default is `none` (`live.astro:53`, `client.ts:104`), and section 2.1 of this document defines `None` as "an event exists and its value is genuinely empty". No incident event is the second case, not the first, so `none` here states that the run had no incident when in truth none has been observed yet. `12` H11 fails the shipped value. Verified free: `qa-live.ts:253` asserts `#live-incident` *contains* `Controlled Fault`, which is the populated case only, so no shipped check is edited. |
| `truth === 'controlled_fault'` | The reason, framed as deliberate. Orange role. |
| `truth === 'live'` | The reason, framed as a real upstream failure. **Not** orange. `tools.py:132-136` raises `ToolFailure(truth='live')` on any non 200 upstream, so this branch is reachable in production and must not inherit the scripted framing. |
| `outcome` starts with `refuse_` | The refusal is named here in one clause and explained in DecisionEvidence. |
| Error | None. |

**Keyboard** Not focusable. It is prose.

**Responsive** Measure capped at 1440 and 1280. At 390 it is full width with
`overflow-wrap: anywhere`, because `payload.reason` is a producer string of
unbounded length and may contain a long token.

**Truth restrictions**

* **May not hardcode "failed on purpose".** The shipped `state.ts:322` does
  exactly that for every incident regardless of truth, which is the defect `04`
  section 1.1 exists to fix: a real GitHub outage currently renders as a scripted
  one. The framing branches on `truth`, always.
* The orange role is reserved for `truth === 'controlled_fault'` and nothing
  else, in any component. This is the enforcement point.
* May not render a stack trace, an HTTP body or an upstream response. The
  payload carries a message string and nothing else, and inventing detail around
  it would be inventing evidence.
* May not claim the incident was recovered. That is DecisionEvidence's fact and
  it depends on `permits_retry`, which this component does not read.

### 4.7 ResultSummary

**Mode** Both. Reading order item 4's second half, region A.

```ts
interface ResultSummaryProps {
  result: string | null;         // LiveView.result = run_end.payload.terminalResult
  facts: {                       // tool_result with status 'ok'
    target: string | null;       // payload.target
    defaultBranch: string | null;// payload.defaultBranch
    stars: number | null;        // payload.stars
    archived: boolean | null;    // payload.archived
    license: string | null;      // payload.license, genuinely nullable
  } | null;
  budget: { used: number; limit: number } | null;  // capability.budget
  runDriver: 'worker' | 'mcp';   // decides the budget wording, section 1.5
}
```

Renders into `#live-result` and `#live-budget`. `qa-live.ts` asserts
`#live-result` trims to exactly `succeeded` after a completed run, so the raw
`terminalResult` token must remain in that node. Any prose framing goes around
it, never replacing it.

**States**

| Condition | Rendering |
|---|---|
| No `run_end` | `Not observed`. **Corrected by `10` C36.** The shipped default is `not yet` (`live.astro:55`, `client.ts:106`), which is not one of the four words in section 2.1 at all. Verified free: `qa-live.ts:257` asserts `#live-result` trims to exactly `succeeded`, which is the populated case only. |
| `succeeded` | `succeeded` plus the facts. |
| `failed`, `timed_out`, `stopped` | the token, framed by state, without facts, because a failed run has no `tool_result` with status `ok`. |
| `unknown` | `unknown`, rendered as a real answer. A run whose terminal state was never observed reports that rather than defaulting either way (`record.ts:22-25`). |
| `license === null` | `None`. The repository has no SPDX licence. Not `Unknown`: the field was read and came back empty. |
| Error | None. |

**Keyboard** Not focusable in Story. In Expert the facts are selectable text in
mono so they can be copied into a report.

**Responsive** 1440: result and facts on one row. 1280: same. 390: stacked,
`stars` and `archived` on one line since both are short.

**Truth restrictions**

* **The budget line must not imply the model did not run.** On
  `runDriver === 'mcp'`, `budget.used` is structurally 0 forever, per section
  1.5. Render the count as what it is, model calls FleetScope observed, and
  state in the same line that the model ran in the developer's own CLI outside
  this boundary. `0 / 60 model calls` alone is false by implication and is
  forbidden.
* May not display `estimatedCostUsd`. Always 0, never written.
* May not compute a cost, a token count or a rate. No field supports any of them.
* `stars` is a number from a live upstream and changes between runs. It may not
  be presented as a fixed expected value or compared against one.
* May not render `replay.modelCalls`, `replay.toolCalls` or `replay.wardenActions`
  as a measurement. They are literal zeroes in the handler (`runs.ts:187`), which
  makes them a *statement of the contract*, that a replay spends nothing, and not
  an observation of a particular replay. ReplayBanner states the contract in
  words instead.

### 4.8 AgentRail

**Mode** Expert only.

```ts
interface AgentRailProps {
  agents: readonly {
    id: string;                  // distinct(events.map(e => e.agent)), first appearance order
    firstSequence: number;       // first event with that agent
    lastSequence: number;        // last event with that agent
    role: 'actor' | 'governance';// 'warden' is governance, everything else is actor
  }[];
  selectedAgentId: string | null;
}
```

There is no agent list on the wire. It is derived from `event.agent`, which is
the only place agent identity exists. On the MCP path that yields exactly two
ids, `external_agent` (overridable by `FLEETSCOPE_MCP_AGENT`) and `warden`. On
the scripted path, three: `dependency_onboarding`, `security_review`, `warden`.

**States** Empty when there are no events, and the empty copy says the run has
recorded no agent yet rather than that there are no agents. Two rows on a live
MCP run, which is the normal case and not a degraded one. Selected row carries
`aria-current`.

**Keyboard, on `/live`.** One tab stop. Up and Down move a roving `tabindex`,
Enter selects, Enter on the selected row deselects. Selection is local list
state shared with CanonicalTimeline and EventConsole. There is no renderer on
this route (`10` D18), so there is no `SelectionOutcome` to match and no
selection anywhere else to destroy.

**Keyboard, on `/viewer`.** Same shape, plus the renderer contract: Enter on the
selected row deselects, matching `SelectionOutcome::Deselected`
(`crates/agent-viewer-render/src/selection.rs:33-36`), and an id the renderer
does not carry must not be forwarded, because `Flow::select_node` clears the
selection for an unknown id.

**Dependency, added by `10` C38.** `selection.rs` is untracked in this worktree
and does not exist at `cfdcca7`. The wasm ABI at HEAD exports `load`,
`load_demo`, `summary`, `fingerprint`, `snapshot`, `formats`, `go_live`, `seek`
and `toggle_play`, and nothing else, so `agent_viewer_select_agent`,
`agent_viewer_agents`, `agent_viewer_graph_nodes`, `agent_viewer_item_at` and
`agent_viewer_seek_sequence` are all in flight too. `crates/**` cannot be edited
under `11`'s file scope. The `/viewer` half of this contract is therefore blocked
on that work landing; the `/live` half depends on none of it.

**Responsive** 1440: left column, roughly 220px. 1280: same column, fewer rows
visible, scrolls within itself rather than growing the page. 390: becomes the
first panel of the Expert tab set. It must not be rendered into a zero width
column, per section 2.2.

**Truth restrictions**

* **May not duplicate CausalProgress.** No status dot, no beat status, no
  progress. The rail carries what the graph cannot: the id as copyable text, the
  first and last sequence, and keyboard reach. This division is the fix for the
  review's fourth complaint and `01` section 5 measured the failure.
* `warden` is FleetScope's policy, not a model agent. It carries the violet role
  and may not be counted in an agent total presented as "agents the model ran".
* May not infer a parent or child relation from ordering. Hierarchy comes from a
  `delegation` event or it does not exist.
* May not render an avatar, a colour per agent, or a generated identity. `02`
  section 4 rejects pastel agent cards, and an identity generated from a hash is
  decoration that reads as data.

### 4.9 AgentNode

**Mode** Expert only. One node in the Zoetrope graph.

```ts
interface AgentNodeProps {
  agentId: string;               // event.agent
  rendererId: string;            // 'main' for the root, else agentId; see below
  role: 'actor' | 'governance';
  selected: boolean;
  lastSequence: number;          // last event carrying this agent
}
```

**The two names problem.** The renderer names its root node `main` regardless of
what the session calls its orchestrator, and only the node's title is rebranded
(`selection.rs:22-27`). Every other id in the system is a session agent id. The
translation happens in Rust so the shell never learns the renderer has a private
vocabulary, which means `agentId` and `rendererId` are separate props and the
web layer must not assume they are equal.

**States** `idle`, `acted`, `selected`, and `governance`. Not a lifecycle:
`agent_start` and `agent_end` are emitted only by the scripted and ADK
producers, so on the MCP path a node has no lifecycle to show and must not
invent one.

**Keyboard** Not individually focusable. The canvas is one tab stop and
selection is driven from AgentRail, so that keyboard selection and pointer
selection resolve to the same single answer inside the renderer.

**Responsive** The node is drawn by the renderer and does not reflow. What
changes across viewports is whether the canvas is mounted at all, per section
2.2.

**Truth restrictions**

* **May not draw a node for an agent that has no event.** A single node graph on
  a live MCP run is correct output. It looks broken and it is not, and the fix a
  developer reaches for first, drawing the sub agent that "should" be there, is
  the exact prohibited invention.
* May not fill green on success. `01` section 10 records green filled nodes as
  rejected, and the reason is that fill reads as a value and success is not this
  node's property.
* Yellow is not a selection colour. Blue is selection, everywhere.
* May not show a count of tool calls when the node's agent emitted none.

### 4.10 RuntimeEdge

**Mode** Expert only.

```ts
interface RuntimeEdgeProps {
  kind: 'delegation' | 'tool_boundary';
  from: string;                  // delegation: event.agent
  to: string;                    // delegation: payload.to, ADK and scripted only
  sequence: number;
  observed: boolean;
}
```

**The only edge the events support is delegation.** `event.agent` is the source
and `payload.to` is the destination. The MCP producer emits no `delegation`
event, ever, so a live MCP run has **zero** edges. That is the honest render.

A `tool_boundary` edge, from an acting agent to the governed tool, may be drawn
because `tool_call` genuinely records that relation, but it is a different kind
with a different treatment and it may never be labelled or styled as delegation.

**States** Zero edges, which is the MCP normal case. One delegation edge on
scripted and ADK runs. Tool boundary edges wherever `tool_call` events exist.
No error state; an edge either has an event or does not exist.

**Keyboard** Not focusable. An edge is a relation, not a control.

**Responsive** Drawn by the renderer. See section 2.2 for the mount rule.

**Truth restrictions**

* **May not synthesise an edge.** Not from agent name ordering, not from
  `scenario.rootAgent` and `scenario.delegatedAgent` in the capability response,
  not from first appearance order. The capability endpoint names both agents
  before anything runs, which makes this the single most tempting invention on
  the page, and taking it would render a delegation that never happened.
* On zero edges the graph renders the nodes and says, in the surrounding chrome,
  that no delegation was observed in this runtime. It does not draw a dashed
  "expected" edge, a ghost, or a placeholder.
* The ADK producer's `delegation` payload carries `branch`, not `reason`
  (`adk_runtime.py:257-263`). A component reading `payload.reason` gets
  `undefined` there and must render nothing rather than a fallback string.
* May not animate flow along an edge. There is no timing data and the client
  repaints roughly 2.5 times a second, so any render keyed motion refires at that
  rate (`client.ts:22`, `client.ts:204`).

### 4.11 EventConsole

**Mode** Expert only. Docked, never floating: `01` section 2 measured the
rejected console as `position: absolute` occluding 41 percent of the stage.

```ts
interface EventConsoleProps {
  events: readonly CanonicalEvent[];  // GET /runs/:runId/events -> events
  cursor: number;                     // highWaterMark
  follow: boolean;                    // whether new events scroll into view
}
```

**States** Empty before any event, with copy that says the run has produced no
events yet rather than that the console failed. Populated. Following versus
pinned, and pinning must survive a poll, which at 400ms means the scroll
position cannot be recomputed on every render. Error: when the events request
fails the console keeps the last events it had and says the last read failed,
because clearing to empty would claim the run lost its history.

**Keyboard** One tab stop. Up and Down move a roving `tabindex` by row, Home and
End jump, Enter selects the row and seeks CanonicalTimeline to that sequence.
Selecting a row must not steal focus into the graph.

**Responsive** 1440: bottom dock, roughly 8 rows. 1280: roughly 5 rows, since
height is the binding constraint. 390: a tab in the Expert tab set, full height,
one row per event with the payload wrapped rather than truncated.

**Truth restrictions**

* **Exactly as many rows as there are events.** The rejected prototype showed 13
  rows for a run that produces 8, with sequences 0005 through 0009 that cannot
  exist in an 8 event run (`01` section 8). One row per event, sequence rendered
  from `event.sequence` and never renumbered.
* May not render a latency, a delta or an elapsed column. `01` section 8 found
  `+124ms`, `+2ms` and `+8ms` in the rejected prototype against a type with no
  latency field. `CanonicalEvent` still has none.
* May not present a redacted payload as complete. The ADK producer redacts tool
  arguments to an allowlist of `target` (`capture.py:105-110`), so the console
  says the payload is redacted rather than showing a short object as if it were
  the whole one.
* May not render model output or a prompt. Neither exists in the ledger, and
  FleetScope holds no model credential.
* No fake typing, no character by character reveal, no cursor blink on content
  that arrived in one poll. The MCP producer publishes all eight events in a
  single POST (`mcp_server.py:336`), so they genuinely arrive together and
  animating them as a stream would dramatise a transaction.

### 4.12 DecisionEvidence

**Mode** Expert only. This is the Warden's record, and it is the best governance
evidence the system produces.

```ts
interface DecisionEvidenceProps {
  outcome: string | null;        // intervention.payload.outcome
  rationale: string | null;      // intervention.payload.rationale (LiveView.policyRationale)
  idempotencyKey: string | null; // intervention.payload.idempotencyKey
  retriesUsed: number | null;    // intervention.payload.retriesUsed
  maxRetries: number | null;     // intervention.payload.maxRetries
  sequence: number | null;       // the intervention event's sequence
  retrySequence: number | null;  // the first tool_call with sequence > intervention.sequence
}
```

Renders `rationale` into `#live-policy`. `qa-live.ts` asserts that node is
non empty and not the literal `none` after a completed run.

**The four outcomes are not one outcome.** `recovery.py:25-26` defines
`retry_once`, `refuse_not_idempotent`, `refuse_budget_exhausted` and
`refuse_not_retryable`, and `mcp_server.py:250-264` emits the intervention
**before** checking `permits_retry`. Three of the four are refusals. Each gets
its own rendering.

| `outcome` | Rendering |
|---|---|
| `retry_once` | Authorised. Shows the key, `retriesUsed` of `maxRetries`, and whether a retry `tool_call` followed. |
| `refuse_not_idempotent` | Refused because the operation could change state. This is the strongest governance evidence the system emits and it is rendered as a decision, never as an error. |
| `refuse_budget_exhausted` | Refused because the retry allowance was spent. |
| `refuse_not_retryable` | Refused because the tool reported a permanent failure. |
| null | `Not observed`. **Corrected by `10` C36.** The shipped `#live-policy` default is `none` (`live.astro:54`, `client.ts:105`), which states that the Warden made no decision rather than that no decision has been observed. Verified free: `qa-live.ts:248-250` asserts the node is non empty and not the literal `none`, and `Not observed` satisfies both. The heading is still rendered rather than omitted, because an omitted heading looks like a rendering gap. |

**Keyboard** Not focusable except the copy control on `idempotencyKey`, which is
the one value a reader would paste into an audit.

**Responsive** 1440 and 1280: a labelled block beside the console. 390: its own
tab. `idempotencyKey` wraps with `overflow-wrap: anywhere`; it contains no
spaces and would otherwise force horizontal overflow.

**Truth restrictions**

* **A refusal may never be painted in the success role.** Three of four outcomes
  are refusals and the shipped derivation treats every intervention as an
  authorised retry (`state.ts:308`), which is the defect `04` section 1.2 exists
  to fix. Green, or any success treatment, on `refuse_not_idempotent` inverts the
  meaning of the best evidence on the page.
* **`warden_authorized` is not `recovering`.** The intervention says the decision
  was made. The retry `tool_call` at a higher sequence says it was carried out.
  This component may state the second only when `retrySequence !== null`.
* May not display a retry that has not happened. `retriesUsed` counts retries
  already used at decision time, so on the first intervention it is 0 and that 0
  is correct, not a missing value.
* May not colour the key, the labels or the code text blue. Blue is selection and
  the CTA. `01` section 6 records the rejected prototype spending the selection
  hue on inspector code keys.
* May not label an unarrived value as a success. `01` section 6 records
  `result awaiting runtime` rendered in the success colour, claiming an outcome
  for a value that had not arrived.

### 4.13 CanonicalTimeline

**Mode** Expert only.

```ts
interface CanonicalTimelineProps {
  events: readonly CanonicalEvent[];
  selectedSequence: number | null;
  highWaterMark: number;
}
```

**States** Empty before any event. Populated. Selected row. No error state of its
own: the console owns the failed read message so the two do not both report it.

**Keyboard** One tab stop, roving `tabindex` by row, Home and End, Enter to
select. Selection is shared state with EventConsole and AgentRail, so all three
resolve to one selected sequence.

**Responsive** 1440: sequence, kind, agent, truth. 1280: same four columns; they
are all short. 390: two lines per row, sequence and kind on the first, agent and
truth on the second. It scrolls vertically and never horizontally.

**Truth restrictions**

* Sequence is rendered from `event.sequence` and is never re indexed, never zero
  padded into a different number, and never renumbered for display.
* **No timestamp column unless `CanonicalEvent` is widened.** The wire carries
  `ts` (`event.ts:39`) and the web interface does not (`state.ts:42-48`).
  Rendering a time today means inventing one.
* No duration, no gap, no delta. Same reason as section 4.11.
* **On `/live` there is no renderer and no manifest.** `10` D18 removes the
  canvas from that route, so this component reads `events` and nothing else, and
  the two rules below do not apply to it. The row count is `events.length`
  (C34), never `highWaterMark`.
* **On `/viewer` only**, and gated: the renderer's timeline and this list are
  **not** the same list. Folding the bundled fixture produces 23 renderer items
  from 20 viewer events, because `SubagentMeta` sidecars correspond to no viewer
  event at all (`crates/agent-viewer-render/src/manifest.rs:5-12`). Any
  arithmetic bridge between the two indexes is wrong, and a scrubber fraction is
  wrong for the same reason plus rounding. Use the recorded manifest mapping; do
  not compute it. A `SubagentMeta` position maps to `sequence: None`, and that
  None is a real answer: render "no event here" rather than the nearest one.
* **Dependency, added by `10` C38.** `manifest.rs` is untracked in this worktree
  (`git status` shows `?? crates/agent-viewer-render/src/manifest.rs`) and does
  not exist at `cfdcca7`, the baseline this pack was read against. `crates/**` is
  on `11`'s forbidden edit list, so if that in-flight work is reverted this rule
  has no manifest to read and cannot be satisfied within scope. The `/viewer`
  half is blocked on that work landing; the `/live` half is not.

### 4.14 ReplayBanner

**Mode** Both. It appears only in `historical_replay`, in either mode.

```ts
interface ReplayBannerProps {
  runId: string;                 // run.runId
  provenance: Truth;             // changes one clause, 04 section 6.1
  note: string;                  // REPLAY_NOTE, state.ts:124
}
```

Renders into `#live-replay-note`, which `qa-live.ts` asserts contains
`zero model, tool and Warden calls`, and hosts `#live-replay-back` from `04`
section 8.3.

**States** Hidden in every state except `historical_replay`. Visible with the
note and the back control. When `provenance === 'recorded'` the copy becomes
`This transcript was scripted. No model ran, then or now.` per `04` section 6.1,
because re reading a scripted run is a different claim from re reading a live
one.

**Keyboard** `#live-replay-back` is a real button in the focus order at position
6. Escape while focus is inside the banner also returns to the result, since the
banner is the only modal like state on the page.

**Responsive** Full width strip at all three viewports. At 390 the back control
is full width beneath the note rather than inline.

**Truth restrictions**

* **The banner must offer a way out.** `client.ts:239` sets
  `session.replaying = true` and nothing ever clears it, and `deriveLive` returns
  `canStart: false` on that branch (`state.ts:271-280`), so a reader who presses
  Replay evidence loses the start button until they reload. `04` section 7.1
  specifies the fix and this component owns it.
* The cost claim is a contract, not a measurement. `replay` is three literal
  zeroes written by the handler (`runs.ts:187`). State it in words, as
  `REPLAY_NOTE` already does, and do not render the three zeroes as though they
  were counted for this replay.
* May not present a replay as live. **Amended by `10` C2 and D42:** the badge
  does **not** read `Recorded` merely because the state is `historical_replay`.
  It reads the provenance of the record being replayed, so a replayed live run
  keeps `Source: live` and a scripted transcript reads `Source: recorded`.
  Relabelling a live run's record as a recording would falsify history, which is
  what `03` section 2.3's state based rule did. The banner carries the
  distinction in words, `Re-reading the record of a run that happened.` against
  `This transcript was scripted. No model ran, then or now.`, and may not
  contradict the chip.
* May not re admit, re fetch beyond a read, or offer a control that writes.
  Replay is `GET /runs/:runId/events` and nothing else.

## 5. Coverage

| Component | Mode | Owns | New DOM |
|---|---|---|---|
| RunCommandBar | both | run identity, mode, cursor | `[data-mode-story]`, `[data-mode-expert]` |
| ModeTruthBadge | both | run-level truth | `#live-provenance[data-provenance]` |
| OutcomeHero | both | the sentence | `#live-start-error` |
| CausalProgress | both | beat status and beat truth | none, existing contract |
| CurrentAgent | both | delegation observability | none, existing contract |
| IncidentExplanation | both | incident in plain language | none |
| ResultSummary | both | terminal result, budget | none |
| AgentRail | expert | agent identity, sequences | new |
| AgentNode | expert | node topology | renderer |
| RuntimeEdge | expert | observed relations | renderer |
| EventConsole | expert | raw payloads | new |
| DecisionEvidence | expert | Warden outcome | none, uses `#live-policy` |
| CanonicalTimeline | expert | canonical sequence | new |
| ReplayBanner | both | replay cost and exit | `#live-replay-back` |

Every existing DOM handle survives: `#live-root[data-state]`, `#live-start` with
its exact text `Run live recovery demo`, `#live-delegation[data-observed]`,
`#live-awaiting`, `[data-beat][data-status]`, `.live-beat__status`,
`#live-policy`, `#live-incident`, `#live-result`, `#live-cursor`,
`#live-budget`, `#live-replay`, `#live-replay-note`. Four handles are added, all
listed in `04` section 8.3. No handle is renamed, so the 58 browser checks need
no edit to keep passing.

## 6. Type changes this document requires

Additive, in `apps/web/src/features/live/state.ts`:

1. `Capability` gains optional `workerMode` and `scenarios` (section 1.1).
2. `RunSnapshot` gains optional `scenarioId`, `interventionCount`,
   `correlationId` and `idempotencyKey` (section 1.2). Not `estimatedCostUsd`.
3. `CanonicalEvent` gains optional `ts` **only if** a timeline column is built
   (section 4.13). If it is not built, do not widen it.
4. `LiveView` gains `provenance: Truth` and `startFailure: string | null`, both
   already specified in `04` section 8.1.

Every addition is optional, because a browser talking to an older API build must
render a missing field as absent rather than fail to parse the response.

## 7. What this document does not decide

* Colour values. Hue *roles* are constrained where honesty depends on them, in
  sections 4.2, 4.6, 4.9 and 4.12. The values are a later phase.
* Spacing, type sizes and the file layout of the components.
* Whether Expert Mode is a route or a mode of `/live`. Section 2.2 constrains
  either choice identically, because the constraint is the reveal ordering rather
  than the URL.
* Whether the six field `live__facts` list moves to Expert or shrinks in place.
  Sections 4.5 and 4.7 assign every one of its fields to an owner, which is what
  the layout phase needs; where the DOM node sits is a layout decision, bounded
  by the rule that the nodes stay attached.

## Links

* `00-current-state-audit.md`, what ships today
* `01-prototype-autopsy.md`, what the rejected artifact did and why
* `02-reference-matrix.md`, the budgets
* `03-information-hierarchy.md`, reading order and word budget
* `04-state-model.md`, the twelve states, provenance, and the DOM contract
