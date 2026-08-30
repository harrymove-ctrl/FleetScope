# Story Mode wireframes

Phase 5. Nine screens, drawn in monospace, with the copy each one shows and the
review's acceptance questions answered per screen.

## Why this document exists

Phases 0 to 4 decided what Story Mode may contain, in what order, and which
states exist. None of them drew anything. This document is the first artifact
where a layout can be checked against those decisions instead of described, and
the checking is the point: the rejected prototype satisfied every prose
requirement anyone wrote for it and still failed, because nobody counted its
regions until it existed.

Everything here is **grayscale**. No hue is chosen, named, or implied. Where a
hue will later carry meaning the wireframe reserves a position and names the
meaning, never the colour. That is a deliberate sequencing choice: phase 1
measured the rejected artifact at 28 colour tokens out of 36, and concluded that
replacing all 23 of its hex values would leave every structural failure intact.
If the layout does not work in grayscale it does not work, and adding colour
afterwards would only hide that.

## 0. What this document decides, and what it inherits

**Inherited and not reopened.**

1. The reading order and the three region budget, from `03-information-hierarchy.md`.
2. The twelve states, their headlines, sentences and conditions, from `04-state-model.md`.
3. The Story exclusion list, from `03` section 5.
4. The type ladder 36 / 21 / 15 sans then 12.5 / 11 mono, from `02-reference-matrix.md` section 3.

**Decided here.**

1. Where region A, B and C sit relative to each other, which `03` section 7 item 1 left open.
2. What the five step causal path looks like as a drawn object, in each of its reachable configurations.
3. Which elements are visible per state and which are attached but not rendered.
4. The exact visible word count per screen, measured rather than asserted.
5. Three conflicts between phase 3 and phase 4, resolved in section 8.

**Still not decided.** Any hex value. Any font file. Any spacing value in pixels
beyond the two rhythm figures the chassis needs to be drawable. Expert Mode.

## 1. Notation

The wireframes use a fixed vocabulary. Nothing in them is decorative.

### 1.1 The causal path

Five steps, in the order `state.ts:126-132` defines them, with the canonical
event that alone may mark each one reached.

| Step | Marks reached only when this event exists |
|---|---|
| Start | `run_start` |
| Governed read | `tool_call` |
| Controlled Fault | `incident` |
| Warden retry | `intervention` |
| Result | `run_end` |

Markers:

```
  ●   reached: the canonical event for this step exists
  ○   not reached: no such event, and no claim either way
  ◇   decided but not performed: an intervention exists and refused the retry
  ◉   the replay playhead is on this step
  ─   both ends reached
  ┄   the later end is not reached
```

`◇` is new and section 8.3 explains why it has to exist. Every marker is a
shape, not a hue, so the path survives a forced colours rendering and a
grayscale print unchanged. Each marker also carries a visually hidden status
word so a screen reader gets the same five facts a sighted reader gets from
shape alone.

### 1.2 Regions and rules

```
  A ┆   region A, Verdict:  truth, outcome, incident or result
  B ┆   region B, Progress: the five steps, the topology line
  C ┆   region C, Action:   the one thing the reader can do
```

The `┆` gutter is **an annotation, not a drawn element**. It exists so a reader
of this document can see which region a line belongs to. In the rendered page
there is no rule, no border and no background there: the regions are separated
by vertical space and nothing else.

Where a hairline genuinely is drawn, the wireframe shows `─────`. Phase 3
allowed at most two per region, six in total. These wireframes spend **one**, on
the page chrome, and none inside the story body. The rejected prototype spent
31.

### 1.3 Type and emphasis, in grayscale

```
  <36>   sans, the headline. One per screen. This is the focal point.
  <21>   sans, the current sentence.
  <15>   sans, secondary prose: the incident reason, a blocked reason.
  <12.5> mono, evidence-adjacent labels: the five step labels.
  <11>   mono, the truth chip and the topology line.

  ▮▮▮    a filled control: the primary action
  ▯▯▯    an outlined control: a secondary action
  ░░░    a control present but disabled
```

Filled, outlined and disabled are weight and tone, not hue. The primary control
is the only filled object on any screen.

### 1.4 Reserved meaning slots

Each screen ends with a one line note naming which positions will later carry a
hue, by **meaning**. No colour is chosen. The four meanings, from the locked
direction, are: selection or primary action; run liveness; Warden; Controlled
Fault. Phase 3 section 3.3 proved at most three of the four can coexist, so a
screen naming three slots is at budget and a screen naming four is a defect.

## 2. The chassis

Every screen below is this chassis with different content. Drawing it once is
the mechanism that keeps nine screens from becoming nine layouts.

```
 ┌────────────────────────────────────────────────────────────────────────────┐
 │  FleetScope    Live recovery demo                        Story  |  Expert  │  page chrome
 └────────────────────────────────────────────────────────────────────────────┘
                                                          ^^^^^^^^^^^^^^^^^^
                                                          the only control
                                                          outside the story body

      measure cap 720px, and every line of prose stops before it
      |                                                        |
  A ┆ <11>   TRUTH CHIP
  A ┆
  A ┆ <36>   Headline
  A ┆
  A ┆ <21>   The current sentence, at most twenty words, wrapping
  A ┆        inside the measure and ending well short of the viewport.
  A ┆
  A ┆ <15>   The incident or the result, when the sentence does not
  A ┆        already carry it.
    ┆
    ┆        ( vertical space. no rule, no border, no background. )
    ┆
  B ┆ <12.5> the five step path
  B ┆ <11>   the topology line
    ┆
    ┆        ( vertical space. )
    ┆
  C ┆        ▮▮ primary ▮▮    ▯ secondary ▯
    ┆
    ┆
    ┆        below and to the right of this point, nothing is painted.
    ┆        at 1440x900 with a 720px measure that is more than half
    ┆        the surface, against the rejected artifact's zero.
```

Three properties of the chassis are load bearing.

1. **Region A is first and the action is last.** This corrects a shipped defect:
   `apps/web/src/pages/live.astro` puts `.live__actions` at line 26 and
   `#live-sentence` at line 37, so today the button precedes the verdict in both
   the document and the render.
2. **The headline is the only 36px object.** Phase 2 measured the rejected
   artifact's smallest adjacent type ratio at 1.08, which no reader perceives as
   a level. The ladder here steps 36 to 21 to 15, ratios of 1.71 and 1.40, so
   the focal point is decided by size before anyone reads a word.
3. **The regions are separated by space, not by frames.** Phase 1 counted 84
   drawn border edges on the rejected artifact against 8 on the shipped page.
   These wireframes draw one.

### 2.1 The narrow chassis, 480x900

Browser QA asserts zero horizontal overflow at 480px, so the narrow form is a
contract and not a courtesy.

```
 ┌──────────────────────────────────┐
 │ FleetScope        Story | Expert │
 └──────────────────────────────────┘

  A ┆ <11>   TRUTH CHIP
  A ┆ <32>   Headline
  A ┆ <19>   The current sentence,
  A ┆        wrapping.
    ┆
  B ┆ ● Start
  B ┆ ● Governed read
  B ┆ ● Controlled Fault
  B ┆ ● Warden retry
  B ┆ ● Result
  B ┆ <11> external_agent
  B ┆ <11> Delegation: Unknown /
  B ┆      not observable in this
  B ┆      runtime
    ┆
  C ┆ ▮▮ primary ▮▮
  C ┆ ▯ secondary ▯
```

The path stacks. It does not scroll sideways, it does not truncate a label, and
it does not drop a step. Every screen below is drawn wide; the narrow form is
this transformation applied to it, and section 7.3 records the one screen where
the transformation needs a second look.

## 3. The nine screens

Each screen gives the wireframe, then the six required fields, then the review's
acceptance questions. Word counts are whitespace separated tokens containing at
least one alphanumeric character, counted on the **visible** text only, which is
the same method phases 0 to 3 used.

Three of phase 4's twelve states are not drawn separately, and each for a stated
reason. `unavailable` renders the chassis with region A alone and regions B and C
empty, which is the two region case already drawn in 3.3. `starting` is `ready`
with the CTA switched to `░░░ Run live recovery demo ░░░` and a busy indication in
place, and it is the one motion exception in the whole model, bound to the `POST`
promise rather than to a render. `incident` is described under 3.4, because a
screen that differs only in copy is not a second wireframe.

---

### 3.1 `ready`

```
 ┌────────────────────────────────────────────────────────────────────────────┐
 │  FleetScope    Live recovery demo                        Story  |  Expert  │
 └────────────────────────────────────────────────────────────────────────────┘

  A ┆
  A ┆ <21>   Ready
  A ┆
  A ┆ <21>   One button starts one fixed scenario. Nothing else can
  A ┆        be run from here.
    ┆
    ┆
  B ┆ ○┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄○┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄○┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄○┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄○
  B ┆ Start             Governed read     Controlled Fault  Warden retry      Result
    ┆        ^ all five drawn, none reached. this is the contract
    ┆          being previewed, not progress being claimed.
    ┆
    ┆
  C ┆ ▮▮▮ Run live recovery demo ▮▮▮
    ┆
    ┆
    ┆        attached, not rendered: #live-delegation, #live-agent,
    ┆        #live-incident, #live-policy, #live-result, #live-cursor,
    ┆        #live-budget, #live-replay, #live-replay-note, .live-beat__seq
```

| Field | Value |
|---|---|
| Headline | `Ready` |
| Current sentence | `One button starts one fixed scenario. Nothing else can be run from here.` **Rewritten by `10` D45**, because `admits` is FleetScope's admission control verb and the sentence never said what the button would do. |
| Visible truth label | **None.** A truth label describes how a record was produced and no record exists. Rendering `Unknown` here would suggest something was attempted and could not be classified. |
| CTA labels | Primary: `Run live recovery demo`. No secondary. |
| Visible words | 1 headline + 13 sentence + 8 step labels + 4 CTA = **26** (D45 replaced the 12 word sentence) |

**After five seconds a stranger can answer:** nothing has run yet, there is
exactly one thing to press, and it will do one fixed thing rather than whatever
I type.

**Acceptance questions.**

1. *One focal point?* **Decided in `10` D41 rather than deferred to a user test.**
   The draft above claimed the CTA is focal while section 2 property 2 puts the
   only 36px object on the page in the headline, which is two focal objects on
   the pack's own definition and is `12` S1's stated failure condition. D41 rules
   that on `ready` variant A the headline renders at the 21px step, so the filled
   CTA is the only high salience object and the focal point is unambiguous. The
   reason it is safe here and nowhere else: `Ready` is a single word that repeats
   what the sentence already says, and this is the one screen with no outcome for
   a headline to report. Variant B keeps the headline at 36px, because
   `Cannot run here` is the outcome and its CTA is disabled and therefore
   unfilled. Word count is unchanged at 25.
2. *At most three actions?* Two visible, two available: the CTA and the mode
   switch. Region C holds one control.
3. *Will a user understand "Controlled Fault"?* **Partially, and this is
   accepted.** They see the words on an unreached step and learn the run intends
   to produce one; they cannot yet know it is deliberate. The alternative,
   hiding the step until its event lands, would turn the path into a bar that
   grows and would conceal the contract the screen exists to preview. The risk
   is that a reader leaving at `ready` reads it as a warning, and the mitigation
   is that the marker is `○` and the sentence says the scenario is fixed.
4. *Could a user confuse replay with live?* No. There is no truth chip, no
   evidence, no replay control, and no run.
5. *Could a user believe the Warden acted beyond policy?* No. The Warden step is
   `○` and nothing about it is claimed.

*Reserved meaning slots: primary action (region C). One of four, well inside
budget.*

**Variant B, refused.** Same chassis. Headline becomes `Cannot run here`, the
sentence becomes one of the two exact strings at `state.ts:218-220`, and the CTA
renders `░░░ Run live recovery demo ░░░`, present and disabled, so a reader
looking for the button finds it beside the reason rather than wondering where it
went. See 3.8 for the case where that deployment also has evidence to offer.

---

### 3.2 `awaiting_agent`

Phase 4 section 2 established that on the MCP path this is where a judge spends
the entire middle of the demo, because there is nothing between here and
`completed`. It gets the most space of any screen and the least furniture.

```
 ┌────────────────────────────────────────────────────────────────────────────┐
 │  FleetScope    Live recovery demo                        Story  |  Expert  │
 └────────────────────────────────────────────────────────────────────────────┘

 ┌────────────────────────────────────────────────────────────────────────────┐
 │  FleetScope   Live recovery demo   run 019f3c2a          Story  |  Expert  │
 └────────────────────────────────────────────────────────────────────────────┘

  A ┆ <36>   Your turn
  A ┆
  A ┆ <21>   FleetScope holds no model credential, so the next move
  A ┆        is yours.
  A ┆
  A ┆ <15>   Your Gemini/Antigravity agent is ready to call FleetScope.
  A ┆ <15>   FleetScope is governing the tool and recovery policy.
  A ┆
  A ┆ <12.5 mono>  Use the fleetscope tool read_repository_metadata
  A ┆              on google/adk-python
  A ┆
  A ┆ <15>   If your agent never calls, this run stays open and a new
  A ┆        one will be refused.
    ┆
    ┆
  B ┆ ○┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄○┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄○┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄○┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄○
  B ┆ Start             Governed read     Controlled Fault  Warden retry      Result
    ┆
    ┆
  C ┆ ▮▮▮ Copy prompt ▮▮▮
    ┆
    ┆
    ┆        no motion of any kind. no pulsing mark, no animated ellipsis,
    ┆        no fake typing. nothing is working: a human is typing in
    ┆        another window, and the screen is exactly that patient.
    ┆
    ┆        no chip: no event exists yet (C1). no topology line, for the
    ┆        same reason (D40). attached, not rendered: #live-start
    ┆        (disabled), #live-delegation, and every field listed in 3.1.
```

The mono line is a **prompt for a person to paste into their own agent**, not a
shell command. It carries no `$`, no prompt glyph, no window frame and no traffic
light dots. Phase 2 rejected all of those; a mono line alone in space already
says terminal. C11 replaced the earlier invocation-shaped string with this
natural language one, because MCP tools are invoked by the agent and never typed,
so a command shaped string would be a fabricated fact.

The drawing above is the redrawn one. C12 moved the run id into the command bar
and C27 moved the prompt and the dead end note out of region C into region A, so
region C holds one control and nothing else.

| Field | Value |
|---|---|
| Headline | `Your turn` |
| Current sentence | `FleetScope holds no model credential, so the next move is yours.` |
| Visible truth label | **None. Superseded by `10` C1.** The run is admitted and no event exists, so there is no record to describe. A `Live` chip here is a hopeful default. |
| CTA labels | Primary: `Copy prompt`, acting on the region A prompt line (C11). No secondary. `#live-start` is attached and not rendered, because a disabled control the reader never pressed is noise. |
| Visible words | **Superseded by `10` C12, which is the authoritative count: 63, against a budget of 62, granted as a stated exception.** The 44 here predates the natural language prompt, the dead end note and the `Copy prompt` label. No chip, no run id and no topology line are counted, because none renders on this screen. |

The two 15px lines are `AWAITING_AGENT_LINES` verbatim. They are asserted by
string at `scripts/qa-live.ts:213-214` and cannot be reworded, shortened or
merged. Section 8.1 records why the 21px sentence above them is not the one
phase 4 proposed.

**After five seconds a stranger can answer:** FleetScope is waiting for me, the
next move happens in my own terminal, and here is the exact thing to call.

**Acceptance questions.**

1. *One focal point?* **Superseded by `10` C12 and C27.** The draft above made a
   mono block the focal object of a Story screen, which runs against `03`
   section 5 and against `12` G2.1, and it put four items in region C, three of
   which are not the action, against `03` section 3.1's definition of region C.
   C27 moves the prompt block and the dead end note into region A, where they
   belong as the instruction and as a statement about the run, and leaves region
   C holding `Copy prompt` alone. The focal point is then the 36px headline
   `Your turn`, with no exception needed. The prompt stays mono because it is
   evidence of what will be copied; it is no longer the largest thing on screen.
2. *At most three actions?* Two visible, two available: `Copy prompt` (C11) and
   the mode switch. There is deliberately no cancel, because no abandon endpoint exists
   and a control that appears to cancel and does not would be worse than the
   dead end it pretends to fix.
3. *Will a user understand "Controlled Fault"?* Not yet, and nothing on this
   screen claims one. Same reasoning as 3.1.
4. *Could a user confuse replay with live?* No. **Amended by `10` C1 and D40:**
   there is no chip on this screen at all, because no event exists yet. There is
   also no evidence on screen and no replay control, so nothing to confuse.
5. *Could a user believe the Warden acted beyond policy?* No. The Warden step is
   `○`.

*Reserved meaning slots: primary action (the `Copy prompt` control). One of four,
after C1 removed the chip.*

**The honest dead end.** If the agent never calls, the run stays admitted
forever: there is no timeout on the MCP path, and `run_already_active`
(`admission.ts:29`) will refuse every subsequent start. This screen must say so
in words rather than offer a button that cannot deliver. The wording is settled
in `10` C12 at sixteen words and it renders in region A, because it is a
statement about the run rather than something the reader can do.

---

### 3.3 `running`

Unreachable on the MCP path, per phase 4 section 2: `handle_call`
(`mcp_server.py:336`) publishes all eight events in one POST, so the reader goes
`awaiting_agent` to `completed` in a single 400ms tick. This screen exists for
the worker driver and for a stepped replay, and it is designed economically for
that reason.

```
  A ┆ <11>   Source: live
  A ┆
  A ┆ <36>   Reading
  A ┆
  A ┆ <21>   The governed read returned; the run is still under way.
    ┆
  B ┆ ●─────────────────●┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄○┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄○┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄○
  B ┆ Start             Governed read     Controlled Fault  Warden retry      Result
  B ┆ <11>   external_agent · Delegation: Unknown / not observable in this runtime
    ┆
  C ┆        ( no control. region C is empty, not disabled. )
```

| Field | Value |
|---|---|
| Headline | `Reading` |
| Current sentence | `The agent called the governed read.` before a `tool_result` exists, and `The governed read returned; the run is still under way.` after one. |
| Visible truth label | `Source: live`, or `Source: recorded` when the provenance rule of phase 4 section 6 says so (D42). |
| CTA labels | **None.** Nothing the reader can usefully do. An empty region C is a better answer than a disabled button, because a disabled button invites a reader to look for the condition that would enable it. |
| Visible words | 1 chip + 1 headline + 10 sentence + 8 step labels + 8 topology = **28** |

The topology line becomes visible here and stays visible for the rest of the
run. It is not shown in 3.1 or 3.2 because before any event exists there is no
topology to report, and stating a non-observation about a run that has produced
nothing invites the reader to think an observation was attempted and failed.
`#live-delegation` is attached from first paint in every state, which is what
`scripts/qa-live.ts:197-201` reads.

**After five seconds a stranger can answer:** something is happening right now,
it is a read, and it is real rather than replayed.

**Acceptance questions.**

1. *One focal point?* Yes, the headline. Region C is empty, so nothing competes.
2. *At most three actions?* One visible, one available: the mode switch.
3. *Will a user understand "Controlled Fault"?* Not yet. The step is `○` and the
   run has not reached it.
4. *Could a user confuse replay with live?* **This is the screen where the risk
   is highest**, because it is reachable both from a live worker run and from a
   stepped replay, and the two render identically except for one chip word. The
   chip is therefore mandatory here, and it is the reason phase 4 put provenance
   on its own axis instead of making `recorded` a state.
5. *Could a user believe the Warden acted beyond policy?* No. The Warden step is
   `○` and no intervention exists.

*Reserved meaning slots: run liveness. One of four.*

---

### 3.4 `controlled_fault`

```
 ┌────────────────────────────────────────────────────────────────────────────┐
 │  FleetScope    Live recovery demo                        Story  |  Expert  │
 └────────────────────────────────────────────────────────────────────────────┘

  A ┆ <11>   Source: live
  A ┆
  A ┆ <36>   Failed on purpose
  A ┆
  A ┆ <21>   The first read failed by design, so the recovery is
  A ┆        something you watch rather than something you take on trust.
  A ┆
  A ┆ <15>   Controlled Fault: injected transient tool unavailability
    ┆
    ┆
  B ┆ ●─────────────────●─────────────────●┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄○┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄○
  B ┆ Start             Governed read     Controlled Fault  Warden retry      Result
  B ┆ <11>   external_agent · Delegation: Unknown / not observable in this runtime
    ┆
  C ┆        ( no control. the Warden acts next, not the reader. )
    ┆
    ┆        attached, not rendered: #live-incident carrying the full payload
    ┆        string `Controlled Fault: injected transient tool unavailability
    ┆        (first 1 attempt(s))`, which is what qa-live.ts:253 reads.
```

| Field | Value |
|---|---|
| Headline | `Failed on purpose` |
| Current sentence | `The first read failed by design, so the recovery is something you watch rather than something you take on trust.` |
| Visible truth label | **Two, at two levels, and the distinction is load bearing.** The run-level chip stays `Source: live`. The words `Controlled Fault` appear on the third step and in the incident line. Section 8.2 explains why the chip must not read `Controlled Fault`. |
| CTA labels | **None.** |
| Visible words | 1 chip + 3 headline + 20 sentence + 6 incident + 8 step labels + 8 topology = **46** |

The visible incident line drops the `(first 1 attempt(s))` suffix that the
payload carries. That is not a paraphrase: it is the same string with a machine
detail removed, the detail is restated better by the sentence, and the full
payload stays attached in `#live-incident` for both QA and Expert Mode.

**After five seconds a stranger can answer:** the read failed, the failure was
deliberate, and something is expected to happen about it next.

**Acceptance questions.**

1. *One focal point?* Yes, the headline. `Failed on purpose` is three words that
   answer the question the screen raises before the reader can form it, which is
   the reason it is the headline rather than `Incident` or `Read failed`.
2. *At most three actions?* One visible, one available: the mode switch.
3. *Will a user understand "Controlled Fault"?* **Yes, and this is the screen
   that has to earn it.** Three independent statements say the same thing in
   three registers: the headline says it in plain words, the sentence says why it
   was done, and the step label names the category. A reader who understands only
   one of the three still leaves with the right belief. This is also why no alarm
   treatment is permitted: animating the one deliberately safe failure in the
   system would make it look like the dangerous kind.
4. *Could a user confuse replay with live?* Low risk. The chip says
   `Source: live` (`10` D42) and no replay control exists in this state.
5. *Could a user believe the Warden acted beyond policy?* No, and specifically:
   the Warden step is `○`, so the screen has not claimed the Warden did anything
   at all. A reader arriving here cannot over-credit the Warden because nothing
   has been credited.

*Reserved meaning slots: run liveness (chip), Controlled Fault (the third step
and the incident line). Two of four. This is the only place in the entire
product where the Controlled Fault slot may be spent.*

**The sibling state `incident`.** Identical chassis, four differences: the
headline is `Read failed`, the sentence is `The read failed, and FleetScope did
not cause it.`, the chip reads `Source: live` and the step carries the event's
own truth, which is `Live` or `Unknown` but never `Controlled Fault`, and the
Controlled Fault meaning slot is
not spent. It is not drawn separately because a wireframe that differs only in
copy is not a second wireframe.

---

### 3.5 `warden_authorized` and `recovering`

One wireframe, two states. They share a step picture because the Warden retry
step is marked by the `intervention` event, and the retry `tool_call` that
follows is not a sixth step. What separates them is the headline and the
sentence, which is exactly the difference between a decision recorded and a
retry in flight.

```
 ┌────────────────────────────────────────────────────────────────────────────┐
 │  FleetScope    Live recovery demo                        Story  |  Expert  │
 └────────────────────────────────────────────────────────────────────────────┘

  A ┆ <11>   Source: live
  A ┆
  A ┆ <36>   Retry authorized                    ← warden_authorized
  A ┆        Retrying                            ← recovering
  A ┆
  A ┆ <21>   The Warden allowed exactly one retry, because this read
  A ┆        can be repeated without changing anything.       ← warden_authorized
  A ┆
  A ┆        The retry is the same operation, not a second one, so
  A ┆        the record counts it once.                       ← recovering
    ┆
    ┆
  B ┆ ●─────────────────●─────────────────●─────────────────●┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄○
  B ┆ Start             Governed read     Controlled Fault  Warden retry      Result
  B ┆ <11>   external_agent · Delegation: Unknown / not observable in this runtime
    ┆
  C ┆        ( no control. )
```

**Corrected, and superseded by `10` C26.** An earlier draft of this section drew
the topology line as `warden` and argued that `mcp_server.py:253` emits the
intervention with `agent="warden"`. That is true of the event and false of the
line, because the line does not read the last event. `state.ts:233` is
`lastOf(events, 'tool_call')?.agent ?? events.at(-1)?.agent ?? null`, and on
every Warden screen a `tool_call` already exists at sequence 2, so the
last tool_call branch wins and the line renders `external_agent`. The drawing
above is the corrected one. Who decided is named in region A's sentence, which
makes the Warden the grammatical subject; region B names who acted.

| Field | `warden_authorized` | `recovering` |
|---|---|---|
| Headline | `Retry authorized` | `Retrying` | (C8: `z`)
| Current sentence | `The Warden allowed exactly one retry, because this read can be repeated without changing anything.` | `The retry is the same operation, not a second one, so the record counts it once.` **Rewritten by `10` D45.** |
| Visible truth label | `Source: live` | `Source: live`, or `Source: recorded` per provenance |
| CTA labels | None | None |
| Visible words | 1 + 2 + 15 + 8 + 8 = **34** | 1 + 1 + 18 + 8 + 8 = **36** |

**After five seconds a stranger can answer:** something is allowed to be tried
again, exactly once, and the reason it is allowed is that trying it again cannot
break anything.

**Acceptance questions.**

1. *One focal point?* Yes, the headline. Region C is empty.
2. *At most three actions?* One visible, one available: the mode switch.
3. *Will a user understand "Controlled Fault"?* Yes, carried forward: the third
   step is `●` and the reader passed through 3.4 to get here. A reader who
   arrived directly, which on the worker path is possible, gets the category from
   the step label and the deliberateness from the sentence's word `allowed`,
   which implies a rule was consulted.
4. *Could a user confuse replay with live?* Low risk on `warden_authorized` and
   moderate on `recovering`, for the same reason as 3.3: both are reachable from
   a stepped replay. The chip is the whole defence and is mandatory.
5. *Could a user believe the Warden acted beyond policy?* **No, and this is the
   screen the question exists for.** The sentence carries the bound and the
   justification in one line: `exactly one retry` is the limit
   (`recovery.py:67-71` sets `max_retries = 1`) and `can be repeated without
   changing anything` is the test that permitted it
   (`RETRYABLE_SIDE_EFFECTS = {"idempotent_read"}`). **Residual risk, stated
   plainly:** Story Mode never shows `retriesUsed`, `maxRetries` or the
   `idempotencyKey`. A reader who wants to verify rather than believe must open
   Expert Mode, where the two `tool_call` rows sit side by side with the same
   key. That is the correct placement, because the claim is proved by comparing
   two values and a comparison of two values is evidence, not a headline.

*Reserved meaning slots: run liveness (chip), Warden (the fourth step and the
word `Warden` in the sentence). Two of four.*

---

### 3.6 `completed`

One of the three screens the live demo actually reaches, and the one that has to
work for a reader who watched nothing happen, because on the MCP path the whole
eight event transcript lands in one poll.

```
 ┌────────────────────────────────────────────────────────────────────────────┐
 │  FleetScope    Live recovery demo                        Story  |  Expert  │
 └────────────────────────────────────────────────────────────────────────────┘

  A ┆ <11>   Source: live
  A ┆
  A ┆ <36>   Recovered
  A ┆
  A ┆ <21>   The governed read failed once by design, the Warden
  A ┆        authorized one idempotent retry, and the retry returned
  A ┆        the result.
    ┆        ^ this sentence renders only when an incident, a
    ┆          retry_once intervention and a following tool_call all
    ┆          exist. otherwise: "The governed read returned on its
    ┆          first attempt. No fault occurred and the Warden was
    ┆          not called." see 10 D43.
    ┆
    ┆
  B ┆ ●─────────────────●─────────────────●─────────────────●─────────────────●
  B ┆ Start             Governed read     Controlled Fault  Warden retry      Result
  B ┆ <11>   external_agent · Delegation: Unknown / not observable in this runtime
    ┆
    ┆
  C ┆ ▮▮▮ Replay evidence ▮▮▮       ▯ Run live recovery demo ▯
    ┆
    ┆
    ┆        attached, not rendered: the six field #live-facts list that the
    ┆        shipped page renders by default at live.astro:51-58. It is an
    ┆        inspector, and the review named it as a reason the default view
    ┆        reads as devtools. Every one of its ids stays in the document,
    ┆        so all 58 browser checks pass unchanged.
```

The primary action is **`Replay evidence`, not `Run live recovery demo`**. This
is a change from the shipped page, where the start button is the only styled
control. The run has just asserted something; the next question a sceptical
reader has is prove it, not do it again. `#live-start` keeps its exact text,
which `scripts/qa-live.ts:193` asserts, and is demoted to outlined weight.

| Field | Value |
|---|---|
| Headline | `Recovered` |
| Current sentence | **Two, chosen by which events exist. Amended by `10` D43; `authorised` becomes `authorized` per C8 and `authoritative` is dropped per C9.** With an incident, a `retry_once` intervention and a following `tool_call`: `The governed read failed once by design, the Warden authorized one idempotent retry, and the retry returned the result.` (19) Without an incident, which is reachable and is the case this pack originally missed: `The governed read returned on its first attempt. No fault occurred and the Warden was not called.` (17) The first is the product's whole argument in one line and is the measurement the word budget was sized from; the second exists so that argument is never made about a run that did not produce it. |
| Visible truth label | Run level chip: `Source: live`, or `Source: recorded` under provenance (D42). Per step truth stays in `.live-beat__status`, attached, where `qa-live.ts:243` reads `Controlled Fault` out of the third step. Section 8.6 explains why no step renders a visible status word. |
| CTA labels | Primary: `Replay evidence`. Secondary: `Run live recovery demo`. |
| Visible words | 1 chip + 1 headline + 20 sentence + 8 step labels + 8 topology + 6 CTA = **44** |

When provenance is `recorded` the sentence gains one clause and nothing else
moves: `No model ran. This transcript was produced deterministically.`

**Motion.** One transition, once, on entry: the result appearing. It fires on a
change of `state` only. The client refetches from cursor 0 every 400ms
(`client.ts:22, 204`) and repaints unconditionally, so anything bound to a
render would replay two and a half times a second on a run that finished
minutes ago.

**Narrow, 480x900.**

```
 ┌──────────────────────────────────┐
 │ FleetScope        Story | Expert │
 └──────────────────────────────────┘

  A ┆ <11>  LIVE
  A ┆ <32>  Recovered
  A ┆ <19>  The governed read failed
  A ┆       once by design, the Warden
  A ┆       authorized one idempotent
  A ┆       retry, and the retry
  A ┆       returned the authoritative
  A ┆       result.
    ┆
  B ┆ ● Start
  B ┆ ● Governed read
  B ┆ ● Controlled Fault
  B ┆ ● Warden retry
  B ┆ ● Result
  B ┆ <11> external_agent
  B ┆ <11> Delegation: Unknown /
  B ┆      not observable in this
  B ┆      runtime
    ┆
  C ┆ ▮▮ Replay evidence ▮▮
  C ┆ ▯ Run live recovery demo ▯
```

Nothing is dropped, nothing truncates, and no row scrolls sideways. The two
controls stack rather than sitting side by side, which is the only structural
change between the two widths.

**After five seconds a stranger can answer:** the read broke on purpose, a
policy allowed one retry, the retry worked, and I can check the record.

**Acceptance questions.**

1. *One focal point?* Yes, the headline. Region C holds the only filled object
   and sits below the verdict, so it is reached after the verdict rather than
   instead of it. This is the correction to the shipped document order.
2. *At most three actions?* Three visible, three available: `Replay evidence`,
   `Run live recovery demo`, the mode switch. **At the cap, not under it.** A
   fourth control on this screen is a defect, which rules out an export button,
   a share link and a copy-run-id affordance in Story Mode.
3. *Will a user understand "Controlled Fault"?* Yes, from two places: the
   sentence says `failed once by design`, and the third step names the category.
   A reader who only reads the 21px line still gets it, because `by design` is
   the whole idea in two words.
4. *Could a user confuse replay with live?* **This is the screen where it
   matters most and the guard is thinnest.** A live run and a completed recorded
   run render identically except for one chip word and, when recorded, one extra
   clause. That is by design: they *are* the same causal story, and the only
   honest difference is how the record was produced. The chip is therefore not
   optional decoration on this screen, it is the only thing carrying the
   distinction, and it must never be rendered as colour alone.
5. *Could a user believe the Warden acted beyond policy?* No. The sentence says
   `one idempotent retry`: the count and the safety condition, in three words.
   Same residual as 3.5, and the primary action is now literally the invitation
   to go and check.

*Reserved meaning slots: primary action (Replay evidence), Controlled Fault
(third step), Warden (fourth step). Three of four, which phase 3 section 3.3
named as one of the two worst cases and confirmed is inside budget. The run
liveness slot is **not** spent, because the run is over; the chip carries the
word `Live` in neutral tone, and section 8.7 explains why that is not a loss.*

---

### 3.7 `failed`

Drawn in its refusal form, because a policy refusal is the most interesting
failure this system produces and phase 4 put its rationale in the largest
sentence on the screen for that reason.

```
 ┌────────────────────────────────────────────────────────────────────────────┐
 │  FleetScope    Live recovery demo                        Story  |  Expert  │
 └────────────────────────────────────────────────────────────────────────────┘

  A ┆ <11>   Source: live
  A ┆
  A ┆ <36>   Not recovered
  A ┆
  A ┆ <21>   The Warden refused the retry, because this run had
  A ┆        already used its one permitted retry.
    ┆
    ┆
  B ┆ ●─────────────────●─────────────────●─────────────────◇─────────────────●
  B ┆ Start             Governed read     Controlled Fault  Warden retry      Result
  B ┆ <11>   external_agent · Delegation: Unknown / not observable in this runtime
    ┆
    ┆
  C ┆ ▮▮▮ Replay evidence ▮▮▮       ▯ Run live recovery demo ▯
```

`◇` on the fourth step means **decided, not performed**. Section 8.3 explains
why this marker had to be invented and what it costs.

| Field | Value |
|---|---|
| Headline | `Not recovered` |
| Current sentence | **Amended by `10` D45.** One of the three refusal sentences in `07` section 3.8, chosen by `payload.outcome`. They are written out rather than interpolated, because `recovery.py:67-71` produces `already used 1 of 1 permitted retry(ies)`, and a machine plural in the largest sentence on the screen is the detail `05` section 3.4 already removed from the incident line. The verbatim rationale renders in Expert Decision Evidence. Fallback when no intervention refused: `The run ended as <terminalResult>.` |
| Visible truth label | Run level chip: `Source: live`, or `Source: recorded` under provenance (D42). Per step truth stays attached. |
| CTA labels | Primary: `Replay evidence`. Secondary: `Run live recovery demo`. |
| Visible words | 1 chip + 2 headline + 12 sentence + 8 step labels + 8 topology + 6 CTA = **37** |

The failure gets no extra emphasis: no larger type, no alarm treatment, no
second transition. Emphasis on a failure is editorialising, and the four
rationales are already the strongest words on the screen.

**The plain form.** When the run ends without any intervention, the fourth step
is `○` and the connector into `Result` is `┄` on its left and `─` on its right:
`●─●─●┄○─●`. That combination reads as a gap, which is accurate, because the
Warden step genuinely never happened while the run genuinely ended.

**After five seconds a stranger can answer:** it did not recover, and the reason
is that a rule said no rather than that something broke.

**Acceptance questions.**

1. *One focal point?* Yes, the headline. `Not recovered` is the verdict; the
   sentence immediately below is the reason.
2. *At most three actions?* Three visible, three available. At the cap, as 3.6.
3. *Will a user understand "Controlled Fault"?* Yes. The third step is `●` and
   the fault preceded the refusal, so the reader has the same three registers as
   3.4 if they watched, and the step label plus the sentence if they did not.
4. *Could a user confuse replay with live?* Same profile as 3.6, same guard.
5. *Could a user believe the Warden acted beyond policy?* **No, and this is the
   strongest No in the set.** The Warden is shown declining, with its reason and
   its arithmetic in the sentence. A reader cannot over-credit a component they
   just watched refuse. This is the screen that makes the governance claim
   falsifiable: if the Warden always said yes, this screen would not exist.

*Reserved meaning slots: Warden (fourth step, and the word in the sentence),
Controlled Fault (third step), primary action. Three of four. The run liveness
slot is not spent, because the run is over.*

---

### 3.8 `recorded fallback`

The deployment where `LIVE_MODE` is off. `apps/api/src/server.ts:18` prints
`recorded-only. No model or platform call can occur.` at boot, and
`state.ts:218` gives the reader the reason. Two branches, and which one a reader
gets depends on whether any run is addressable. Section 8.4 records the defect
this screen uncovered.

**Branch R1: no run is addressable.**

```
  A ┆
  A ┆ <36>   Cannot run here
  A ┆
  A ┆ <21>   LIVE_MODE is off, so this deployment may replay evidence
  A ┆        but not start a run.
  A ┆
  A ┆ <15>   No run is addressable here, so there is nothing to read.
    ┆
  B ┆ ○┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄○┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄○┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄○┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄○
  B ┆ Start             Governed read     Controlled Fault  Warden retry      Result
    ┆
  C ┆ ░░░ Run live recovery demo ░░░
```

**Branch R2: a run is addressable**, by `?run=<runId>` in the page URL or by
`GET /runs/active` returning one.

```
  A ┆ <11>   Source: recorded
  A ┆
  A ┆ <36>   Recorded evidence
  A ┆
  A ┆ <21>   LIVE_MODE is off, so this deployment may replay evidence
  A ┆        but not start a run.
  A ┆
  A ┆ <15>   This transcript was scripted. No model ran, then or now.
    ┆
  B ┆ ●─────────────────●─────────────────●─────────────────●─────────────────●
  B ┆ Start             Governed read     Controlled Fault  Warden retry      Result
  B ┆ <11>   security_review · Delegation: observed at event 2
    ┆
  C ┆ ▮▮▮ Replay evidence ▮▮▮      ░░░ Run live recovery demo ░░░
```

| Field | R1 | R2 |
|---|---|---|
| Headline | `Cannot run here` | `Recorded evidence` |
| Current sentence | `LIVE_MODE is off, so this deployment may replay evidence but not start a run.` | same |
| Visible truth label | **None.** No record exists, so there is nothing to label. | `Source: recorded` (D42) |
| CTA labels | None available. `Run live recovery demo` present and disabled. | Primary: `Replay evidence`. `Run live recovery demo` present and disabled. |
| Visible words | 3 + 14 + 11 + 8 + 4 = **40** | 2 + 2 + 14 + 10 + 8 + 6 + 6 = **48** (the chip is two words under D42) |

**The delegation line inverts here, and the design must not let that read as
quality.** The scripted path emits a real `delegation` event
(`session.py:55-60`), so a recorded run legitimately shows `Delegation: observed
at event 2` and names `security_review`. The live MCP path never can, because
Gemini CLI has no sub-agents, so a live run shows the `Unknown` string. The live
run therefore shows *less* on this one axis while being the more honest of the
two. Two consequences for the wireframe: the topology line states which runtime
it describes, and `Unknown` is never rendered in the same treatment as a failure,
because it is an absence of observation rather than an absence of behaviour.

Worth noting that the scenario config itself names a delegate,
`delegated_agent="security_review"` at `scenario.py:47`, while the MCP path emits
no delegation event and writes `delegationObserved: False` into `run_end`
(`mcp_server.py:290`). The configuration expects a delegate and the runtime
cannot observe one. The UI reports the observation, never the configuration, and
the explicit `False` in the payload means the claim is affirmed by the runtime
rather than merely absent from it.

**After five seconds a stranger can answer:** this copy of FleetScope will not
run anything, and either there is a record to read or there is not, and it says
which.

**Acceptance questions.**

1. *One focal point?* Yes. R1: the headline, with the disabled control clearly
   subordinate. R2: the headline, with `Replay evidence` below it.
2. *At most three actions?* R1: one visible and available, the mode switch; the
   start control is present and disabled so a reader who looks for it finds it
   beside the reason. R2: two available, `Replay evidence` and the mode switch.
3. *Will a user understand "Controlled Fault"?* R1 no, and nothing claims one.
   R2 yes, at the same strength as 3.6.
4. *Could a user confuse replay with live?* **R2 is the highest risk screen in
   the entire set**, because it shows a complete successful causal path on a
   deployment that cannot run anything. Three independent statements carry the
   distinction: the `RECORDED` chip, the sentence saying this deployment cannot
   start a run, and the clause `No model ran, then or now.` Any one of the three
   is sufficient; all three are present because this is the screen where being
   wrong is most expensive.
5. *Could a user believe the Warden acted beyond policy?* R2 carries the same
   risk profile as 3.6, with one addition: a reader might believe a *live* Warden
   acted, when nothing live occurred at all. The `RECORDED` chip and the explicit
   clause are the answer, and it is the reason the clause names both times: then
   and now.

*Reserved meaning slots: R1 none, and a screen that spends no chromatic slot is
correct here because nothing happened. R2: Controlled Fault (third step), Warden
(fourth step), primary action. Three of four. The run liveness slot is never
spent on a recorded run, which is the whole point of keeping the two axes apart.*

---

### 3.9 `historical_replay`

The only Story screen whose purpose is reading rather than acting, and the only
one in which the causal path is navigable instead of a report.

```
 ┌────────────────────────────────────────────────────────────────────────────┐
 │  FleetScope    Live recovery demo                        Story  |  Expert  │
 └────────────────────────────────────────────────────────────────────────────┘

  A ┆ <11>   Source: live
  A ┆
  A ┆ <36>   Replaying
  A ┆
  A ┆ <21>   Historical replay of run 019f3c2a. Replay performs zero
  A ┆        model, tool and Warden calls.
  A ┆
  A ┆ <15>   Re-reading the record of a run that happened.
    ┆
    ┆
  B ┆ ●─────────────────●─────────────────◉─────────────────●─────────────────●
  B ┆ Start             Governed read     Controlled Fault  Warden retry      Result
  B ┆ <11>   external_agent · Delegation: Unknown / not observable in this runtime
    ┆
    ┆        the five steps are one control with five positions, not five
    ┆        controls. moving the playhead re-reads stored events and
    ┆        writes nothing. no autoplay, ever.
    ┆
  C ┆ ▯ Back to result ▯
```

| Field | Value |
|---|---|
| Headline | `Replaying` |
| Current sentence | `Historical replay of <runId>.` followed by `REPLAY_NOTE` verbatim, because `zero model, tool and Warden calls` is asserted at `qa-live.ts:284`. |
| Visible truth label | The **provenance** chip: `Source: live` when the record was produced by a live run being re-read, `Source: recorded` when the transcript was scripted. Section 8.5 resolves the conflict this exposed between phase 3 and phase 4, and D42 supplies the word, because a bare `Live` above a headline reading `Replaying` is one chip carrying two meanings. |
| CTA labels | No primary. Secondary: `Back to result`. |
| Visible words | 1 chip + 1 headline + 13 sentence + 8 provenance clause + 8 step labels + 8 topology + 3 CTA = **42** |

When provenance is `recorded` the 15px line becomes `This transcript was
scripted. No model ran, then or now.` and the chip reads `RECORDED`.

`Back to result` is new. It fixes a shipped defect: `client.ts:239` sets
`session.replaying = true` and nothing ever sets it false, and `state.ts:271-279`
returns `canStart: false` on that branch, so a reader who presses Replay evidence
loses the start button permanently and can only recover by reloading the page.

**After five seconds a stranger can answer:** I am reading a record rather than
watching something happen, moving through it costs nothing, and I can go back to
where I was.

**Acceptance questions.**

1. *One focal point?* Yes, the headline, and the playhead is the object the
   reader manipulates. The two do not compete because the playhead is a position
   marker inside an existing object rather than a new one.
2. *At most three actions?* Three visible, three available: the path as a single
   five position control, `Back to result`, the mode switch. **At the cap.** The
   ruling that the path is one control and not five is load bearing; the
   alternative, a previous and next pair, costs two controls and removes the
   ability to jump, and was rejected for that reason. It introduces no new
   element and no new vocabulary: the same object that was a report in 3.6 gains
   a selected index.
3. *Will a user understand "Controlled Fault"?* Yes, and better than anywhere
   else, because the reader can stop on it and read it in place.
4. *Could a user confuse replay with live?* **No, and this screen is where the
   most guard is spent.** The headline is a present participle of reading, the
   sentence states the cost is zero, the chip names its axis, and the only
   control is named `Back to result`, a phrase that only makes sense to someone
   who understands they left something. The chip is the guard that needed the
   most work: as a bare `Live` it was the first item in the reading order and it
   argued the opposite of the other three, because a reader parses `Live` as
   happening now while the chip means produced live. D42 gives it its axis, so
   `Source: live` above `Replaying` reads as one statement rather than two. There is also no autoplay under
   any condition: an autoplaying replay is indistinguishable from a live run to
   anyone who did not read the label, which is the exact confusion the `Truth`
   type exists to prevent.
5. *Could a user believe the Warden acted beyond policy?* No, and this screen
   makes it checkable: the reader can stop the playhead on the Warden step and
   read the rationale in place, which is the closest Story Mode comes to
   verification without becoming an inspector.

*Reserved meaning slots: selection (the playhead), Controlled Fault (third
step), Warden (fourth step). Three of four. The run liveness slot is not spent,
because nothing is running.*

## 4. Cross screen checks

The nine wireframes are only worth drawing if they can be checked as a set. All
three tables below are counted from the wireframes above, not asserted.

### 4.1 Focal point, one per screen

| Screen | Focal object | Why it and not the alternative |
|---|---|---|
| `ready` | the CTA | **Amended by D41.** The headline drops to 21px on variant A so the filled CTA is the only high salience object; there is no outcome for a 36px headline to report. Variant B keeps the 36px headline, because `Cannot run here` is the outcome. |
| `awaiting_agent` | headline | **Amended by C27.** The prompt moved into region A and is no longer the largest object; the headline `Your turn` is focal, so no mono object is focal on any Story screen. |
| `running` | headline | Region C is empty. |
| `controlled_fault` | headline | `Failed on purpose` answers the question the screen raises before the reader forms it. |
| `warden_authorized` / `recovering` | headline | Region C is empty. |
| `completed` | headline | Region C is below it, so the action is reached after the verdict rather than instead of it. |
| `failed` | headline | Same, and the sentence beneath it carries the reason. |
| `recorded fallback` | headline | Both branches. |
| `historical_replay` | headline | The playhead is a position inside an existing object, not a second object. |

**Amended by D41 and C27.** One screen gives the focus to region C rather than to
the headline, `ready` variant A, and it does so by dropping the headline a type
step rather than by having two objects at the top of the page. Every other
screen, `awaiting_agent` included, puts the focus on the 36px headline. The
earlier claim that two screens could give region C the focal point while the
headline stayed the only 36px object was two focal objects stated as one.

### 4.2 Actions, never more than three

| Screen | Controls in the story body | Available | Total visible, with the mode switch |
|---|---|---|---|
| `ready` A | 1 | 1 | 2 |
| `ready` B | 1, disabled | 0 | 2 |
| `awaiting_agent` | 1 | 1 | 2 |
| `running` | 0 | 0 | 1 |
| `controlled_fault` | 0 | 0 | 1 |
| `warden_authorized` | 0 | 0 | 1 |
| `recovering` | 0 | 0 | 1 |
| `completed` | 2 | 2 | **3** |
| `failed` | 2 | 2 | **3** |
| `recorded` R1 | 1, disabled | 0 | 2 |
| `recorded` R2 | 2, one disabled | 1 | **3** |
| `historical_replay` | 2, one of them the five position path | 2 | **3** |

Maximum three, reached on four screens, exceeded on none. Five of the twelve
rows have **zero** controls in the story body, which is the property that makes
the graph and console exclusions cheap rather than painful: on those screens
there is nothing for them to sit next to.

For comparison, phase 1 counted **25** controls in the page body of the rejected
prototype, in a single non conditional layout.

### 4.3 Visible words, budget 62

| Screen | Words | Headroom |
|---|---|---|
| `ready` | 26 | 36 |
| `awaiting_agent` | 63 (C12) | **exception granted** |
| `running` | 29 | 33 |
| `controlled_fault` | 47 | 15 |
| `warden_authorized` | 35 | 27 |
| `recovering` | 37 | 25 |
| `completed` | 45 | 17 |
| `failed` | 38 | 24 |
| `recorded` R1 | 40 | 22 |
| `recorded` R2 | 48 | **14** |
| `historical_replay` | 43 | 19 |

Every chip bearing screen gains one word against the first draft, because D42
renders the chip as `Source: live` or `Source: recorded` rather than as the bare
word. `ready` and `awaiting_agent` render no chip at all (C1, D40) and are
unchanged by it.

Worst case 48 on `recorded` R2, which is also the screen carrying the most
guard copy, and that is the right place for the budget to be tightest.
`awaiting_agent` is the one stated exception, at 63 against a budget of 62, for
the reason counted in `10` C12. The
shipped page in `ready` was measured at 72 words in phase 0; the rejected
prototype at 272.

### 4.4 Regions, budget three

Every screen renders three regions or two. `running`, `controlled_fault`,
`warden_authorized` and `recovering` render two, because region C is empty and an
empty region is not a region. No screen renders four. The rejected prototype
rendered eight, in every state, unconditionally.

## 5. The exclusion list, checked against the drawings

Phase 3 section 5 listed fifteen things Story Mode must not contain. Each is
verified against the nine wireframes rather than promised.

| # | Exclusion | Verified |
|---|---|---|
| 1 | No graph, canvas or node diagram | Nothing in any wireframe. The five step path is a labelled sequence, not a topology. |
| 2 | No console, feed or log stream | Nothing in any wireframe. |
| 3 | No raw event inspector | The six field `#live-facts` list is attached and not rendered on every screen. No payload key, no cursor, no latency appears anywhere. |
| 4 | No second progress number | Exactly one progress representation, the five step path, on every screen. No count, no fraction, no percentage. |
| 5 | No duplicated fact | The acting agent appears once, in region B. Section 8.6 removed the one duplication the first draft contained. |
| 6 | No fourth region | Maximum three, per 4.4. |
| 7 | No truth legend | None drawn. The chip is a word. |
| 8 | No colour without a word | Every reserved slot in section 3 sits on text that already says the thing. |
| 9 | No animation | **Not verified. Superseded by `10` D17.** This row reported a budget of zero animations as satisfied by one transition on entering `completed` or `failed` plus a busy indication in `starting`. `03` section 5 item 9 sets the budget at zero and `08` check V7 asserts an empty array, so what this row describes is a violation reported as compliance. D17 rules zero motion in every state with no exception, which is what the drawings must be built to. |
| 10 | No window chrome | The invocation line in `awaiting_agent` has no frame, no prompt glyph and no control dots. |
| 11 | No agent avatars | None. The acting agent is an identifier in a mono line. |
| 12 | No cream, paper or warm surface | No surface is specified here at all; grayscale only. |
| 13 | No serif | The ladder is sans then mono. |
| 14 | No fake typing, streaming or delegation | `awaiting_agent` names motion as forbidden. The delegation string is verbatim on every CLI runtime screen. |
| 15 | No hopeful default | Section 7 P1 makes it checkable; the static markup's first state is `unavailable`, not `ready`. |

## 6. What a stranger answers after five seconds

Collected, so the set can be read as one argument rather than nine.

| Screen | The one sentence a stranger should be able to say |
|---|---|
| `ready` | Nothing has run, one button starts one fixed thing. |
| `awaiting_agent` | It is waiting for me, in my own terminal, and here is what to call. |
| `running` | Something is happening now, it is a read, and it is real. |
| `controlled_fault` | The read failed, it failed deliberately, something happens next. |
| `warden_authorized` / `recovering` | It may be tried again, exactly once, because trying again is safe. |
| `completed` | It broke on purpose, a rule allowed one retry, the retry worked, I can check. |
| `failed` | It did not recover, and a rule said no rather than something breaking. |
| `recorded` R1 | This copy will not run anything, and there is nothing to read. |
| `recorded` R2 | This copy will not run anything, but here is a record of one that did. |
| `historical_replay` | I am reading a record, moving through it costs nothing, I can go back. |

Read down the column and the product's argument is intact without a single
technical term except `Controlled Fault`, which four of the ten rows explain in
plain words before naming.

## 7. Machine preconditions

The five second test is a human protocol, specified in phase 3 section 4. These
are the conditions that must hold before it is worth running one, written so
they can be added to `scripts/qa-live.ts` alongside the existing 29 checks per
viewport rather than replacing any of them.

| # | Precondition | How it is checked |
|---|---|---|
| P1 | The static markup does not claim `ready` | `#live-root[data-state]` is `unavailable` in the served HTML, before any script runs. Fixes `live.astro:25`. |
| P2 | Exactly one element per screen at the top type step | Count elements whose computed `font-size` equals the largest on the page: must be 1. |
| P3 | Control count per state matches 4.2 | Count enabled controls inside the story body per `data-state`. |
| P4 | No drawn border inside the story body | For every element under `#live-root`, every `border-*-width` computes to `0px`. |
| P5 | No horizontal overflow at 480px | `document.documentElement.scrollWidth === clientWidth`. Already asserted. |
| P6 | The delegation string survives verbatim in every state | `#live-delegation` contains `Unknown / not observable in this runtime`. Already asserted at `ready` and at `completed`; extend to every state the suite visits. |
| P7 | At most three regions render | Count direct children of `#live-root` with a non empty rendered box. |
| P8 | Visible word count is at or under 62 | Sum the whitespace separated alphanumeric tokens of every visible text node under `#live-root`. |
| P9 | No motion fires on a poll | **Superseded by `10` D17 and `12` P9.** "Must not increase" is passed by a permanent animation. The check is `document.getElementById('live-root').getAnimations({ subtree: true }).length === 0`, in every state, at every tick. |

P1, P5 and P6 are the only three the shipped suite already covers in some form.
P2, P3, P4, P7, P8 and P9 are new and none of them has been executed; they are
specified here so the layout phase can be checked rather than argued about.

## 8. What drawing found

Seven things, none of which was visible in prose. Three are conflicts between
earlier phases, two are defects in shipped code, one is a defect in an earlier
phase's reasoning, and one is a decision the drawing forced.

### 8.1 The `awaiting_agent` sentence was 26 words against a 20 word cap

Phase 4 section 3.4 proposed: `FleetScope admitted the run. It holds no model
credential, so the next move is yours: call the FleetScope tool from your own
Gemini or Antigravity session.` That is 26 words, and phase 3 section 2.1 caps
the current sentence at 20, the measured length of the longest sentence in
`state.ts`. The screen also carries the two `AWAITING_AGENT_LINES`, 16 more
words, asserted verbatim at `qa-live.ts:213-214` and therefore not reducible.

**Resolution.** The proposed sentence's second half restates what the two
asserted lines already say: which agent is ready, and who is governing. The
sentence is cut to the part they do not say, `FleetScope holds no model
credential, so the next move is yours.`, which is 11 words. Nothing asserted is
touched and the screen lands at 44 visible words.

This is a good outcome for a bad reason: the conflict only appeared because the
words were laid on a page and counted. Phase 4 specified nine sentences and this
was the only one that broke a budget phase 3 had already set, which is the
argument for drawing before writing more copy.

### 8.2 `Controlled Fault` cannot be the run-level chip

Phase 4 section 3.6 gives the `controlled_fault` state the truth label
`Controlled Fault`. Phase 3 section 2.3 forbids exactly that: promoting the
label to the run header would claim the whole run was a fault, which is the
opposite of what happened.

**Resolution.** They describe two different things and both are right at their
own level. The **run-level chip** carries provenance and reads `Source: live` or
`Source: recorded` (`10` D42), never `Controlled Fault`. The words `Controlled Fault` sit on the
third step of the path and in the incident line, which is where phase 3 section
3.3 already said the Controlled Fault meaning belongs, on the one event kind it
describes. A naive implementation would put the state's label in the chip and
break phase 3; the wireframe makes the two levels visible, so it cannot.

### 8.3 The Warden retry step marks itself reached on a refusal

A shipped defect, and the sharpest thing drawing found.

`deriveBeats` (`state.ts:150-176`) marks the fourth step done when any event of
kind `intervention` exists. `recovery.py:56-75` defines four outcomes, of which
three are refusals, and `mcp_server.py:252-263` emits the intervention **before**
consulting `permits_retry`. So a run in which the Warden refused the retry
renders `Warden retry: done`, and the step whose label is a verb claims the verb
happened.

This is the same class of error phase 4 removed from `incident` and `recovering`,
found one layer lower. It is invisible in prose, because prose says "the fourth
beat is driven by the intervention event", which is true, and only a drawing asks
what the marker then means.

**Resolution.** `◇`, decided but not performed, drawn when the intervention's
`payload.outcome` starts with `refuse_`. That requires two changes the earlier
phases did not anticipate:

1. `BEAT_DEFINITIONS` entries need a predicate over the matched event, not only a
   list of kinds, because the distinction is in the payload.
2. `BeatStatus` gains `refused`. Phase 4 section 8.1 states `BeatStatus` is
   unchanged, and this document amends that. The alternative, reusing the
   existing and currently unused `failed`, was rejected: the Warden did not fail,
   it decided, and a step reading `failed` next to a sentence saying the Warden
   refused would put two accounts of one event on one screen.

No browser check changes. `qa-live.ts:237-239` asserts all five steps are `done`
only on the successful run, where the outcome is `retry_once`.

### 8.4 A recorded only deployment promises evidence it cannot reach

`state.ts:218` tells the reader `LIVE_MODE is off, so this deployment may replay
evidence but not start a run.` Drawing that screen exposed that the second half
of the promise has no route:

1. `deriveLive`'s `run === null` branch spreads `empty`, which sets
   `canReplay: false`, and never overrides it (`state.ts:256-265`). So the replay
   control cannot appear.
2. `client.ts:198-199` returns early from `refreshRun` when `session.runId` is
   null, and `runId` is only ever assigned from the `POST /runs` response
   (`client.ts:227`), which a blocked deployment cannot issue.
3. There is no list endpoint. The API exposes `/runs/capability`, `/runs/active`,
   `/runs/:runId`, `/runs/:runId/events` and the two POSTs, and `/runs/active`
   returns null once a run finishes, which `qa-live.ts:294-297` relies on.

So on a recorded only deployment the page states it may replay evidence and
provides no way to reach any, ever. Branch R1 of section 3.8 is what the screen
must say when that is the situation, and branch R2 is what it may say when a run
id is addressable. Making R2 reachable needs one of two changes, both outside
this document: read a `run` id from the query string, or add a list route. The
smaller of the two is the query parameter, and unlike `?api=` it carries no
origin, so it needs no loopback check.

### 8.5 Two incompatible provenance derivations, and the later one is right

Phase 3 section 2.3 derives run-level truth partly from the state:
`state === 'historical_replay' -> Recorded`. Phase 4 section 6 derives provenance
from the events alone: `E.some(e => e.truth === 'live') -> live`, otherwise
`recorded`.

They disagree on a case a judge will actually produce. Run the live MCP demo,
then press `Replay evidence`. Under phase 3 the chip flips from `Live` to
`Recorded`, which states that the run was a recording. It was not. Under phase 4
provenance stays `live` and the screen says `Re-reading the record of a run that
happened.`, which is the true statement.

**Resolution.** Phase 4's derivation is adopted and phase 3 section 2.3's first
rule is superseded. Phase 4's reasoning covers the case explicitly and phase 3's
does not, and a rule that relabels history is the failure this codebase is
arranged against. Section 3.9 is drawn on the phase 4 rule.

### 8.6 No step renders a visible status word

The first draft of section 3.6 put a truth word under each of the five steps,
following `client.ts:75-85`, which writes the truth label into
`.live-beat__status`. On a completed run that prints `Live, Live, Controlled
Fault, Live, Live`: five words of which four are the run-level chip repeated, and
the fifth is the third step's own label repeated. Both are the duplication phase
3 section 5 item 5 forbids, and together they take item 3 from 8 words to 16.

**Resolution.** Story Mode renders the five labels and nothing else. Reached and
not reached is carried by marker shape, which survives forced colours, plus a
visually hidden status word for assistive technology. `.live-beat__status` keeps
carrying the truth word in the document, unrendered, which is what
`qa-live.ts:240-245` reads, so no check changes. Phase 4 section 7.4 already
recorded that this element's name does not match its content and instructed that
it be fixed by addition rather than renaming; keeping it attached and invisible
is that addition.

### 8.7 Phase 3's hue exclusion proof does not hold, and the budget survives anyway

Phase 3 section 3.3 argued that the primary action hue and the run liveness hue
can never coexist, because the only enabled control is `#live-start` and
`canStart` is false whenever a run is under way. Drawing `awaiting_agent` broke
that argument: it introduces a second enabled control, `Copy`, on a screen where
the run **is** under way. So the two do coexist there.

The conclusion survives the failure of its proof. Recounting every screen in
section 3 gives a worst case of **three chromatic meanings plus neutral**:
`recovering` spends liveness, Controlled Fault and Warden; `completed` and
`failed` spend primary action, Controlled Fault and Warden; `awaiting_agent`
spends only liveness and primary action. No screen spends four. The corrected
rule is not that two hues are mutually exclusive, it is that **run liveness and
the finished run hues are mutually exclusive**, because a run cannot be under way
and over at the same time. That is the property doing the work, and it is a
property of the state machine rather than of which buttons happen to be enabled.

## 9. What this document does not decide

1. Any hex value, any font file, any pixel spacing beyond the two rhythm gaps the
   chassis needs in order to be drawable at all.
2. Expert Mode. It inherits the same reading order and has its own budgets, and
   it is the next document.
3. The exact copy for the `awaiting_agent` dead end line, beyond reserving a
   `<15>` slot for it under the invocation.
4. Whether `recorded` R2 is reached by a query parameter or by a new list route.
   Section 8.4 states the trade and stops there, because both are API changes.
5. The mode switch's own appearance. It sits outside the story body and is
   counted separately, which is all these wireframes require of it.

## Links

* Shipped Story page: `apps/web/src/pages/live.astro`
* Shipped state machine: `apps/web/src/features/live/state.ts`
* Shipped client: `apps/web/src/features/live/client.ts`
* Browser suite: `scripts/qa-live.ts`
* Recovery policy: `apps/adk-worker/src/fleetscope_worker/recovery.py`
* MCP path: `apps/adk-worker/src/fleetscope_worker/mcp_server.py`
* Phase 0: `docs/design/agent-workspace/00-current-state-audit.md`
* Phase 1: `docs/design/agent-workspace/01-prototype-autopsy.md`
* Phase 2: `docs/design/agent-workspace/02-reference-matrix.md`
* Phase 3: `docs/design/agent-workspace/03-information-hierarchy.md`
* Phase 4: `docs/design/agent-workspace/04-state-model.md`
