# Acceptance gate

The checklist a reviewer runs before calling the agent workspace done.

Every item below is something you can observe: a count, a computed style, a
string, a test result, or a recorded answer from a person who has not seen the
product. None of them is a feeling. An item that cannot be observed is not on
this list, because the previous prototype satisfied every prose requirement
anyone wrote for it and was still rejected.

## 0. How to run this

1. Build and serve the app, then run the three suites: `pnpm test`,
   `pnpm qa:live`, `pnpm qa:browser`.
2. Work through sections 1 to 7 in order, at both 1440x900 and 390x844. Record
   the **observation** beside each item, not a tick. "G3: counted 1 filled
   element, `#live-start`" is a result. "G3: yes" is not.

   **Which sections run in which mode**, settled by `10` D44, because the earlier
   instruction to run every section "in both modes" made G1.1 unsatisfiable in
   Expert and G1.4 absurd beside a timeline of eight button rows:

   | Sections | Mode |
   |---|---|
   | 1, 3, 4, 7 | Story Mode only |
   | 1a | Expert Mode only |
   | 2, 5, 6, 9 | Both |
3. Section 8 is the human test. Do not run it until sections 1 to 7 pass,
   because a failure there makes the human test meaningless.
4. Section 9 lists what voids the whole gate regardless of score.

An item marked **[auto]** should be a check in `scripts/qa-live.ts` by the time
you run this. If it is not yet automated, observe it by hand and record that the
automation is missing.

---

## 1. The six rejections, each answered by a count

The review gave six reasons. Each one is restated here as the number that would
have caught it.

### G1. Not too much at once

| Item | Observe | Passes when |
|---|---|---|
| G1.1 [auto] | Count direct children of **`#live-root`** with a non empty rendered box, in each state | At most 3, in every state. `#live-root` is the region container; the `.aw` wrapper that holds the token scope and the command bar is a different element and is not what this row counts (`10` D46) |
| G1.2 [auto] | Count visible words under `#live-root`, whitespace separated tokens containing an alphanumeric character. Then count them in the command bar separately | Story body at most 62, except `awaiting_agent` at 63 (`10` C12). Command bar at most 8, currently 5 (`10` D49). Page chrome outside the `.aw` wrapper, the skip link and the nav, is not counted and is covered by H2 instead |
| G1.3 [auto] | Count **enabled** controls inside the story body per `data-state`, then separately count controls that are present and disabled | `unavailable` 0 enabled, `ready` 1 (variant B: 0 enabled, 1 present and disabled), `starting` 0, `awaiting_agent` 1, `running` 0, `controlled_fault` 0, `incident` 0, `warden_authorized` 0, `recovering` 0, `completed` 2, `failed` 2, `historical_replay` 2. The recorded fallback is not a `data-state`: R1 is `ready` variant B, R2 is `completed` or `failed` with `canStart: false`, so R2 reads 1 enabled and 1 present and disabled |
| G1.4 | Count controls visible in the story body **plus the mode switch**. Page chrome, the skip link and the nav, is outside the count | Never more than 3. Scoped by `10` D49: the earlier "anywhere on the page" failed a fully compliant build on `completed`, which already sits at three, because a skip link and a nav are controls visible on the page. `03` section 3.2 already frames the mode switch as sitting outside the story body and counted separately |
| G1.5 [auto] | Read the computed colour of every visible element in the story body. Map `--fs-text`, `--fs-text-muted`, `--fs-text-faint` and `--fs-bg` to one neutral bucket, then list the rest | At most 4 buckets, and every non neutral value is one of `--fs-accent`, `--aw-cyan`, `--aw-violet`, `--aw-orange`. Restated by `10` C30: as a bare cardinality of four this was unsatisfiable, because `completed` renders three ink levels plus violet plus orange plus `--fs-bg` as the ink on the blue fill, and no automated counter could know which of those collapse |
| G1.6 [auto] | For every element under `#live-root`, read `border-style` | `none`, except the secondary action and whatever holds `:focus-visible` |

For reference, the rejected prototype measured 8 regions, 272 words, 25 controls,
7 hues and 84 drawn border edges, in a single layout that did not vary by state.

### G2. Agent native, not a SOC dashboard

| Item | Observe | Passes when |
|---|---|---|
| G2.1 | Count elements in the story body whose computed `font-family` resolves to the mono stack | Only evidence: identifiers, sequences, the copyable prompt. No sentence, no label, no button. |
| G2.2 | Read the computed `font-size` of every visible element in the story body | On every state that reports an outcome: exactly one element at the largest size, and it is the headline. On `ready` variant A only: no element at the 36px step, the headline sits at 21px with the sentence, and the sole focal object is the filled CTA (`10` D41). Variant B keeps the 36px headline, because `Cannot run here` is the outcome and its CTA is disabled and unfilled |
| G2.3 | Compute the ratio between the largest and the body size | At least 2.40 |
| G2.4 [auto] | Compute the union of bounding rectangles of every element with a non transparent background, a visible border, or non empty text, as a fraction of the `<main>` box, at 1440x900 in `completed` | At most 55 percent assigned; target under 30 percent. `08` section 5.3 derives a 45 percent contract with 55 as the ceiling and 30 as the smoke alarm. **R6 is restated against this row** by `10` C29, because the two rows previously set the pass bar at 30 and at 55 and a reviewer measuring 42 passed one and failed the other |
| G2.5 | Look for a log line, a five column feed row, a syntax highlighted key value block or a status dot in Story Mode | None present |
| G2.6 | Read the always visible verbs on the page | The primary action is a verb the reader wants to press. `Stop` is not the only stateful verb anywhere. |
| G2.7 [auto] | Read `#live-root`'s `innerText` in Story Mode, in every state, lowercased | Contains none of: `idempoten`, `admits`, `admitting`, `ledger`, `(ies)`. `10` D45: a raw producer string renders verbatim in Expert Decision Evidence, and Story says what it means. This is the machine form of the jargon rule and it sits beside H2, which is the machine form of the false claim rule |

### G3. Story and Expert genuinely separated

| Item | Observe | Passes when |
|---|---|---|
| G3.1 [auto] | Read `#live-root[data-mode]` | Real values `story` and `expert`, and the two render different DOM rather than the same DOM with different emphasis |
| G3.2 [auto] | In Story Mode, query for the timeline, the console and the Decision Evidence panel | None is visible |
| G3.3 | Toggle story to expert to story to expert, then read `#live-cursor` | Unchanged across all three toggles |
| G3.4 | Record network requests during the same three toggles | Zero requests to `/runs` |
| G3.5 | Reload with `?mode=expert` and with `?mode=nonsense` | The first opens Expert; the second falls back to Story without an error |
| G3.6 | Switch mode with the keyboard, then check where focus is | On the first heading of the newly revealed region, not left on the switch |

### G4. Sidebar and graph do not duplicate each other

| Item | Observe | Passes when |
|---|---|---|
| G4.1 | In Expert Mode, look for a status dot or a beat status on the agent rail | Neither is present. The rail carries the id, the first and last sequence, and keyboard reach. |
| G4.2 [auto] | Count the number of places any single fact is rendered at one time | Exactly one. The acting agent appears in region B and nowhere else. |
| G4.3 [auto] | Count progress representations on screen | Exactly one, the five step causal path. No fraction, no percentage, no `n of m`. |
| G4.4 | Read the run identity in Expert region A | Provenance and event count. Never `Controlled Fault`. |

The rejected prototype stated progress four times in two incompatible numbering
systems, `4 / 5`, `8 / 13`, `8` and `8 / 13`, and rendered each actor three times.

### G5. The default view is not an inspector

| Item | Observe | Passes when |
|---|---|---|
| G5.1 [auto] | In Story Mode, read the six fact ids `#live-agent`, `#live-incident`, `#live-policy`, `#live-result`, `#live-cursor`, `#live-budget` | All six are attached, and none is visible |
| G5.2 | Look for a payload key, a sequence number as primary content, a cursor value or a latency in Story Mode | None present. Latency in particular does not exist: `CanonicalEvent` has no such field. |
| G5.3 | Read the incident on `controlled_fault` in Story Mode | A sentence in plain English, not a definition list |
| G5.4 | Open Expert Mode | The six fields are visible there, plus the timeline, console and Decision Evidence |

### G6. Restraint, not a colour swap

| Item | Observe | Passes when |
|---|---|---|
| G6.1 [auto] | Count elements in the story body with a non transparent `background-color` that is not a chip tint | Exactly 1, `#live-start`, and only when enabled |
| G6.2 [auto] | Evaluate `document.getElementById('live-root').getAnimations({ subtree: true }).length` in every state | `0`, with no exceptions. The exact call is specified by `10` C32: `Element.getAnimations()` without `{ subtree: true }` misses a descendant, and `document.getAnimations()` catches the nav and anything `global.css` animates, so the two earlier phrasings either under detected or over fired |
| G6.3 [auto] | Read every computed `transition-duration` and `animation-duration` in the workspace | None exceeds 200ms |
| G6.4 | Count `max-width` caps on prose blocks | Every prose block is capped. The sentence uses `--aw-measure-sentence`, everything else `--aw-measure-body`. |
| G6.5 [auto] | Read every computed `opacity` in the story body | None is strictly between 0 and 1 |
| G6.6 [auto] | Grep `apps/web/src/styles/workspace.css` | No `:root`, no bare element selector, and no line matching `^\s*--fs-[a-z0-9-]*\s*:` |
| G6.7 | Count declarations in `workspace.css` | 13 tokens, of which 6 hold colour. Under 60 percent colour by count. |
| G6.8 | Render the page in greyscale, and in forced colours mode | Nothing becomes ambiguous. Every state that carries a hue still reads its word. |

---

## 1a. Expert Mode, counted

Story Mode is governed by section 1. Expert Mode was not governed by anything
until `10` D44, which is the defect this section exists to close: the review's
first complaint was eight regions competing, the pack answered it for Story with
counts, and then moved every dense surface into the mode with no count. Run these
in Expert Mode at 1440x900 and 390x844.

| Item | Observe | Passes when |
|---|---|---|
| GE1 [auto] | Count the labelled region surfaces rendered in Expert on `/live` | Exactly 5: Identity, Verdict, Evidence, Decision, Reference. No sixth, however small |
| GE2 | List the components rendering in each region against `10` D44's table | The set is closed. A component not in that table is not on the page |
| GE3 [auto] | Count controls in Expert, treating each list surface as one control regardless of row count | At most 8 |
| GE4 [auto] | Count rows in CanonicalTimeline, rows in EventConsole, and any rendered event count | All three equal `events.length`. An eight event run reads eight everywhere (`10` C34) |
| GE5 | Read the run identity in region A | Run id, provenance chip, event count, mode switch. Never `Controlled Fault` (`10` C3) |
| GE6 | Look for a graph canvas, an `AgentNode` or a `RuntimeEdge` on `/live` | None. `10` D18: the graph is `/viewer`'s |
| GE7 | Read the six relocated fact fields | Visible here, in region E, and readable. This is where G5.4 is satisfied |
| GE8 | Read the raw payload rationale | Verbatim in Decision Evidence. This is the half of `10` D45 that Story gives up |

Sections 2, 5, 6 and 9 also run in Expert. Sections 1, 3, 4 and 7 do not: they
are Story Mode budgets and applying them to a timeline of eight button rows is
what made the earlier "in both modes" instruction unsatisfiable.

---

## 2. Honesty

These are the items whose failure is worse than an ugly page. Each one has a
source line behind it, cited in `07` and `10`.

| Item | Observe | Passes when |
|---|---|---|
| H1 [auto] | Read `#live-delegation` in every state and both modes | Contains `Unknown / not observable in this runtime`, character for character, and `data-observed="false"` on an MCP run |
| H2 [auto] | Read **`<main>`**'s `innerText` in every state and both modes | Contains none of: `ai fixed`, `reasoning chain`, `autonomous`, `gateway`, `model armor`, `provider outage`, `self healing`, `self-healing`, `the agent retried`, `the agent recovered`, `the model decided`. **Rescoped from `#live-root` by `10` D49**: scoping every honesty check to one element made any claim in the page header, the nav or future chrome unchecked by construction, which is how `live.astro:22` shipped a lede asserting a deliberate failure and a retry on a screen where nothing had run |
| H3 | Read every sentence about the retry | The Warden or FleetScope is the grammatical subject. The agent is never the subject of retry, recover, fix, resolve, handle or work around. |
| H4 | Count timeline rows, console rows and any rendered event count, against **`events.length`** | All three equal `events.length`. No renumbering, no zero padding into a different number. **Restated by `10` C34**: the earlier form compared the rendered rows to `#live-cursor`, which is `highWaterMark`, the last stored event's sequence and not a count. One rejected event in a batch leaves the cursor one higher than the number of events that exist, so the check could not catch void condition 8. `#live-cursor` may legitimately exceed the count and is labelled as a cursor wherever it is visible |
| H5 | Look for a latency, a duration, a delta or an elapsed column anywhere | None. `CanonicalEvent` carries no such field. |
| H6 | Read the run-level chip in every state | Never `Controlled Fault`. Absent when `events.length === 0`, except `unavailable`, which reads `Unavailable`. Otherwise `Source: live` or `Source: recorded` (`10` D42) |
| H7 | Read the budget line on an MCP run | Says what FleetScope observed and names the boundary. Not `0 / 60 model calls` on its own. |
| ~~H8~~ | **Moved to section 2a by `10` D51.** No input to `POST /runs` produces a `refuse_*` outcome | |
| ~~H9~~ | **Moved to section 2a by `10` D51.** `qa-live.ts:91` runs offline and `transport.py` returns 200 from a constant, so the branch cannot fire | |
| H10 | Read the `completed` sentence | Does not contain the word `authoritative` until `GET /runs/capability` publishes the offline flag |
| H11 | Read every absent value on screen | One of `Unknown`, `Not observed`, `None`, `Not applicable`. Never `0`, `-`, `N/A`, `--` or an empty cell. |
| H12 | Replay a live run, then read the chip | Still `Source: live`, with `Re-reading the record of a run that happened.` It does not flip to `Source: recorded`: the derivation reads events, not state (`10` C2) |
| ~~H13~~ | **Moved to section 2a by `10` D51.** Not reachable from `/live` in this programme's scope | |
| H14 | Watch `awaiting_agent` for thirty seconds | Nothing moves. No pulse, no animated ellipsis, no shimmer, no fake typing. |
| H15 | Read the copyable artifact on `awaiting_agent` | A natural language prompt naming real identifiers. Not a shell command, not a `$` prompt glyph, not a window frame, not control dots. It renders in region A, and region C holds `Copy prompt` alone (`10` C27) |
| H16 [auto] | Read the `completed` sentence against the events | It names a fault and the Warden **only when** an `incident` event exists, the latest `intervention` carries `payload.outcome === 'retry_once'`, and a `tool_call` follows it at a higher sequence. A four event success renders the no fault sentence instead. `10` D43: the state's entry condition requires neither event, the four event path is reachable through the attempt ledger, and `deriveBeats` correctly marks both beats `pending` on the same screen the sentence claims they happened |
| H17 [auto] | On `historical_replay`, read every element above the headline | None renders the unqualified word `Live`. `10` D42: the chip is item 1 in the reading order, it means *produced live*, and a reader parses a bare `Live` above `Replaying` as *happening now* |
| H18 [auto] | Read every element's computed colour while `events.length === 0` | None computes to `--aw-cyan`. `10` D40: cyan means the run is under way, and on `starting` and `awaiting_agent` nothing is executing |

### 2a. Blocked on deferred work

These items are real and they are not observable inside the file scope `11`
grants. `10` D51 quarantines them rather than leaving them in the list above,
because an item that fails a correct build gets waived on its first run and a
waived item stops guarding anything. Each one names what unblocks it, and each
one has unit level coverage in `apps/web/tests/live-state.test.ts`, which `11`
already permits, so the behaviour is tested even though the screen is not
reviewed.

| Item | What it would observe | Why it cannot be reached | Unblocked by | Covered instead by |
|---|---|---|---|---|
| H8 | A Warden refusal rendered as a decision, fourth step `◇` | The only scenario is `idempotent_read` with one permitted retry and a retryable injected fault, and `runs.ts` accepts one field from a fixed enum, so no input produces a `refuse_*` outcome | `10` section 7 item 8 | The `refuse_not_idempotent` unit test in `11` phase 1 |
| H9 | A `truth: 'live'` incident: headline `Read failed`, reason verbatim, no orange | `qa-live.ts:91` sets `FLEETSCOPE_WORKER_OFFLINE: 'true'` and `transport.py` returns 200 from a module constant, so `tools.py:132-136` cannot raise | `10` section 7 item 9 | The `truth: 'live'` incident unit test in `11` phase 1 |
| H13 | A scripted transcript: chip `Source: recorded`, plus its sentence | No scripted run is reachable from `/live`: `canReplay` is false on the `run === null` branch, `refreshRun` returns early with no `runId`, and there is no list route or `?run=` parameter | `10` section 7 item 3 | The all recorded `provenance` unit test in `11` phase 1 |
| Section 3, recorded R1 and R2 | Two of the eleven screen reviews | Same as H13 | `10` section 7 item 3 | `05` section 3.8 is the specification; the screens are reviewed on paper, not in a browser |

**The browser gate covers the MCP reachable states and says so.** Those are
`unavailable`, `ready` in both variants, `awaiting_agent`, `completed`,
`historical_replay`, and `failed` where the terminal result is not `succeeded`.
`running`, `controlled_fault`, `incident`, `warden_authorized` and `recovering`
are worker driver or replay states and are covered by unit tests over
`deriveLive`. Record that distinction on the sign off rather than implying a
browser observed all twelve.

---

## 3. The nine screens, reviewed one at a time

For each of `ready` (both variants), `awaiting_agent`, `running`,
`controlled_fault`, `warden_authorized`, `recovering`, `completed`, `failed`, the
recorded fallback (both branches) and `historical_replay`, answer these five and
record the answer.

| Q | Question | Fails when |
|---|---|---|
| S1 | Is there exactly one focal point, and is it the right one? | Two objects compete, or the focal point is a control on a screen that reports an outcome |
| S2 | Are there at most three actions? | Four or more, counting the mode switch |
| S3 | Will a first-time reader understand `Controlled Fault` where it appears? | The words appear with no plain language statement of deliberateness on the same screen |
| S4 | Could a reader confuse a replay with a live run? | The only difference is a colour, or the distinction is carried by one signal on a screen where being wrong is expensive |
| S5 | Could a reader believe the Warden acted beyond policy? | The screen credits the Warden without naming the bound (`exactly one retry`) and the condition (`can be repeated without changing anything`) |

**One** screen gives the focal point to the action rather than the headline,
`ready` variant A, and it does so by dropping the headline a type step so there
are not two objects at the top of the page (`10` D41). `awaiting_agent` no longer
does: `10` C27 moved the prompt into region A, so its focal point is the 36px
headline like every other screen. Every screen that reports an outcome puts the
focal point on the outcome.

**Two of the eleven screens are reviewed on paper, not in a browser.** The
recorded fallback's two branches are not reachable from `/live`; see section 2a.

Three screens carry the highest S4 risk and need all three of their guards
present: `running` (reachable from a live worker run and a stepped replay),
`completed` (a live run and a completed recorded run render identically except
for the chip), and the recorded fallback R2 (a complete successful causal path on
a deployment that cannot run anything).

---

## 4. Machine preconditions

Drawn from `05` section 7 and `08` section 9, with the amendments from `10`
section 3. Run at 1440x900 and 480x900, in Story Mode.

| # | Precondition | How |
|---|---|---|
| P1 | The static markup does not claim `ready` | `#live-root[data-state]` is `unavailable` in the served HTML before any script runs |
| P2 | Exactly one element at the top type step, and it is the headline | Count elements whose computed `font-size` equals the largest in the story body. **Amended by `10` D41:** on `ready` variant A no element sits at the 36px step, the headline shares 21px with the sentence, and the filled CTA is the sole focal object. Every other state, variant B included, asserts one element at the top step and that it is the headline |
| P3 | Control count per state matches G1.3 | Count enabled controls inside the story body per `data-state` |
| P4 | No border in the story body except a control's own boundary | `border-style` is `none` on every element under `#live-root` except `#live-replay` and whatever holds `:focus-visible`. **Amended from `05` P4, which required 0px everywhere.** |
| P5 | No horizontal overflow | **Geometric, not `scrollWidth`. Replaced by `10` D47.** At 390, 480, 1280 and 1440: `Math.max(...[...root.querySelectorAll('*')].map(e => e.getBoundingClientRect().right)) <= window.innerWidth` for `#live-root`, **and** `el.scrollWidth <= el.clientWidth` on every element not declared `overflow-x: auto`. The old form cannot fail: `global.css:70-74` puts `overflow-x: hidden` on `html`, the root's overflow propagates to the viewport, and `documentElement.scrollWidth` is clamped to `clientWidth` whatever the layout does. Probed in Chromium at 480x900 against a 1200px child, the shipped form reported 480 against 480 and passed |
| P6 | The delegation string survives verbatim in every state | `#live-delegation` contains the string in every state the suite visits, not only `ready` and `completed`. It is **attached and visually hidden** until the first canonical event (`10` D40, C40); `textContent()` and `getAttribute()` resolve hidden nodes, so this row is satisfied by DOM presence and the rule is not weakened |
| P7 | At most three regions render | Count direct children of **`#live-root`** with a non empty rendered box. Not of the `.aw` wrapper, which also contains the command bar (`10` D46) |
| P8 | Visible words are at or under budget | Story body 62, except `awaiting_agent` at 63. Command bar 8, separately (`10` D49) |
| P9 | No motion fires on a poll | `document.getElementById('live-root').getAnimations({ subtree: true }).length === 0` across four consecutive 400ms ticks in a terminal state. **Amended twice: the count must be zero rather than merely stable (`10` D17), and the call is written out because three documents phrased it three ways and two of them measured the wrong scope (`10` C32).** A permanent animation passes "must not increase" |
| V1 | The token file cannot leak | Grep `workspace.css` for `:root`, bare element selectors, and `--fs-` declarations |
| V2 | At most four hues | Same as G1.5: collapse `--fs-text`, `--fs-text-muted`, `--fs-text-faint` and `--fs-bg` into one neutral bucket, then check every remaining value against the fixed set `--fs-accent`, `--aw-cyan`, `--aw-violet`, `--aw-orange` (`10` C30) |
| V3 | Orange always names its meaning | Every element in **`<main>`** computing to `--aw-orange` has `Controlled Fault` in its text or accessible name. Only the label carries orange; the beat marker takes the neutral ink, because an `aria-hidden` glyph has an empty accessible name and a text content of `●` and would fail this row (`10` C31) |
| V4 | Violet always names its meaning | Every element in **`<main>`** computing to `--aw-violet` names the Warden |
| V5 | One filled element | Exactly one element in the story body has a non transparent `background-color` that is not a chip tint, and it is `#live-start` when enabled |
| V6 | Borders | Same as P4 |
| V7 | Zero animations in Story | `document.getElementById('live-root').getAnimations({ subtree: true }).length === 0` in all twelve states (`10` C32) |
| V8 | Duration ceiling | No computed transition or animation duration in the workspace exceeds 200ms |
| V9 | Negative space | Assigned area at most 55 percent of the `<main>` box; investigate above 30 percent |
| V10 | No partial opacity | No element in the story body has a computed `opacity` strictly between 0 and 1 |
| V11 | Cyan claims nothing before the first event | No element computes to `--aw-cyan` while `events.length === 0` (`10` D40). Same rule as H6's absent chip and P6's hidden topology line: nothing states anything about a run before that run has produced an event |

P1 and P6 are covered in some form by the shipped suite. P5 has a shipped check
that cannot fail, so its replacement is new work rather than a strengthening; see
`00` section 6.1. The rest are new.

---

## 5. The suites

| Item | Observe | Passes when |
|---|---|---|
| T1 | `pnpm qa:live` | 58 existing checks pass, plus the additions. **Zero existing checks were edited or deleted.** Confirm by diffing `scripts/qa-live.ts`. The file has **25** `check(` call sites plus the `check` function declaration at `qa-live.ts:39`, which a bare `grep -c` counts as a twenty sixth; 24 sit outside the five iteration loop at `:237`, so 24 + 5 gives 29 per viewport and 58 across two |
| T2 | `pnpm qa:browser` | Passes unchanged. If it does not, something outside the allowed file scope was touched. |
| T3 | `pnpm test` | Passes. Exactly two expectations in `live-state.test.ts` changed, at `:123-128` and `:130-134`, and both are corrections of assertions that encoded the two derivation bugs as expected behaviour. |
| T4 | Read `live-state.test.ts:227-235` | The `TRUTH_LABEL` map assertion is unchanged |
| T5 | Read the diff of `scripts/qa-live.ts` | Additions only. In particular, the assertion at `:240-245` reading `Controlled Fault` from `[data-beat="fault"] .live-beat__status` is untouched. |
| T6 | Read the new tests | **Five** added: a `truth: 'live'` incident still gives `incident`; a six event slice ending at the retry `tool_call` gives `recovering`; a refusing intervention with no `run_end` holds at `controlled_fault` and marks the retry beat `refused`; `provenance` is `recorded` for an all recorded transcript whose incident carries `controlled_fault`; **and a four event transcript of `run_start, tool_call, tool_result[ok], run_end[succeeded]` gives `completed` with a sentence that names neither a fault nor the Warden** (`10` D43). Three of the five are also the coverage that section 2a leans on |
| T7 | Read the diff of `apps/web/src/styles/global.css` | Empty |
| T8 | Read the diff for files outside the allowed scope in `11` | Empty, or accompanied by an explicit approval |

---

## 6. Accessibility

| Item | Observe | Passes when |
|---|---|---|
| A1 | Count live regions | Exactly one for state, `#live-sentence`, with `role="status"`, `aria-live="polite"` and `aria-atomic="true"`. One more for copy confirmation, empty at every other moment. |
| A2 | Check `#live-beats` | Not a live region, under any circumstance. It is cleared and rebuilt every 400ms. |
| A3 | Read a beat with a screen reader | Announces the label, the status word, the truth and the sequence. A done beat announces `done`, not only `Live`. |
| A4 | Tab through Story Mode | **Six stops after the site nav**: mode switch, `#live-start`, `#live-replay` when present, `#live-replay-back` when present, preceded by the skip link and the nav. **The nav is nine stops, not one** (`10` C37): `Nav.astro:32` renders a brand anchor and `:15-23` maps seven links, which `10` D2 takes to eight, so a correct build tabs fourteen times. The earlier "six stops" total would have failed a compliant page. Nothing autofocuses |
| A5 | Tab through Expert Mode | **Three** more stops, one per list surface: AgentRail, EventConsole, CanonicalTimeline. Arrow keys move within each; not one stop per row. It was four because `09` section 2.3 counted a graph canvas stop, which `10` D18 removed from `/live` |
| A6 | Grep for `tabindex` | No positive value anywhere |
| A7 | Read the disabled CTA with a screen reader | Its `aria-describedby` points at the sentence, which already carries the reason in every disabled state |
| A8 | Check for `aria-live="assertive"`, `role="alert"` and `aria-busy` | None present. Nothing here is an emergency, the incident is expected, and FleetScope is not busy during `awaiting_agent`. |
| A9 | Measure contrast for every ink and surface pair in use | All clear WCAG AA. Worst case in the specified palette is 5.07:1. |
| A10 | Measure the primary action | Fill against ground at least 3:1 for WCAG 1.4.11, and label against fill at least 4.5:1. Dark ink on the specified blue is 6.77:1; white ink on it is 2.82:1 and fails. |
| A11 | Render in forced colours mode | No information is lost. Every hue carrying meaning also carries its word. |

---

## 7. Responsive

| Item | Observe | Passes when |
|---|---|---|
| R1 | 390x844, every state | Single column, no horizontal scroll, the causal path stacked with all five steps present and no label truncated |
| R2 | 390x844, the delegation line | Wraps to as many lines as it needs and is never ellipsised |
| R3 | 390x844, Expert Mode | A tab set. Not a narrow third column, and nothing is **constructed** in a zero width or hidden host (`10` C33: hiding a measured host is safe, constructing in one is not). All five regions of `1a` are reachable through the tabs |
| R4 | 480x900 | `pnpm qa:live` passes the **geometric** overflow assertion of P5. Its shipped `scrollWidth` assertion also passes, and always would; `10` D47 and `00` section 6.1 record that it is a no op |
| R5 | 1280x720 | The fold shrinks by giving up Progress space, not sentence size. Expert drops to two columns. |
| R6 | 1440x900 | Story is one column with a measure cap, and assigned area is at most 55 percent of `<main>` with a target under 30. **Restated against G2.4 by `10` C29**, which is the same measurement; the two rows previously set the bar at 30 and at 55, so 42 percent passed one and failed the other |
| R7 | Any viewport, wide content | Tables, code blocks and evidence rows scroll inside their own `overflow-x` container; the body never scrolls horizontally |

---

## 8. The fifteen-second comprehension test

Run only after sections 1 to 7 pass. Protocol from `03` section 4.

**Recruit** five people who have not seen FleetScope, at least two of whom do not
write software. A judge at a demonstration is closer to the second group.

**Set up** one screen at 1440x900, Story Mode, `completed`. Scrolling disabled.
The participant may not click.

**Say**, verbatim:

> "You are about to see one screen for fifteen seconds. You cannot scroll or
> click. Afterwards I will ask you five questions. There are no wrong answers and
> I am testing the screen, not you."

Show the screen for exactly 15 seconds, replace it with a blank neutral surface,
then ask the five questions in order. Record answers verbatim. Do not paraphrase
an answer back, do not repeat a question with different words, and do not answer
a question with a question.

| Q | Question | Passes on | Fails on | Threshold |
|---|---|---|---|---|
| Q1 | What just happened? | Any answer containing a failure and a recovery, in either order | "it worked", "it loaded", "it ran a test" | 4 of 5 |
| Q2 | Was that real, or a recording? | "real" or "live" | "recording", "not sure", any hedge | 4 of 5 |
| Q3 | Did anything go wrong? If so, was it an accident or on purpose? | "on purpose", "deliberate", "by design" | "it broke", "a bug", "an error" | 4 of 5 |
| Q4 | If you could press one thing, what would you press? | Naming the primary action, in any words | Naming any other element, or "I do not know" | 4 of 5 |
| Q5 | How many agents were involved, and did any of them hand work to another? | "it does not say", "unknown", "it would not tell me" | **Any number, and any claim that one agent handed work to another** | **5 of 5** |

One row below threshold fails the whole test, not part of it.

**Q5 is inverted on purpose and it is the sharpest criterion here.** Every other
question rewards the participant for knowing something. Q5 rewards them for
correctly not knowing. A participant who says "two agents, one handed off to the
other" has been misled by the page, and it does not matter whether the page said
so in words or implied it with a graph, an arrow, or two marks side by side. A
design that scores well on Q1 through Q4 and fails Q5 is worse than the shipped
page, which passes Q5 today.

---

## 9. What voids the gate

Regardless of every other score.

1. **A participant describes the screen unprompted as a dashboard, a monitor, or
   logs.** The review's second complaint has reappeared.
2. **Any string on screen cannot be traced to a canonical event field or an API
   field.** Ask the implementer to name the field. If they cannot, the string
   comes out. **This applies to strings the pack itself blessed.** The
   `completed` sentence was carried verbatim through four documents and asserts
   an `incident` and an `intervention` that its own entry condition does not
   require (`10` D43), and it survived because being approved read as being
   entitled. A blessing is not a field.
3. **Any existing check in `scripts/qa-live.ts` was edited or deleted.**
4. **`apps/web/src/styles/global.css` was modified.**
5. **Any file outside the scope in `11` was modified without approval.**
6. **The delegation string was shortened, softened, paraphrased, or replaced with
   `No delegation`.** The last one is the worst, because it claims an
   observation.
7. **Any element renders a hue with no word.**
8. **A run that produced eight events renders any number other than eight
   anywhere it renders a count of events.** Counted from `events.length`, never
   from `#live-cursor` or `highWaterMark`, which are a cursor and can legitimately
   exceed the count (`10` C34).
9. **A recorded transcript is presented in a way indistinguishable from a live
   run**, including by autoplay.
10. **A participant asks to scroll before the 15 seconds elapse.** Record it: the
    fold is in the wrong place. This is a defect rather than a void, but it must
    be recorded and fixed before a second run of the test.

---

## 10. Sign off

Record the observation, not the verdict. A reviewer reading this later needs to
know what was seen.

| Section | Observation | Reviewer | Date |
|---|---|---|---|
| 1. The six rejections | | | |
| 2. Honesty | | | |
| 3. The nine screens | | | |
| 4. Machine preconditions | | | |
| 5. The suites | | | |
| 6. Accessibility | | | |
| 7. Responsive | | | |
| 1a. Expert, counted | | | |
| 8. The fifteen-second test | | | |
| 2a. Blocked items | list which remain blocked and why | | |
| 9. Void conditions | none observed / listed | | |

The gate passes when every row is filled, no void condition was observed, and
every threshold in section 8 was met. A blocked item in section 2a is not a pass
and not a failure: it is recorded as blocked, with the deferred work that would
unblock it, so the next reviewer knows the difference between an item that was
checked and an item that could not be.
