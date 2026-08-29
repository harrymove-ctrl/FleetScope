# CASE-1042 Story Mode — implementation plan

Status: Golden Path and Guided Tour implemented; selection mapping and topology sync deferred

Last updated: 2026-08-29

Owning route: `/cockpit/CASE-1042`. This plan does not change `/viewer`'s
claims, wording, or adapter.

## Why this exists

The Cockpit today opens on the renderer: a graph, a timeline, an evidence rail
and a drawer. That surface answers "what is in the recording" for someone who
already knows the vocabulary. It does not answer "what happened, and how do you
know", which is the question a procurement reviewer actually arrives with.

Story Mode answers that question first, and every claim it makes has to be
traceable to a canonical event. The failure mode this plan is written against
is a governance dashboard that reads as *satisfied* because a control was
configured, when the recording never shows that control acting.

## Two modes, one cursor

| | Story Mode | Expert Mode |
|---|---|---|
| Default | yes | no, disclosed on demand |
| Answers | what happened and how do you know | where exactly, in the recording |
| Surface | outcome, four proof cards, chapters, narrative | graph, timeline, topology, evidence rail, drawer |
| Renderer | none | the existing Rust/WASM Cockpit renderer |

There is exactly **one Event Cursor**, expressed as a canonical `caseSequence`.
Story cards, chapters, the timeline, the graph, the topology, the evidence rail
and the drawer are all views of it. Switching modes never moves it.

Expert Mode is the existing experience, unchanged in substance. It mounts only
after its canvas is visible and measured, and it preserves the Case cursor when
opened and when closed.

## Information order

Fixed, top to bottom:

1. Case header — identity, vendor, milestone, runtime state
2. Recorded-mode label
3. Outcome and summary
4. Four governance proof cards
5. Story chapters
6. Problem / action / result narrative
7. "Open Expert Mode"

The recorded-mode label sits above the outcome deliberately. A reader who takes
one thing from the page must not take away that this is live.

## URL contract

```text
?mode=story|expert&event=<caseSequence>
```

- `mode` absent or unrecognised → Story Mode.
- `event` absent, non-numeric, negative, or beyond the recording → the latest
  canonical event.
- Both fall back independently: a bad `mode` does not discard a good `event`.
- The URL is updated on card and chapter activation, on mode switch, and on
  renderer-driven cursor changes, so a reload restores the same position.

`caseSequence` is the only cursor vocabulary in the URL. Renderer entry indices
and event IDs are not URL state: one is an implementation detail of the fold,
the other is not ordered.

## Card states

The shared card contract gains two states and three identity fields.

| State | Meaning |
|---|---|
| `evidenced` | The complete required event chain exists in the recording. |
| `absent` | Canonical evidence loaded successfully, and the chain is not there. |
| `unavailable` | Evidence or projection could not load. Nothing is known either way. |
| `unsupported` | The adapter cannot evaluate this capability under the loaded schema. |

New fields: `primaryCaseSequence`, `evidenceEventIds`, and optional
`agentInstanceId`.

`absent` and `unavailable` are different answers and must not be collapsed. "We
looked and it is not there" and "we could not look" lead a reviewer to
different actions.

**An evidenced card replaces its matching non-evidenced card in the same slot.**
The two states never coexist. There are four fixed slots; each renders exactly
one card.

## CASE-1042 evidence mapping

Verified against `packages/fixtures/cases/CASE-1042/canonical-events.jsonl`,
60 events, `caseSequence` 0 through 59.

| Capability | Required proof | Expected primary event |
|---|---|---|
| Input screening | `armor.blocked` followed by matching `memory.rejected`; no downstream tool or memory write for that input | `evt-0016`, sequence 15 |
| Warden recovery | Repeated failures, incident, `auto_act` policy, complete intervention lifecycle, and resolved incident | `evt-0031`, sequence 30 |
| Runtime recovery | Runtime applied the intervention, intervention succeeded, retry succeeded, incident resolved as recovered | `evt-0036`, sequence 35 |
| Vendor activation | Approval opened and approved, activation request references approval, identity allowed, activation succeeded | `evt-0053`, sequence 52 |

### The chains, event by event

**Input screening** — primary `evt-0016`, sequence 15.

| Seq | Event | Why it is required |
|---|---|---|
| 15 | `evt-0016` `armor.blocked` | The screening decision. `screenedInputId: input-101`. |
| 17 | `evt-0018` `memory.rejected` | The consequence, correlated by the same `screenedInputId`. |

Between them sits `evt-0017` `incident.opened` (`inc-001`, advisory), which is
neither a tool request nor a memory write, so the "nothing downstream ran for
that input" rule holds. The card is `absent` if any correlated `tool.requested`
or `memory.written` appears between the block and the rejection: a block that
did not stop the work is not a screening success.

**Warden recovery** — primary `evt-0031`, sequence 30.

| Seq | Event | Why it is required |
|---|---|---|
| 24, 26, 28 | `evt-0025`, `evt-0027`, `evt-0029` `tool.failed` | Three failures of the same tool, `Logistics.leadtime.check`, agent `agent-logistics-1`. |
| 29 | `evt-0030` `incident.opened` | `inc-002`, `repeated_tool_failure`. |
| 30 | `evt-0031` `policy.evaluated` | `disposition: auto_act`. This is the moment the Warden was permitted to act. |
| 31, 32, 33 | `evt-0032`, `evt-0033`, `evt-0034` | `itv-001` proposed, authorized, requested. |
| 34 | `evt-0035` `intervention.acknowledged` | The Runtime accepted it. |
| 39 | `evt-0040` `incident.resolved` | Terminal evidence. |

The primary destination is the policy evaluation, not the incident: the claim
is that a policy authorized an action, and that is where a reviewer verifies it.

**Runtime recovery** — primary `evt-0036`, sequence 35.

| Seq | Event | Why it is required |
|---|---|---|
| 35 | `evt-0036` `runtime.controlled` | `result: applied`. |
| 36 | `evt-0037` `intervention.succeeded` | `authoritativeResult: applied`. |
| 38 | `evt-0039` `tool.succeeded` | The retry actually worked, `tc-013`. |
| 39 | `evt-0040` `incident.resolved` | `resolution: recovered`. |

A Runtime action with no subsequent progress is `absent`. "The retry was
applied" is not "the agent recovered".

**Vendor activation** — primary `evt-0053`, sequence 52.

| Seq | Event | Why it is required |
|---|---|---|
| 44 | `evt-0045` `human_escalation.opened` | `apr-001`. |
| 46 | `evt-0047` `human_escalation.resolved` | `decision: approved`. |
| 51 | `evt-0052` `tool.requested` | `ERP.vendor.activate`, carrying `approvalId: apr-001`. |
| 52 | `evt-0053` `identity.allowed` | Correlated by `toolCallId: tc-021`. |
| 53 | `evt-0054` `tool.succeeded` | `vendor activated`. |

Approval without a referencing activation is `absent`. Activation without an
approval is `absent`, and is the more serious of the two.

### Sequence numbering

`caseSequence` is **0-based**: `evt-0001` is sequence 0, so `evt-NNNN` is
sequence `NNNN - 1`. An earlier draft of this brief gave the Warden, Runtime and
activation destinations as 31, 36 and 53, which are the 1-based ordinals of the
same events. The table above uses `caseSequence`, which is what the URL, the
adapter and the renderer all speak. Any document quoting 31/36/53 for those
three is off by one.

### What these claims are not

- **Valid only for the recorded CASE-1042 fixture.** They are statements about
  one recording, not about the product's capabilities in general.
- **Configuration is not evidence.** A policy being installed, a scanner being
  enabled, or a role existing proves nothing. Only events prove.
- **A missing chain renders `absent`, never successful.**
- **A failed evidence load renders `unavailable`**, which is not `absent`.
- **An unknown capability or unsupported schema renders `unsupported`.**
- **`/viewer` remains a local-session observer** and must not inherit any of
  these claims. Its adapter, disclosure and wording stay as they are.

### Also to be represented honestly

The recording contains failures that the narrative must not smooth over:

- Three `Logistics.leadtime.check` timeouts, sequences 24, 26 and 28.
- A human approval wait: `runtime.waiting` at sequence 45, resolved at 46.
- `gateway.denied` at sequence 48 and `identity.denied` at sequence 50, two
  refusals before the activation that succeeded.

Chapters and narrative describe these as what they were. Never describe an
approval, recovery, activation, Warden action, or screening result from
configuration alone.

## The judge Golden Path — IMPLEMENTED

The first delivery is one polished path a reader can walk in under a minute
without opening the graph:

```text
Open CASE-1042 → read the outcome → click a claim → see the exact evidence
```

The four cards carry plain-language claims, in fixed slots:

1. Input screened before it reached the agent
2. Bounded retry recovered the logistics check
3. Runtime applied the authorized recovery
4. Vendor activation completed under approval

Each has a state badge, an explanation, "View evidence" (seek + drawer) and
"Show in Expert Mode" (seek + reveal the renderer).

### The Proof Path

`Delegate → Remember → Screen → Recover → Approve → Activate`, above the cards.
Native buttons; a reached step carries its canonical anchor, an unreached step
carries none.

**Canonical chronological order**, matching the recording: sequences 3, 10, 15,
35, 44, 52.

An earlier version of this document specified `Screen → Remember → Delegate`,
ordered by narrative appeal because screening is the most striking control. That
was wrong. The path is drawn as a connected left-to-right sequence, and a
connector reads as "this happened, then this", so the display order is itself a
claim about time. A test now asserts the anchors are strictly increasing.

The active-step rule stays chronological — the reached step with the greatest
anchor at or before the cursor, never the last one in display order. Display and
chronology now agree, and that rule is what keeps them from silently diverging
if anyone re-orders for storytelling again.

The Proof Path and the Guided Evidence Tour are specified in full in
[case-1042-guided-tour-plan.md](case-1042-guided-tour-plan.md), which supersedes
this section.

### Two defects the unit tests could not have found

| Defect | Why it mattered |
|---|---|
| `identity.allowed` first occurs at sequence 7, for a routine read 45 events before the activation. Anchoring "Activate" to the first event of that type put the step, and the cursor behind it, in the wrong part of the run while looking entirely plausible. | Found by clicking the path in a browser. |
| `mount()` and the Story panel's script are both modules with no guaranteed order. When the renderer ran first the mode attribute was still absent, the gate resolved immediately, and the five-second measured-host wait expired against a `display: none` canvas — the blank-grid failure the gate exists to prevent. | Found by opening Expert Mode *slowly*, past the five-second bound. The gate now reads the server-rendered panel instead of an attribute a script has to set. |

### Deferred, deliberately

Reverse canvas-node selection, topology filtering, richer animation, React Bits,
provider/cloud work, and Slice J. None of them block a judge understanding the
Case.

## Chapters

Start, Screening, Memory, Delegation, Failure, Recovery, Approval, Activation,
Result.

A chapter appears only when its predicate resolves to canonical evidence. An
empty chapter is omitted, not shown greyed out: a disabled chapter still
advertises that the concept applies to this Case.

## User flow

1. Open `/cockpit/CASE-1042`.
2. See Case identity, vendor, milestone, runtime state, and the recorded-mode
   label.
3. Read the Story outcome and summary.
4. Review the four governance proof cards.
5. Select a card or chapter.
6. The Case Cursor seeks to its canonical event.
7. The timeline, graph, topology, evidence rail and active chapter update.
8. Open Decision Evidence for exact IDs, policy, actor, result and provenance.
9. Switch to Expert Mode without losing cursor or selection.
10. Return to Story Mode with the same historical position preserved.
11. Use "Return to live" only when new events exist and the reader is behind the
    high-water mark.

Selecting a card seeks. It does **not** force the drawer open. A separate "View
Decision Evidence" action opens the drawer, because a reader scanning four cards
should not have a panel thrown at them four times.

## Selection synchronization

One controller. Card, chapter, topology and timeline actions seek by
`caseSequence`. An optional agent selection then focuses the mapped graph node.
Renderer snapshot changes flow back through `fleetscope:cursor`.

The manifest gains an additive mapping from canonical `agentInstanceId` to
renderer node id, including the main/root node. `fleetscope_select` stops being
centre-only and returns `selected | deselected | unknown`, alongside
clear-selection and graph-node listing.

**Renderer hashes and `main` must not escape the Rust/compiler boundary.** This
is the same rule the Agent Viewer already keeps: `/viewer` learned it the hard
way when the root agent's node was called `main` and its rail control was
therefore disabled, making the largest agent in the session unreachable. See
`crates/agent-viewer-render/src/selection.rs`.

Escape clears node selection without moving the Event Cursor. Seeking a
capability that has no agent node updates the evidence rail and does **not**
fabricate a graph selection. The inspector never shows one agent's evidence
under another agent's selection.

## Expert Mode lifecycle

Do not initialize WASM against a hidden zero-width canvas. Reveal Expert Mode,
run the existing wall-clock measured-host wait, then import and mount.

The five-second wall-clock readiness bound stays, and stays wall-clock:
`requestAnimationFrame` does not fire in a hidden tab, so a frame-counted bound
would never expire there and the page would hang at "Loading" instead of
degrading. The positive canvas-dimension checks stay too. Browser QA once passed
95/95 with a blank graph on both routes because it only asserted the `<canvas>`
element existed.

Reopening Expert Mode reuses its cursor and selection. If the viewport changed
while it was hidden, remount or resize only after the host is measurable again.

## Responsive layout

| Width | Expert layout | Story cards |
|---|---|---|
| 1440×900 | three columns | four columns |
| 1280×720 | graph before stacked evidence rails | two columns |
| 1180×800 | graph before stacked evidence rails | two columns |
| narrower | stacked | one column |

Chapters scroll horizontally without wrapping. No body overflow at any of the
three supported widths.

## Motion and accessibility

Motion is limited to short opacity and position transitions. Under reduced
motion, state switches immediately.

Cards and chapters are native `button` elements. Story/Expert controls carry
`aria-current`. Focus is visible, and survives rerender — the rail and timeline
update in place rather than rebuilding, because rebuilding destroyed the focused
control once a second on `/viewer` and left the keyboard user pressing Enter
into `<body>`.

Cursor changes are announced politely, for example
"Event 37 of 60: Runtime applied retry."

The drawer traps focus while open and restores it to the control that opened it.

## Required tests

**Adapter, pure, no DOM:**

- CASE-1042 shows all genuinely evidenced cards.
- Removing each required event chain flips exactly that card to `absent`, one
  fixture-removal test per chain.
- Mismatched IDs break a chain: a `memory.rejected` for a different
  `screenedInputId`, an intervention whose `interventionId` does not match its
  incident.
- An incomplete intervention lifecycle is `absent`.
- Approval without activation, and activation without approval, are both
  `absent`.
- A Runtime action with no subsequent progress is `absent`.
- An evidence load failure produces `unavailable`, not `absent`.
- An unsupported capability produces `unsupported`.
- An evidenced card *replaces* its absence card rather than coexisting with it.
- `/viewer` still cannot claim enterprise controls: `story.test.ts` passes
  unchanged.

**Browser, at 1440×900, 1280×720 and 1180×800:**

- Card and chapter activation seeks to the correct canonical sequence.
- Story → card → Expert Mode → evidence rail and drawer stay synchronized.
- Story and Expert Mode preserve cursor state across the switch and back.
- Graph selection maps to canonical agent instance ids.
- The inspector never displays another agent's event.
- Mouse, Enter and Space all activate; Escape clears selection.
- Focus survives rail updates.
- Drawer focus trap and restore.
- Screen-reader names are present and specific.
- Reduced motion disables transitional animation.
- Recorded/history wording is present; nothing claims live execution.
- No body overflow, positive canvas dimensions, zero console errors.
- URL restores mode and cursor on reload.

**Every important browser assertion must be intentionally broken once and
observed failing**, then restored. The list of breaks to perform:

1. one capability predicate;
2. absence-card replacement;
3. chapter seeking;
4. Story/Expert cursor preservation;
5. canonical-to-renderer agent mapping;
6. evidence-rail synchronization.

Record the expected failing assertion for each. A green suite is necessary, not
sufficient: this suite has twice reported all-green while the thing under test
was completely broken, once with a blank graph and once with graph selection
that did nothing.

## Validation

```text
pnpm check
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo fmt --all -- --check
NO_COLOR=1 pnpm build:wasm
pnpm qa:browser
git diff --check
```

Run before changes to confirm the baseline, and again after. Exit only when all
gates pass, every new interaction has been observed failing under an intentional
break, and manual browser verification covers all three widths.

## Implementation order

1. Enterprise evidence adapter, with its tests.
2. Shared Story presentation reused on the Cockpit route.
3. Evidenced-card replacement tests.
4. Story and chapter seeking through canonical `caseSequence`.
5. Synchronize cards, timeline, evidence rail, drawer, topology and graph.
6. Canonical agent-to-renderer selection mapping.
7. Story/Expert mode state and URL persistence.
8. Responsive and accessibility behavior.
9. Browser regression tests, each proven to fail when broken.
10. Documentation and tracking records.
11. Slice J: comprehension testing with five real people. Not simulated.

## Non-goals

- No further `/viewer` polish, React Bits integration, provider or cloud work.
- No live-execution claims, and no new memory integration.
- No chain-of-thought, secrets, credentials, raw vendor content, or unredacted
  tool arguments.
- Evidence is never inferred from visual position, timestamps, service
  configuration, or copy.

## Accepted limitations

- Every claim here is scoped to one recorded fixture. Nothing generalises to
  other Cases until an adapter is run against them.
- The adapter reads canonical events and projected Case state only. It does not
  read the evidence manifest, the graph, or any DOM copy, so a capability that
  is real but unrecorded reads as `absent`. That is the intended bias.
- Slice J comprehension testing is the only evidence that the Story actually
  communicates. Until it runs, the claim is that the page is *accurate*, not
  that it is *understood*.
