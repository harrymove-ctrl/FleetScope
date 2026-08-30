# Coding handoff

A paste ready brief for the agent that implements this pack. Everything below
the line is written to be handed over whole.

Before pasting, check two things. First, that `docs/design/agent-workspace/` is
present in the working tree, because the brief tells the agent to read it.
Second, that the worktree's in-flight work has landed or been reverted, because
phase 7 touches `apps/web/src/pages/viewer.astro`, which another agent has open.

---

## The brief

You are implementing the FleetScope agent workspace redesign. The design is
already decided. Your job is to build it exactly, in the order given, without
redesigning it along the way.

### Read this first, in this order

1. `docs/design/agent-workspace/10-design-decisions.md`. This is normative. It
   overrides every other document in that directory. Section 3 lists forty
   contradictions between the earlier documents and how each was resolved; if you
   find a lane document saying something section 3 contradicts, section 3 wins.
   Read section 2.9 too: twelve decisions added after an adversarial review, D40 to
   D51, and several of them change what you build rather than only how it is
   checked.
2. `docs/design/agent-workspace/12-acceptance-gate.md`. This is what you will be
   judged on. Read it before you write code, not after.
3. `docs/design/agent-workspace/README.md` for the map, then the lane documents
   as each phase needs them. `04` and `05` for phases 1 to 5, `06` and `09` for
   phase 6, `07` for all copy, `08` for all CSS.

Then read the code you are changing: `apps/web/src/features/live/state.ts`,
`apps/web/src/features/live/client.ts`, `apps/web/src/pages/live.astro`, and
`scripts/qa-live.ts`. All four are short and all four are load bearing.

### Do not start by rewriting `global.css`

This is the single most likely way to waste the first day and break three other
routes.

`apps/web/src/styles/global.css` is 1888 lines at HEAD and 2232 in the dirty
worktree, is imported by
`BaseLayout.astro`, and is therefore loaded by every route. `scripts/browser-qa.ts`
asserts `.fs-shell` visibility on eight routes at every viewport, counts exactly
four `.story__card[data-state="evidenced"]` and exactly six
`[data-path-step][data-state="reached"]`, and asserts
`[data-agent-rail] .fs-agent-identity` exists. A token change in that file is a
change to all of them at once.

You do not need to touch it. The reason is in `08` section 0: of everything this
design needs, fourteen values already exist under an `--fs-` name and only
thirteen are missing. The missing thirteen go in a new file,
`apps/web/src/styles/workspace.css`, scoped to `.aw` and imported by the
workspace route only.

Two rules for that file, both greppable, both non negotiable:

* it contains no `:root`, no `html` and no `body` selector, and no bare element
  selector; every rule begins with `.aw`. **`.aw` goes on a wrapper element that
  contains both the command bar and `#live-root`, not on `#live-root` itself**
  (`10` D46): `12` G1.1 and P7 count the direct children of `#live-root` and cap
  them at the three regions, so the command bar cannot live inside it, and if the
  token scope were `#live-root` the mode switch could not resolve a single
  workspace token;
* no line matches `^\s*--fs-[a-z0-9-]*\s*:`. The workspace may read any `--fs-`
  token and may never write one. A shared component rendered inside the subtree
  resolves `--fs-accent` at its own call site, so a local redefinition would
  silently change its colour inside the workspace with no selector in either file
  showing why.

If you believe a token must change globally, stop and say so instead of doing it.

### File scope

**You may create or edit these, and nothing else.**

```
apps/web/src/features/live/state.ts
apps/web/src/features/live/client.ts
apps/web/src/pages/live.astro
apps/web/src/styles/workspace.css                    (new)
apps/web/src/features/workspace/**                   (new: Expert Mode modules)
apps/web/src/components/Nav.astro                    (one line, phase 2)
apps/web/tests/live-state.test.ts
apps/web/tests/workspace-*.test.ts                   (new)
scripts/qa-live.ts                                   (additions only, see below)
docs/design/agent-workspace/10-design-decisions.md   (to record a deviation)
```

**Gated. Ask before touching.**

```
apps/web/src/pages/viewer.astro        phase 7 only, and only after confirming
                                       the in-flight work there has landed
apps/adk-worker/src/fleetscope_worker/mcp_server.py:359
                                       one word, `authorised` to `authorized`
```

**Forbidden. Do not edit, for any reason, without a new instruction.**

```
apps/web/src/styles/global.css
apps/web/src/layouts/BaseLayout.astro
apps/web/src/components/StoryPanel.astro
apps/web/src/components/AgentIdentity.astro
apps/web/src/components/TerminalWindow.astro
apps/web/src/features/cockpit/**
apps/web/src/features/story/**
apps/web/src/features/viewer/**
apps/web/src/pages/dashboard.astro, index.astro, cockpit/**, cases/**,
  audit/**, catalog.astro, approvals.astro
apps/api/**
packages/**
crates/**
scripts/browser-qa.ts
```

`AgentIdentity` and `TerminalWindow` are in-flight work by another agent and are
asserted by `browser-qa.ts` and by `apps/web/tests/agent-identity.test.ts`.
`global.css:107-433` in the dirty worktree currently contains a block headed
"Workstation synthesis"
that introduces a cream panel, macOS traffic light dots, six pastel agent avatars
and a staggered entrance animation. Those are five of the six items on this
project's never list. **Do not delete them and do not extend them.** They belong
to another change and removing them fails browser checks you are not allowed to
edit. Your work is scoped to `.aw` and cannot see them.

**`scripts/qa-live.ts`: additions only.** It has **25** `check(` call sites plus
the `check` function declaration at `qa-live.ts:39`, which a bare
`grep -c 'check('` counts as a twenty sixth. 24 of the 25 sit outside the five
iteration loop at `qa-live.ts:237`, so 24 + 5 gives 29 per viewport and 58 across
two. `12` T1 and T5 ask you to diff against the call site count, so count 25. You may add
checks. You may not edit or delete one. If you believe a check is wrong, stop and
say so. In particular, `qa-live.ts:240-245` asserts that
`[data-beat="fault"] .live-beat__status` trims to exactly `Controlled Fault`, and
that is deliberate: see `10` section 3, C4.

### The five facts the whole design rests on

Do not design around any of these. They are the product.

1. FleetScope holds no model credential. The model runs in the developer's own
   Gemini or Antigravity CLI. The middle of the live demo is a screen that waits
   for a human to type in another window, and it must look exactly that patient.
2. Delegation is not observable on the MCP path, because Gemini CLI has no sub
   agents. The string `Delegation: Unknown / not observable in this runtime`
   renders character for character in both modes.
3. The real transcript is eight events and `mcp_server.py:336` publishes all of
   them in one POST. On the live path the reader goes `awaiting_agent` to
   `completed` in a single 400ms poll and never sees the middle. `completed` has
   to work for someone who watched nothing happen.
4. Nothing is narrated. `deriveLive` is a pure function of capability, run and
   events. There is no `setState('running')` anywhere and there must not be. A
   beat is `done` only because an event of that kind exists.
5. The client polls every 400ms and refetches from cursor 0 on every tick, then
   repaints unconditionally. Anything keyed to a render fires 2.5 times a second,
   forever.

### Phase order

Ten phases. Each one ends in a state where the suite passes. Do not start a phase
before the previous one is green.

---

#### Phase 1. The state adapter

Pure TypeScript. No markup, no CSS. `apps/web/src/features/live/state.ts` and
`apps/web/tests/live-state.test.ts` only.

1. Extend `LiveState` with `controlled_fault` and `warden_authorized`. Twelve
   values total. Do not rename any of the ten that exist.
2. Replace steps 6 and 7 of `deriveLive`'s decision order with the order in `04`
   section 8.2: intervention first, routed by `payload.outcome === 'retry_once'`
   and by whether a later `tool_call` exists; then incident, routed by
   `truth === 'controlled_fault'`. Steps 1 to 5 and the final fallthrough are
   unchanged. The function stays pure and stays total: a refusing intervention
   falls through to the incident branch and holds the reader on the fault screen.
3. Add `readonly provenance: Truth` to `LiveView`, derived from events only:
   empty gives `unknown`, `some(e => e.truth === 'live')` gives `live`, otherwise
   `recorded`. Do not read `capability.workerMode`.
4. Add `readonly startFailure: string | null` to `LiveView`.
5. Add `refused` to `BeatStatus`. Give `BEAT_DEFINITIONS` entries a predicate over
   the matched event, not only a list of kinds, and mark the `retry` beat
   `refused` when the intervention's `payload.outcome` starts with `refuse_`.
6. Widen `Capability` with optional `workerMode` and `scenarios`. Widen
   `RunSnapshot` with optional `scenarioId`, `interventionCount`, `correlationId`
   and `idempotencyKey`. Do not add `estimatedCostUsd`: it is initialised to 0 and
   never written. Do not add `ts` to `CanonicalEvent` unless phase 6 builds a
   timestamp column, and it should not.
7. Change the sentences. `state.ts:313` spells `authorized` with a z.
   `state.ts:285` drops the word `authoritative`, spells `authorized` with a z,
   **and becomes two sentences chosen by which events exist** (`10` D43). Render
   `The governed read failed once by design, the Warden authorized one idempotent
   retry, and the retry returned the result.` only when an `incident` event
   exists, the latest `intervention` carries `payload.outcome === 'retry_once'`,
   and a `tool_call` follows it at a higher sequence. Otherwise render
   `The governed read returned on its first attempt. No fault occurred and the
   Warden was not called.`

   This is not defensive coding. `completed`'s entry condition is
   `finished && terminalResult === 'succeeded'` and requires neither event, and
   the four event path is reachable: `tools.py:119` reserves the attempt before
   the request, `mcp_server.py:335-339` swallows a publish failure so the agent
   still gets an answer, and with `FLEETSCOPE_ATTEMPT_LEDGER` set to a
   `FileAttemptStore` the second call sees `applies_to(2) === false` because
   `fault_attempts=1`. On that run `deriveBeats` already marks the fault and
   retry beats `pending`, so the unconditional sentence makes the page contradict
   itself.
8. **Story copy is plain language** (`10` D45). Five strings changed in `07`:
   `ready`'s outcome, `starting`'s headline and outcome, the `warden_authorized`
   rationale line, the three `failed` refusal sentences, and `recovering`'s
   outcome. The rule behind them: a raw producer string renders verbatim in
   Expert Decision Evidence, and Story renders a sentence that says what it
   means. `#live-policy` keeps its raw value, which is what `qa-live.ts:248-250`
   reads, so this costs no check.

Two existing test expectations change and both are corrections, because they
currently encode the two bugs as expected behaviour:
`live-state.test.ts:123-128` now expects `controlled_fault`, and `:130-134` now
expects `warden_authorized`. Add **five** tests: a `truth: 'live'` incident still
gives `incident`; a six event slice ending at the retry `tool_call` gives
`recovering`; an intervention with `outcome: 'refuse_not_idempotent'` and no
`run_end` leaves the state at `controlled_fault` and marks the retry beat
`refused`; `provenance` is `recorded` for an all recorded transcript whose
incident carries `truth: 'controlled_fault'`; and **a four event transcript of
`run_start, tool_call, tool_result[ok], run_end[succeeded]` gives `completed`
with a sentence naming neither a fault nor the Warden**.

Three of those five are also the only coverage the refusal, the live incident and
the recorded transcript get, because `12` section 2a records that none of the
three is reachable from a browser inside this scope. Write them carefully.

`live-state.test.ts:227-235` asserts `TRUTH_LABEL` by exact equality and must not
change. `scripts/qa-live.ts` waits on `ready`, `awaiting_agent`, `completed` and
`historical_replay` by string, all four of which keep their names, so it needs no
change to keep passing.

**Done when:** `pnpm test` passes, `pnpm qa:live` still reports 58 of 58, and no
markup has been touched.

---

#### Phase 2. Story Mode

`live.astro`, `client.ts`, `workspace.css`, `Nav.astro`.

Start with the six `var()` corrections at `live.astro:88, 89, 94, 109, 129, 133`.
They reference `--border`, `--surface-raised` and `--accent`, none of which
exists, so all six resolve to hardcoded fallbacks that differ from the real
values. Until they are fixed the page cannot inherit anything you write.

Then build the chassis from `05` section 2. Three regions separated by vertical
space and nothing else:

* **A, Verdict:** the provenance chip, the headline at 36px, the current sentence
  at 21px capped at `--aw-measure-sentence: 46ch`, and the incident or result line
  at 15px when the sentence does not already carry it. On `awaiting_agent` region
  A also holds the copyable prompt and the dead end note (`10` C27): the prompt is
  the instruction the sentence promises and the note is a statement about the run,
  and neither is something the reader can do.
* **B, Progress:** the five step causal path, then the topology line.
* **C, Action:** at most two controls, **and nothing else**. `03` section 3.1
  defines region C as the only thing the reader can do; if a fourth item wants to
  live there, it belongs in A or B or in Expert Mode.

**Nothing states anything about a run before that run's first canonical event**
(`10` D40). On `unavailable`, `ready`, `starting` and `awaiting_agent`: no
provenance chip, no topology line, no cyan anywhere, one hue at most. Both the
chip host and `#live-delegation` stay attached and visually hidden, because
Playwright's `textContent()` and `getAttribute()` resolve hidden nodes and `12`
P6 and H1 depend on that.

The provenance chip reads `Source: live` or `Source: recorded`, never the bare
word (`10` D42). On `ready` variant A the headline renders at 21px so the filled
CTA is the only focal object (`10` D41); every other state, variant B included,
puts the headline at 36px.

Non negotiable properties of the chassis:

* the headline is the only element at the top type step, one per screen, except
  on `ready` variant A where nothing sits at that step (`10` D41);
* region A precedes region C in the DOM and on screen, which reverses the shipped
  order at `live.astro:26` and `:37`;
* the regions carry no border, no background and no rule between them;
* the primary action is the only filled element on the page.

Screens to build, from `05` section 3: `ready` including the blocked variant,
`awaiting_agent`, `running`, `controlled_fault`, the `incident` copy variant,
`warden_authorized`, `recovering`, `completed`, `failed`, the recorded fallback
in both branches, and `historical_replay`. Copy comes from `07` section 3 as
amended by `10` section 3. Do not write a sentence that is not in one of those
two places.

The causal path renders labels and shape markers only, per `10` D14: `●` reached,
`○` not reached, `◇` decided but not performed, `◉` the replay playhead. No per
beat truth chip. Orange applies **only to the element whose text is the words
`Controlled Fault`**, and only when the incident's truth is `controlled_fault`;
the marker glyph takes the neutral ink, because an `aria-hidden` glyph has an
empty accessible name and would fail `12` V3 (`10` C31).

**Exactly which span holds which word**, because "each with a visually hidden
status word" is one bullet short of buildable and `10` C4 is the reason it
matters:

* `.live-beat__status` **keeps the shipped truth word** (`Live`, `Recorded`,
  `Controlled Fault`) and becomes visually hidden. Do not rename it and do not
  change its contents: `qa-live.ts:240-245` asserts that
  `[data-beat="fault"] .live-beat__status` trims to exactly `Controlled Fault`,
  and that is the only external check on the most important word on the page.
  The element's name is wrong and it stays wrong.
* A **second visually hidden span** carries the status word: `done`, `pending`,
  `active`, `refused`, `unknown`. This is what makes `12` A3's announcement
  correct, "a done beat announces `done`, not only `Live`".
* `data-status` stays the machine readable status it already is.
* Only the label and the marker glyph are visible.

Move the six field `dl` out of the viewport and leave every id attached.
Playwright's `textContent()` and `getAttribute()` resolve a selector and read the
node with no visibility check, so this costs zero QA edits. Only `#live-start`
and `#live-replay` must be visible, because only `click()` requires visibility.

Add `/live` to `Nav.astro`'s link list. One line.

**Done when:** `pnpm qa:live` reports 58 of 58; the story body contains exactly
one enabled control in `ready`, zero in `running`, and two in `completed`; and
the six fact ids are attached and not rendered.

---

#### Phase 3. Error, loading and unavailable states

The states a demo actually fails in, built before the ones it succeeds in are
polished.

1. **`live.astro:25` ships `data-state="unavailable"`**, not `ready`. The current
   value contradicts the file's own header comment and lets `qa-live.ts:185-189`
   pass off a static attribute.
2. **`unavailable`** renders region A alone. Four distinct reason sentences from
   `07` section 3.1, chosen by cause, never summarised into a generic message. No
   CTA: a retry button beside a poller that already retries every 400ms is
   theatre.
3. **A failed start shows why.** `client.ts:229` writes
   `session.unavailableReason`, which `state.ts:209` reads only on the
   `capability === null` branch, so today a failed start is silent. Carry it on
   `startFailure` and render it in a new `#live-start-error` beneath the sentence,
   never inside it. `admission.ts:19-30` enumerates the rejection reasons and
   `run_already_active` is the one a reader will actually hit.
4. **`ready` variant B** keeps the CTA present and disabled beside the reason, so
   a reader looking for the button finds it rather than wondering where it went.
   The blocked string goes in `#live-sentence`; `#live-blocked` stays in the DOM,
   empty and hidden, and loses its `role="status"`.
5. **No hopeful defaults anywhere.** Nothing claims a state before the API has
   answered.

**Done when:** killing the API mid run leaves the page in `unavailable` with a
specific reason, and restoring it recomputes the state from scratch rather than
resuming a remembered one.

---

#### Phase 4. MCP event polling

The transport does not change. What changes is what the page is allowed to do
with it.

1. **Compare the previous state before writing `data-state`.** The client
   repaints unconditionally every 400ms, so this gate is what makes any future
   state keyed behaviour possible. Story Mode has no motion to gate, and the gate
   still goes in, because the alternative is that the first person to add one
   discovers the problem in production.
2. **Story Mode renders no motion at all.** Not on entering `completed`, not on
   `starting`. `starting` shows the CTA disabled with its label unchanged and the
   sentence in the live region. This supersedes `04` sections 3.3, 3.10 and 3.11.
3. **`#live-beats` must never be a live region.** `client.ts:63` clears it with
   `innerHTML = ''` and rebuilds all five items on every tick. A live region there
   announces five beats 2.5 times a second forever.
4. **`#live-sentence` is the one live region**, and it gains `aria-atomic="true"`.
   Without it, `setText` replacing `textContent` wholesale makes some assistive
   technologies announce a fragment.
5. **The budget line names the boundary.** On `runDriver === 'mcp'`,
   `budget.used` is structurally 0 forever because `model_call` events are emitted
   only under `workerMode: 'adk'`. Say what FleetScope observed and where the
   boundary is. `qa-live.ts` asserts only the substring `model calls`, so a longer
   honest string passes.

**Done when:** `getAnimations()` on the story body is empty across four
consecutive polls in a terminal state, and a screen reader announces one sentence
per state change and nothing else.

---

#### Phase 5. Historical replay

1. **Add `Back to result`**, id `#live-replay-back`, which clears the replay
   flag. Today `client.ts:239` sets `session.replaying = true` and nothing clears
   it, and `state.ts:271-279` returns `canStart: false` on that branch, so a
   reader who presses `Replay evidence` loses the start button until they reload.
2. **The provenance chip is derived from events, not from the replay state.**
   Replaying a live run keeps the chip on `Source: live` and says
   `Re-reading the record of a run that happened.` Replaying a scripted
   transcript reads `Source: recorded` and says
   `This transcript was scripted. No model ran, then or now.` The chip names its
   axis (`10` D42) because it is item 1 in the reading order, so on this screen
   a reader meets it before the headline `Replaying`, and a bare `Live` there
   reads as *happening now* rather than *produced live*. Gate H17 checks it.
3. **The five step path becomes one control with five positions**, not five
   controls, and not a previous and next pair. Moving the playhead re reads stored
   events and writes nothing.
4. **No autoplay, under any condition.** An autoplaying replay of a recorded run
   is indistinguishable from a live run to anyone who did not read the label.
5. `REPLAY_NOTE` renders verbatim; `zero model, tool and Warden calls` is asserted
   at `qa-live.ts:284`.

Add one check: `Back to result` returns `data-state` to `completed`.

**Done when:** replay is reversible, the cursor is unchanged across it, and the
chip never claims a live run was a recording.

---

#### Phase 6. Expert Mode

Read `10` D18 before starting. **Expert Mode on `/live` has no graph canvas.**
There is no adapter from canonical run events to a renderer session document, the
ABI has no append path, and `agent_viewer_load` rebuilds everything at fraction
1.0, so a 400ms polled run would reset camera, selection and playhead 2.5 times a
second. The Zoetrope graph is `/viewer`'s and stays there.

**Expert has a budget too, and it is new** (`10` D44). Five regions, at most
eight controls, and a closed set of components. The pack's first draft counted
Story carefully and then moved every dense surface into the mode with no count,
which is the review's first complaint arriving through the back door. `12`
section 1a is the check.

| Region | Holds |
|---|---|
| A. Identity | run id, provenance chip, event count, mode switch |
| B. Verdict | OutcomeHero, CausalProgress, IncidentExplanation, CurrentAgent |
| C. Evidence | CanonicalTimeline and EventConsole, merged or adjacent |
| D. Decision | DecisionEvidence |
| E. Reference | AgentRail and the six relocated fact fields |

Region B is where `09`'s "Mode: Both" components resolve to a place. They are not
duplicated between modes; they move. A list surface counts as one control however
many rows it has, and the row count is `events.length`.

What `/live` Expert Mode contains, all from the canonical plane:

1. **CanonicalTimeline.** One row per event, equal height, sequence in the gutter,
   right aligned, mono. Indexed by sequence and never by wall-clock proportion.
   The row is a `<button data-sequence="N">`. An eight event run shows eight rows.
   No timestamp column, no latency, no delta, no elapsed. **The row count and any
   rendered event count come from `events.length`, never from `cursor` or
   `highWaterMark`** (`10` C34): `highWaterMark` is the last stored event's
   sequence, and `RunEventLedger.all` drops unparseable and duplicate lines, so
   one rejected event leaves the cursor one higher than the number of events that
   exist. That is `12` void condition 8. `RunCommandBar` gains an explicit
   `eventCount` prop for this and loses `expertAvailable`, which had no field
   behind it once the renderer left `/live` (`10` C35).
2. **EventConsole.** Docked, never floating. Exactly as many rows as there are
   events. Payloads verbatim. Where the ADK producer redacted tool arguments to an
   allowlist of `target`, say the payload is redacted rather than showing a short
   object as if it were whole.
3. **DecisionEvidence.** Four renderings, not one, because `recovery.py:25-26`
   defines `retry_once` plus three `refuse_*` outcomes and `mcp_server.py:250-264`
   emits the intervention before checking `permits_retry`. A refusal is rendered
   as a decision and never in a success treatment. `WHAT FOLLOWED` can be empty
   and empty is rendered, because an omitted heading looks like a rendering gap.
4. **AgentRail**, derived from `event.agent`. Two ids on the MCP path,
   `external_agent` and `warden`. No status dot, no beat status, no avatar, no
   colour per agent. It carries the id as copyable text, first and last sequence,
   and keyboard reach. **Use the `/live` half of `09` section 4.8.** Its `/viewer`
   half cites `crates/agent-viewer-render/src/selection.rs`, which is untracked
   in this worktree and absent at `cfdcca7`, and `crates/**` is forbidden to you.
   There is no renderer on `/live`, so there is no `SelectionOutcome` to match and
   no selection elsewhere to destroy; selection here is local list state shared
   with the timeline and the console.
5. **The six relocated fact fields**, now visible here. Their absent values read
   `Not observed`, not `none` and not `not yet` (`10` C36): `none` claims an event
   exists with an empty value, which is a different statement, and `12` H11 fails
   the shipped defaults. Verified free against `qa-live.ts:248-257`.
6. **Decision Evidence renders the raw payload rationale verbatim.** This is the
   other half of `10` D45: Story says what the decision meant in plain language,
   Expert shows the producer's exact string. `#live-policy` keeps its raw value,
   which is what `qa-live.ts:248-250` asserts.

The mode switch lives in the command bar, **inside the `.aw` wrapper and outside
`#live-root`** (`10` D46). It writes `data-mode` on `#live-root` and mirrors
`?mode=story|expert`. It calls nothing else, issues no request, and does not touch
the cursor. On `/live` it does not emit `data-cockpit-mode` or `fleetscope:mode`,
because no renderer is listening on that page.

**Three** tab stops for the list surfaces, one each with roving `tabindex`, not
one stop per row. It was four in `09` section 2.3, which still counted a graph
canvas stop that D18 removed. Switching mode moves focus to the first heading of
the revealed region.

**Done when:** toggling story to expert to story to expert leaves the canonical
cursor unchanged and issues zero requests to `/runs`; an eight event run shows
eight timeline rows and eight console rows, counted from `events.length`; and
`12` section 1a passes with five regions and no more than eight controls.

---

#### Phase 7. Agent View theme

**Gated.** Confirm the in-flight work on `apps/web/src/pages/viewer.astro` has
landed before starting, and ask before editing it.

`viewer.astro:168-199` declares `--viewer-ink #172033`, `--viewer-paper #f6f7fb`,
`--viewer-blue #4285f4` and `--viewer-violet #8b5cf6`, sets a paper background
with a dotted radial gradient, restyles headings to Georgia at up to 58px, gives
the primary button a `linear-gradient(135deg, #4285f4, #7657e8)` fill, and draws a
six colour conic gradient orb at line 189. That is a different product's visual
language inside the same shell.

Bring it onto the shared near black ground: `--fs-bg`, the `--fs-` ink ramp, sans
and mono only, no serif, no gradient, no orb. `--viewer-blue` becomes
`--fs-accent`.

**`--viewer-violet` does not become `--aw-violet`** (`10` D50). `workspace.css` is
imported by the workspace route only and every rule in it begins with `.aw`, so on
`/viewer` the token does not resolve and the declaration is dropped by the
cascade; that route scoping is a deliberate fail safe in `08` sections 1.2 and
1.3, not an oversight to work around. Writing `var(--aw-violet, #a78bfa)` instead
reintroduces the literal beside a token, which is the exact mistake `08` section
0.3 cites `viewer.astro:173-174` for. `/viewer` has no Warden concept in its UI,
so drop the hue rather than inventing a home for it. If a later change gives
`/viewer` a Warden surface, add an `--fs-` token in `global.css` under a separate
instruction; do not import the workspace layer into a second route.

Three constraints. `#agent-viewer-canvas canvas` is asserted by
`browser-qa.ts:950-952`, so do not rename the host. The renderer measures its host
once at construction, so **do not construct** the canvas inside anything that can
be zero width or `display: none`; hiding it afterwards is safe, and `06` section
14 item 3 records that the shipped canvas already sits outside the mode panels and
is visible in both modes (`10` C33 rules for D22 over `06` section 13.2's stronger
wording). And the `/viewer` halves of `09` sections 4.8 and 4.13 depend on
`crates/agent-viewer-render/src/{selection,manifest}.rs` and on an extended wasm
ABI, none of which exists at `cfdcca7`; `crates/**` is forbidden to you, so if
that in-flight work is not present, build the theme and stop, and say so.

Also fix the defect at `06` section 11.2: `fallbackEl?.remove()` runs only on
`boot()`'s success branch, so after a failure the canvas reads
`Loading the Agent Viewer…` forever while the status line says the renderer could
not load. Two contradictory statements, the more prominent one false. Rewrite the
placeholder on failure rather than leaving it.

**Done when:** `/viewer` and `/live` are visibly the same product, and
`pnpm qa:browser` is unchanged.

---

#### Phase 8. Motion

By this point Story Mode has none and must still have none. This phase is Expert
Mode only, and it is short.

Permitted: `opacity`, and `transform: translateY()` up to 2px. Nothing else.
Durations `--aw-motion-fast: 120ms` and `--aw-motion-state: 200ms`, easing
`cubic-bezier(0.2, 0, 0, 1)`. 200ms is a derived ceiling, not a preference: the
poll is 400ms, so anything longer than half an interval can be interrupted
mid flight by an unrelated repaint.

Never animate:

* anything perpetual. `global.css` has `fs-pulse 1.6s infinite` and
  `fs-spin 700ms infinite`; the workspace inherits neither. All eight events
  arrive in one POST, so there is no ongoing process to report;
* per event arrival. Animating each row renders a burst as a stream, which is a
  visual claim that the transcript arrived progressively;
* anything while `provenance === 'recorded'`, and `--aw-cyan` under any
  circumstances;
* anything that changes the width of a renderer host.

`global.css` already carries a global `prefers-reduced-motion` clamp with
`!important` across `*`, so do not redeclare it. Verify instead that every
permitted animation ends at `opacity: 1` and `translateY(0)`, so the clamped
result is the correct final appearance rendered immediately.

**Done when:** no computed transition or animation duration in the workspace
exceeds 200ms, and Story Mode's `getAnimations()` is empty in all twelve states.

---

#### Phase 9. Responsive

Build at 390px first. `qa-live.ts` runs at 1440x900 and 480x900 and asserts zero
horizontal overflow at the narrow one, so a layout clean at 390 is clean at the
width QA measures.

* **1440x900.** Story is one column with a measure cap; more than 70 percent of
  `<main>` stays unassigned. Expert can be three columns.
* **1280x720.** Constrained by height, not width: 720 minus browser chrome leaves
  roughly 600px. The Story fold shrinks and the sentence keeps its size while
  Progress gives up space. Expert drops to two columns.
* **390x844.** Single column everywhere. The causal path stacks: it does not
  scroll sideways, does not truncate a label and does not drop a step, because
  the set of steps that did not happen is the point. Expert becomes a tab set,
  not a narrow third column, because a column collapsed to zero width is the same
  bug as a hidden one. The delegation line wraps to two lines and never
  ellipsises.

Wide content scrolls inside its own `overflow-x: auto` container. The body never
scrolls horizontally.

**Done when:** at 390, 480, 1280 and 1440, for `#live-root`,

```js
Math.max(...[...root.querySelectorAll('*')].map(e => e.getBoundingClientRect().right))
  <= window.innerWidth
```

and `el.scrollWidth <= el.clientWidth` on every element not declared
`overflow-x: auto`.

**Do not use `document.documentElement.scrollWidth === clientWidth`.** It cannot
fail (`10` D47). `global.css:70-74` puts `overflow-x: hidden` on `html`, the
root's overflow propagates to the viewport, and `documentElement.scrollWidth` is
clamped to `clientWidth` whatever the layout does. Probed in Chromium at 480x900
against a 1200px child, the shipped form at `qa-live.ts:300-303` reported 480
against 480 and passed. That check stays where it is, because you may not edit an
existing check; add the geometric one beside it.

---

#### Phase 10. Browser QA

Additions only. Target: 58 existing checks still passing, plus the new ones,
across both viewports.

Add the honesty guard first, because it is the one that catches a class of error
rather than an instance. Following the shape of `browser-qa.ts:1126-1133`, assert
that `#live-root`'s `innerText` contains none of: `ai fixed`, `reasoning chain`,
`autonomous`, `gateway`, `model armor`, `provider outage`, `self healing`,
`self-healing`, `the agent retried`, `the agent recovered`, `the model decided`.
One check per viewport.

Then add the preconditions from `05` section 7 and `08` section 9, restated in
`12-acceptance-gate.md` section 4 with the amendments from `10` section 3. The
two that changed:

* the border check exempts a control's own boundary and `:focus-visible`, and
  asserts `border-style: none` on everything else in the story body;
* the animation check is
  `document.getElementById('live-root').getAnimations({ subtree: true }).length === 0`,
  with no exceptions, including on entering `completed`. The exact call matters:
  `Element.getAnimations()` without the option misses a descendant, and
  `document.getAnimations()` catches the nav (`10` C32).

Four more, added after review and each catching a class rather than an instance:

* **the jargon guard**, G2.7: `#live-root`'s `innerText` in Story contains none of
  `idempoten`, `admits`, `admitting`, `ledger`, `(ies)`. Same shape as the honesty
  guard, different failure mode: H2 catches a false claim, this catches a true one
  a stranger cannot read;
* **the completed sentence guard**, H16: the sentence names a fault and the Warden
  only when the events that entitle it exist;
* **the replay chip guard**, H17: on `historical_replay` nothing above the
  headline renders the unqualified word `Live`;
* **the liveness guard**, H18 and V11: nothing computes to `--aw-cyan` while
  `events.length === 0`.

Run the full gate in `12-acceptance-gate.md` before declaring done.

**Done when:** `pnpm test`, `pnpm qa:live` and `pnpm qa:browser` all pass, and
every box in `12-acceptance-gate.md` is ticked with the observation that ticked
it. Section 2a of that document lists four items you cannot reach from a browser
inside this scope; record them as blocked with their reason rather than ticking
or waiving them.

---

### Rules that apply to every phase

1. **Never invent a value.** If you cannot point at the canonical event field or
   the API field that produced a string on screen, do not render the string. This
   is the rule that catches the failure class no layout review catches: the
   rejected prototype showed 13 events for an eight event run, three latency
   figures for a type with no latency field, and a policy version string taken
   from a recorded fixture under a `Live` label.
2. **Absence has four words and none of them is a symbol.** `Unknown` means the
   runtime cannot report it. `Not observed` means it is reportable and no event
   carries it yet. `None` means an event exists and its value is genuinely empty.
   `Not applicable` means the field cannot exist in this configuration. Never
   `0`, `-`, `N/A`, an empty string, or a plausible default.
3. **Never make the agent the subject of the retry.** The intervention's author
   is hardcoded `warden`, the policy decides from declared metadata with no model
   output reaching it, and the agent never saw the failure because the retry loop
   runs inside `handle_call` and returns one string. "The agent tried again" is
   false at the mechanism level, and it gives away the product's entire argument
   in a sentence.
4. **Never render a hue without its word.** Blue and violet collapse to an RGB
   distance of 27 out of 441 under both protanopia and deuteranopia and differ by
   4 percent in luminance, and they co occur on `completed`. The word is the
   carrier; the hue is an accent on it.
5. **Never add a fourth region to Story Mode**, however small. A caption, a
   legend, a badge strip and a footnote are all regions.
6. **Never add a fourth control to a screen that already has three.**
   `completed`, `failed`, `recorded` R2 and `historical_replay` are at the cap
   including the mode switch.
7. **Never make a chip, a hue or a line state something about a run before that
   run has produced an event.** No provenance chip, no topology line and no cyan
   on `unavailable`, `ready`, `starting` or `awaiting_agent`. The elements stay
   attached and hidden. `10` D40 is one rule that three separate documents had
   each half discovered.
8. **Keep every existing DOM handle.** `#live-root[data-state]`, `#live-start`
   with its exact text `Run live recovery demo`, `#live-delegation[data-observed]`,
   `#live-awaiting`, `[data-beat][data-status]`, `.live-beat__status`,
   `#live-policy`, `#live-incident`, `#live-result`, `#live-cursor`,
   `#live-budget`, `#live-replay`, `#live-replay-note`. Four are added:
   `#live-provenance[data-provenance]`, `#live-replay-back`, `#live-start-error`,
   and the two mode buttons.
9. **Deviating is allowed. Deviating silently is not.** If a decision in `10`
   turns out to be wrong once it exists in code, say so, give the source line
   that shows it, and record it in `10` section 6 in the same change. That is
   what the supersession log is for.

### The acceptance gate

`docs/design/agent-workspace/12-acceptance-gate.md`. Every item is observable.
Run it yourself before handing back, and report each item with the observation
that satisfied it rather than with a tick.

The three that most often fail last, so check them early:

* the story body has exactly one filled element and it is the primary action;
* an eight event run renders eight events everywhere it renders events, counted
  from `events.length` and never from the cursor;
* the delegation string survives verbatim in every state and in both modes.

And one that failed silently in the design and would fail silently in the code:
**the `completed` sentence must name a fault and the Warden only when the events
that entitle it exist.** Four documents carried it verbatim, the gate checked it
for one word, and the state's own entry condition never required either event.
