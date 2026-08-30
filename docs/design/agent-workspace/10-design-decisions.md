# Design decisions

Status: normative. This document overrides `00` through `09` wherever they
disagree with it or with each other.

Last updated: 2026-08-29, against source at `cfdcca7`.

## 0. How to use this document

The nine lane documents were written in parallel against the same source. They
agree about far more than they disagree about, but nine independent readings of
one codebase produce contradictions, and a contradiction discovered during
implementation costs more than one discovered here.

So this document does three things.

1. **Section 2** records every significant decision, the alternative that was
   rejected, and the reason. A decision with no rejected alternative is not a
   decision, it is a description, and it is not listed.
2. **Section 3** lists every contradiction found between the lane documents,
   with the resolution and the evidence that settled it. Forty: twenty five from
   reconciling the lanes, and fifteen more from an adversarial review of the
   finished pack, recorded in `13-critique-response.md`.
3. **Sections 4 and 5** separate the cases where a lane contradicts the shipped
   code. The shipped code wins by default. Where it loses, section 5 gives the
   justification, because "the design says so" is not one.

Three rules govern the whole pack.

* **Shipped code wins over a lane document**, unless section 5 justifies the
  change with a source line showing the shipped behaviour states something the
  events do not support.
* **A test assertion wins over a design preference.** `scripts/qa-live.ts` is
  the only thing standing between this page and a hopeful default. The redesign
  adds checks and edits none.
* **A term may be rendered only when a named field entitles it.** This is the
  rule from `07`, and it is the one that catches the failure class no layout
  review catches.

The lane documents' **reasoning** is not edited when this one overrules them.
Their reasoning is why the decision is trustworthy, and deleting a superseded
argument makes the surviving one look arbitrary. Their **artifacts** are edited:
typed props, branch tables, drawn strings and verification tables are corrected
where they stand, each marked with the decision that changed it, because an
implementer copies those rather than reading them. D48 records why, and section 6
is the supersession log for both.

---

## 1. What is being built, in one paragraph

`/live` becomes the agent workspace. By default it is Story Mode: three regions
holding seven items of information, at most three controls, at most 62 visible
words, zero animations, one filled element which is the primary action, and a
near black surface that is more than 70 percent unpainted. Behind an opt in
switch it becomes Expert Mode: the canonical event timeline, the raw payload
console, the Warden's Decision Evidence, and the six technical fields that today
sit in the default view. The Zoetrope graph stays on `/viewer`, for the reason in
decision D20. Both modes read the same twelve state machine, derived from
canonical events and nothing else.

---

## 2. The decisions

### 2.1 Scope and surface

**D1. Story and Expert are two modes of `/live`, not two routes.**

*Rejected:* a separate `/live/expert` route. *Why:* `06` section 13 proves the
mode switch guarantee ("entering and leaving Expert Mode moves nothing") holds
for in page state and for a query parameter that does not remount, and does not
hold for a route change, which destroys any renderer and forces a full reload on
the way back. A route would also duplicate the poller. The mode is mirrored to
`?mode=story|expert`, which is the vocabulary `browser-qa.ts:596-610` already
asserts on `/cockpit` and `/viewer`.

**D2. `/live` joins the site navigation.**

*Rejected:* leaving it URL only. *Why:* `Nav.astro:15-23` lists seven links and
none of them is `/live`, verified at HEAD and in the worktree. A default surface
nobody arrives at is not a default surface. This is one line and it is the
cheapest item in the pack after D12.

**D3. `/dashboard`, `/cockpit`, `/cases`, `/audit`, `/catalog` and `/approvals`
are out of scope.**

*Rejected:* unifying all Story shaped surfaces now. *Why:* `00` section 1 found
three independent Story implementations (`features/live/state.ts`,
`features/story/story.ts`, `features/story/enterprise.ts`) and
`browser-qa.ts:467-478` asserts exact counts of proof cards and path steps on
those routes. Unifying them is a second programme with its own test surface. The
duplication is recorded, not fixed.

### 2.2 The state machine

**D4. Twelve states: extend the shipped ten with `controlled_fault` and
`warden_authorized`. `recorded` does not become a state.**

*Rejected:* keeping ten states and carrying the two distinctions as extra
attributes such as `data-fault="controlled"`. *Why:* `#live-root[data-state]` is
the only handle the browser suite has, and the entire value of this codebase's
derivation discipline is that its claims are checkable by something that did not
compute them. Two attributes that must be read together to know which screen you
are on is also a bug generator: the first defect it produces is an incident
headline beside a Controlled Fault chip.

*Rejected:* `recorded` as a twelfth state, which is what the review asked for.
*Why:* `session.py:93-110` gives a recorded run's incident `truth=failure.truth`,
which is `controlled_fault`. A run is `recorded` and passing through
`controlled_fault` at the same moment. One variable cannot hold two axes, and the
first bug is a recorded run whose Controlled Fault beat stops saying Controlled
Fault. See D5.

*Rejected:* `warden_refused` as a thirteenth state. *Why:* no event sequence
rests there. Both emitters write `run_end` immediately after a refusing
intervention (`mcp_server.py:264-270`, `session.py:133-134`), and the finished
branch runs first, so the reader lands in `failed`. A state the machine passes
through inside one poll tick is not a screen. The refusal rationale becomes the
`failed` headline instead, which is where the reader is looking.

*Rejected:* `blocked` as a state. *Why:* `LIVE_MODE` off is a fact about the
deployment, not about where a run got to, and there is no run. It stays a
modifier on `ready`.

**D5. `provenance: Truth` is a derived field on its own axis, computed from
events and never from capability.**

*Rejected:* reading `capability.workerMode`, which the endpoint does publish.
*Why:* capability describes the deployment now; the events describe the run then.
A deployment that changed `workerMode` between the run and the read would
silently relabel history. As a side benefit, `Capability` does not currently
declare `workerMode` at all, so the honest rule is also the one that needs no
type change.

*Rejected:* `every(truth === 'recorded')`. *Why:* it inverts. A recorded run's
`tool_result` and `incident` carry `controlled_fault`, so that rule classifies
every recorded run as live. The rule is `some(truth === 'live')`.

**D6. No state is entered by a timer, and there is no timeout out of
`awaiting_agent`.**

*Rejected:* a client side abandon after N seconds. *Why:* there is no abandon
route on the API, so the page would declare a run dead that the ledger still
holds open, after which `run_already_active` (`admission.ts:29`) refuses every
restart while the screen says the opposite. The dead end is stated in words
instead. See D26.

### 2.3 Hierarchy and layout

**D7. Seven information items in three regions: Verdict, Progress, Action.**

*Rejected:* one region per item, which is what the prototype did. *Why:* `01`
counted 8 top level panes and 13 independently framed blocks. That was not a
decision to show too much, it was the absence of any grouping decision. Naming
which items share a region is the actual fix. Nothing else may be a region: a
caption, a legend, a badge strip and a footnote are all regions.

**D8. Reading order is truth, outcome, causal progress, incident or result,
action, topology, evidence. The action comes after the verdict.**

*Rejected:* the shipped order, which puts `.live__actions` at `live.astro:26`
and `#live-sentence` at `live.astro:37`. *Why:* a control is a stronger visual
signal than a sentence, so putting it first does not merely reorder, it demotes
the verdict. In `ready` this is harmless because there is no outcome yet; in
`completed` it puts a button in the reader's path before the answer.

**D9. The headline occupies the 36px step. The current sentence occupies 21px.**

*Rejected:* setting the current sentence at 36px, which is what `02` section 3.3
and `08` section 3.5 assumed when they named the top step "outcome". *Why:* the
20 word `completed` sentence at 36px is a four line block roughly 166px tall
before anything else is drawn, and it leaves the screen with a paragraph rather
than a focal point. `04` gives every state a headline and `05` drew all nine
screens on the headline at 36; a one to three word headline is what a focal point
looks like. Consequence: `--aw-measure-outcome: 34ch` is re derived as
`--aw-measure-sentence: 46ch`, at which the 133 character `completed` sentence
lands in the three lines `05` drew.

**D10. Story Mode holds at most three controls, and five of the twelve state
rows hold none in the body.**

*Rejected:* a persistent secondary affordance such as export, share or copy run
id. *Why:* `completed`, `failed`, `recorded` R2 and `historical_replay` are
already at the cap of three including the mode switch. A fourth control on those
screens is a defect, and the states that are under the cap are under it because
nothing useful can be done, not because there is room.

**D11. 62 visible words per screen, with one recorded exception.**

*Rejected:* a round budget, and an unlimited one. *Why:* the cap on the current
sentence is 20 words because that is the measured length of the longest sentence
in `state.ts`, so the shipped copy already passes and any future overrun is a
regression rather than a judgement call. The exception is `awaiting_agent` at 63,
because 16 of its words are `AWAITING_AGENT_LINES` asserted verbatim at
`qa-live.ts:213-214` and cannot be shortened. The arithmetic is in section 3, C12.

### 2.4 Story Mode specifics

**D12. Fix the six undeclared `var()` names in `live.astro` before anything
else.**

*Rejected:* rewriting the page's style block. *Why:* `live.astro:88,89,94,109,129,133`
reference `--border`, `--surface-raised` and `--accent`, none of which exists.
Every one resolves to a hardcoded fallback that differs from the real token
value, so `/live` is running a fourth palette by accident and changing
`--fs-accent` does not move it. Six `var()` corrections make the page inherit the
whole design system. This is a prerequisite for every other visual item.

**D13. One chip in region A. It carries provenance, and it is rendered only when
a record exists.**

*Rejected:* rendering `Unknown` on the zero event states. *Why:* `04` section 3.2
already established the principle for `ready`: showing `Unknown` invites the
reader to think something was attempted and could not be classified. The same
argument covers `starting` and `awaiting_agent`. The exception is `unavailable`,
which renders `Unavailable`, because that label's whole purpose is to describe
the absence of a record rather than a record.

*Rejected:* putting the state's own name in the chip. *Why:* the chip would then
read `Completed` beside a headline reading `Recovered`, which is one fact in two
places, and the run-level truth would have nowhere to live.

**D14. The five step causal path renders labels and shape markers, and no per
beat truth word.**

*Rejected:* a truth chip under each step. *Why:* on a completed run that prints
`Live, Live, Controlled Fault, Live, Live`: four repeats of the run-level chip
plus one repeat of the third step's own label. Orange rides on the fault step's
label instead, which is already the words `Controlled Fault`. Per beat truth
chips are an Expert Mode surface.

*Rejected:* colour as the marker. *Why:* `●` reached, `○` not reached, `◇`
decided but not performed and `◉` the replay playhead are shapes, so the path
survives forced colours and a grayscale print unchanged. Each marker also carries
a visually hidden status word.

**D15. `BeatStatus` gains `refused`, and the fourth step renders `◇` on a
Warden refusal.**

*Rejected:* leaving the shipped five values. *Why:* `deriveBeats`
(`state.ts:150-176`) marks the fourth step done when any `intervention` exists,
`recovery.py:56-75` defines four outcomes of which three are refusals, and
`mcp_server.py:252-263` emits the intervention before consulting `permits_retry`.
So a refused run renders `Warden retry: done`, and a step whose label is a verb
claims the verb happened.

*Rejected:* reusing the existing and currently unused `failed`. *Why:* the Warden
did not fail, it decided. A step reading `failed` beside a sentence saying the
Warden refused puts two accounts of one event on one screen. Verified: shipped
`BeatStatus` is `pending | active | done | failed | unknown`, so this is a real
addition and not a rediscovery.

**D16. The six `live__facts` fields leave the Story viewport and stay in the
DOM.**

*Rejected:* deleting them, and keeping them visible. *Why:* the review named the
fact list as the inspector in the default view, and `Event cursor: 8` and
`Budget: 0 / 25 model calls` are verification instruments rather than outcome.
But `qa-live.ts` reads `#live-policy`, `#live-incident`, `#live-result`,
`#live-cursor` and `#live-budget` with `textContent()`, which resolves the
selector and reads the node with no visibility check. Only `click()` needs
visibility. So moving all six out of view costs zero QA edits, and deleting any
of them costs five checks.

**D17. Story Mode has zero motion, in every state, with no exception.**

*Rejected:* one transition on entering `completed` and `failed`, which `04`
section 3.10 and `05` section 5 permitted. *Rejected:* an indeterminate busy
indicator during `starting`, which `04` section 3.3 permitted. *Why:* `02`
budgeted zero animations for Story and `08` section 9 check V7 asserts
`getAnimations()` is empty in all twelve states, which is only checkable if there
are no exceptions. The product argument is stronger than the budget: on the MCP
path all eight events arrive in one POST, so `completed` is a batch arriving, and
animating it dramatises a transaction. `starting` gets a disabled control and a
sentence in the live region, which is feedback without motion, and it is
typically visible for under a second.

### 2.5 Expert Mode

**D18. Expert Mode on `/live` is the canonical plane only: timeline, event
console, Decision Evidence, and the relocated facts. There is no graph canvas.**

*Rejected:* putting the Zoetrope graph on `/live`, which the locked direction's
phrasing implies. *Why:* three source facts, any one of which is sufficient.
`agent_viewer_load(name, main, companions)` takes session document text and is
called from exactly two places, `/viewer` (a file the visitor picks) and
`/dashboard` (the bundled demo); no adapter from canonical run events to a
session document exists anywhere in the repository, verified by grep. The ABI has
no append path, so putting event 9 into a graph showing 1 to 8 means
`agent_viewer_load`, which `Viewer::load` (`main.rs:77-96`) implements by
building a fresh `app` and `manifest` at fraction 1.0, discarding camera,
selection and playhead; at a 400ms poll that is a reset 2.5 times a second. And
`agent_viewer_agents()` is the rail's data source on `/viewer`, so a rail without
a session has nothing to list.

The graph is not dropped. It is `/viewer`'s, which is the surface that has a
session, and `06` is written against it. A canonical events to session adapter is
the bridge and it is deferred with its reason in section 7.

**D19. The agent rail on `/live` is derived from `event.agent`.**

*Rejected:* a rail with no data source, and a rail that duplicates the causal
path. *Why:* `event.agent` is the only place agent identity exists on the
canonical plane. On the MCP path it yields two ids, `external_agent` and
`warden`; on the scripted path three. The rail carries what the causal path
cannot: the id as copyable text, the first and last sequence, and keyboard reach.
It carries no status dot and no beat status, which is the fix for the review's
fourth complaint.

**D20. The canonical timeline is indexed by sequence and never by wall clock
proportion.**

*Rejected:* a proportional scrubber. *Why:* three independent reasons.
`agent_viewer_seek(fraction)` is exported by the ABI and the shell's `Api` type
deliberately omits it, which is an existing position to preserve rather than a
gap to fill. Proportional layout collapses the incident, intervention and retry
into one pixel band while idle wait dominates the surface, and those three rows
are the entire governance story. And `CanonicalEvent` carries a timestamp but no
duration, so any bar width would be a difference the UI computed and then
presented as recorded, which is exactly what `01` caught the prototype doing with
`+124ms`.

**D21. Switching mode moves nothing, and the guarantee has a mechanism rather
than an assurance.**

The mode handler writes an attribute and flips `hidden`. It calls no ABI
function, issues no request, and touches no cursor. `agent_viewer_seek_sequence`
has exactly one call site, inside `selectEvent`, reached from exactly two
handlers, so the claim is checkable by grep. The canonical cursor is not view
state: `client.ts` refetches `?after=0` every tick.

**D22. Where a renderer exists, the reveal precedes the first mount, and the
canvas is never constructed inside a hidden or zero width host.**

*Rejected:* mounting the graph in a `display: none` panel and revealing it later.
*Why:* `CockpitMount.astro:146-180` documents that ratzilla sizes the terminal
grid from `parent.client_width()` exactly once, at construction. A grid built at
zero columns draws nothing, forever, while the status line, the summary and the
fingerprint all still look correct. Once built, hiding and revealing is safe;
only construction is the hazard. This is also why Expert Mode at 390px is a tab
set rather than a narrow third column: a column collapsed to zero width is the
same bug as a hidden one.

### 2.6 Content

**D23. Copy is entitlement based. A term may be rendered only when a named field
permits it.**

*Rejected:* a copy deck. *Why:* `01` found the prototype showing 13 events for an
eight event run, three latencies for a type with no latency field, and a
`warden-policy@1.2.0` string taken from a recorded fixture under a `Live` pill.
No layout review catches any of those. A rule that says name the field or do not
say it catches all three.

**D24. The ban on false claims is executable, not prose.**

`browser-qa.ts:1126-1133` already fails the build if the local session route
prints any of six claim words. The same shape extends to `/live` with a different
list, because `/live` is entitled to say `authorized` once the events support it.
The live list is the phrases that are never entitled: `ai fixed`,
`reasoning chain`, `autonomous`, `gateway`, `model armor`, `provider outage`,
`self healing`, `self-healing`, `the agent retried`, `the agent recovered`,
`the model decided`. Asserted against `innerText` of `#live-root`. 58 checks
become 60.

**D25. `authorized` with a z, everywhere.**

*Rejected:* the `s` spelling used at four user visible sites. *Why:* the state
identifier is `warden_authorized`, and an identifier that disagrees with the
string it renders is a bug waiting to be typed. The repository is 116 to 14 for
`z`. And `browser-qa.ts:1128` spells the claim word `authorized`, so the honesty
guard and the copy would otherwise disagree about what word to look for. No
browser check asserts either spelling.

**D26. `awaiting_agent` states its dead end in words and offers no cancel.**

*Rejected:* a cancel button. *Why:* there is no abandon endpoint. A control that
appears to cancel and does not is worse than the dead end it pretends to fix.
The note is rendered quietly, not as an error: it is true, the reader has no in
page escape, and hiding it would be the page lying by omission.

**D27. The copyable artifact on `awaiting_agent` is a natural language prompt,
not a shell command.**

*Rejected:* a command shaped string with parentheses and quotes. *Why:* MCP tools
are invoked by the agent, not typed by the developer, so there is no CLI syntax
for this and a command shaped string would be a fabricated fact of exactly the
kind `01` catalogues. The three identifiers in the prompt are real: server name
`fleetscope` (`mcp_server.py:349`), tool `read_repository_metadata`
(`tools.py:89`), target `google/adk-python` (`scenario.py:48`).

**D28. Absence has four words and none of them is a symbol.**

`Unknown` means the runtime cannot report it. `Not observed` means it is
reportable and no event carries it yet. `None` means an event exists and its
value is genuinely empty. `Not applicable` means the field cannot exist in this
configuration. Forbidden everywhere: `0`, `-`, `N/A`, `--`, an empty string, a
spinner that never resolves, a plausible default. A dash is indistinguishable
from a rendering bug and reads as a claim.

**D29. The budget line names the boundary FleetScope cannot see past.**

*Rejected:* `0 / 60 model calls`. *Why:* `model_call` events are emitted only by
`capture.py:93` under `workerMode: 'adk'`, `runs.ts:265` writes
`run.modelCalls` from that count, and `budget.used` sums it. So on the live MCP
path `budget.used` is structurally 0 forever. A model did run, in the developer's
own CLI. The zero is true and false by implication at the same time, so the line
says what was observed and where the boundary is. `qa-live.ts` asserts only the
substring `model calls`, so a longer honest string passes.

### 2.7 Visual system

**D30. The token layer is 13 declarations scoped to `.aw`, and it may never
write an `--fs-` name.**

*Rejected:* aliasing the whole palette into an `--aw-` vocabulary. *Why:* an
alias gives one value two live names, and an alias is where a fork starts.
`viewer.astro:173-174` already did this with `--viewer-blue: #4285f4` beside a
global palette that has no such value. The write ban matters more than it looks:
a shared component rendered inside the workspace resolves `--fs-accent` at its
own call site, so a local redefinition would silently change its colour inside
the subtree with no selector in either file showing why. Both checks are greps:
no `:root` in the file, no line matching `^\s*--fs-[a-z0-9-]*\s*:`.

**D31. Orange is a new hue at h25, not the existing amber.**

*Rejected:* `--fs-warn` `#d5a03c`. *Why:* amber already carries warn, historical
transport and live proof fallback in three unrelated rules. Binding a fourth
meaning to it would make the one hue whose meaning is a single specific event
kind the one hue with four meanings. h25 is the widest separation from amber that
is still unambiguously orange rather than red, and below about h20 the hue reads
as salmon, which reads as alarm. Controlled Fault is the run doing exactly what
the scenario said it would.

**D32. Completed and failed get no hue. There is no red in Story Mode.**

*Rejected:* green for success and red for failure. *Why:* completed is already
signalled by two changes that happen together and only there, cyan going out and
blue coming back. Adding green spends a fifth hue to restate it. For failed, the
most common route in is the Warden declining a retry on non idempotency or budget
grounds, which is governance working correctly and the best evidence the system
produces; painting it red states that something broke and inverts its meaning.
Red is available to Expert as `--aw-fail`, deliberately not defined yet.

**D33. The primary action is the only filled element in Story Mode, and the
surface has no grouping borders.**

*Rejected:* bordered regions. *Why:* this is a measurement, not a taste position.
`--fs-border` measures 1.37:1 against the ground and `--fs-border-strong` 1.71:1;
WCAG 1.4.11 wants 3:1 for a boundary that identifies a control, which on this
ground needs roughly `#5b6a7e`, visibly a light grey line. So a border quiet
enough to be tasteful is too quiet to be accessible, and the honest options are a
loud border or almost none. A solid `#6b9ce0` fill with `#0d1014` ink measures
6.77:1 and passes 1.4.11 on its own, so the one control needs no border and
everything else can have none. White ink on the same fill is 2.82:1 and fails, so
the ink colour is not a choice.

**D34. No status may rely on colour alone, and blue and violet must additionally
differ in fill treatment.**

*Rejected:* asserting the rule from principle. *Why:* it is derived here. Under a
Viénot simulation, blue and violet collapse to an RGB distance of 27 out of 441
under both protanopia and deuteranopia, and they differ by 4 percent in relative
luminance. They also co occur, on `completed`. Four hues that all clear AA on a
near black ground cannot also be separated by luminance, because clearing AA
constrains each into a narrow band. So the word is mandatory, and the specific
pair that collides is separated by fill against no fill, which survives
greyscale, deuteranopia and forced colours.

**D35. No text in the workspace uses partial opacity.**

*Rejected:* `opacity: 0.8` and `opacity: 0.75`, which shipped `/live` uses on
`.live-beat__status` and `.live__facts dt`. *Why:* all three ink levels clear AA
on all four surfaces, worst case 5.07:1. Opacity moves a measured contrast to an
unmeasured one for no gain. The ink ramp is three verified levels and it is free.

### 2.8 Accessibility and testing

**D36. One live region, `#live-sentence`. `#live-beats` may never be one.**

*Why:* `client.ts:63` clears the beat list with `innerHTML = ''` and rebuilds all
five, and `client.ts:248` runs that every 400ms for the life of the page. A live
region there would announce five beats 2.5 times a second, forever, including on
a finished run. The sentence gains `aria-atomic="true"`, which the shipped page
lacks, because `setText` replaces `textContent` wholesale and without it some
assistive technologies announce only the changed node. The one permitted second
region is the copy confirmation, which is empty at every other moment.

**D37. Focus order is specified once, globally, and every list surface is one
tab stop.**

*Why:* tab order is a property of the page, so a per component statement cannot
be checked. An eight event run would otherwise cost eight tab presses to cross a
timeline. Nothing autofocuses on load. No positive `tabindex`. Switching mode
moves focus to the first heading of the revealed region, because leaving focus on
the switch tells a screen reader user that nothing changed.

**D38. Build at 390px. The QA viewport follows.**

*Why:* `qa-live.ts` runs at 1440x900 and 480x900 and asserts zero horizontal
overflow at the narrow one. 390 is narrower than 480, so a layout clean at 390 is
clean at the width QA measures. Note that 1280x720 is constrained by height, not
width: 720 minus browser chrome leaves roughly 600px, so the fold shrinks and
Expert drops to two columns.

**D39. The redesign adds browser checks and edits none.**

*Why:* every existing DOM handle survives, including `#live-start`'s exact text
`Run live recovery demo` and the class `.live-beat__status`. Four handles are
added: `#live-provenance[data-provenance]`, `#live-replay-back`,
`#live-start-error`, and the two mode buttons. See C4 for the one place this was
nearly given up.

### 2.9 Decisions added after adversarial review

Three reviewers read the pack as built and found thirty eight defects the pack's
own method should have caught. `13-critique-response.md` accounts for every finding,
including the ones rejected. These are the decisions those findings forced.

**D40. Nothing in regions A or B makes a statement about a run before that run's
first canonical event.**

*Rejected:* keeping the three affected elements on three different rules. *Why:*
they were already converging on one. C1 removed the provenance chip when
`events.length === 0`, with the reason that a truth label describes how a record
was produced and no record exists. `05` section 3.3 independently withheld the
topology line on the same states, with the same reason in different words:
"stating a non-observation about a run that has produced nothing invites the
reader to think an observation was attempted and failed". And `08` section 7 was
still painting `--aw-cyan`, whose meaning is "the run is under way", on `starting`
and `awaiting_agent`, where nothing is executing and `04` section 3.4 explicitly
forbids a pulsing dot, an animated ellipsis and fake typing. A cyan chip reading
live is the static form of the same claim, and it is the one signal the design
admits carries run liveness.

One rule covers all three. On `unavailable`, `ready`, `starting` and
`awaiting_agent`: no chip, no topology line, no cyan, hue count 1. Both elements
stay attached and visually hidden, because `12` P6 and H1 read them with
`textContent()` and `getAttribute()`, which resolve hidden nodes. `--aw-cyan`'s
condition is restated positively in `08` section 4.1 so the token carries its own
test: painted only when at least one canonical event exists and the run is not
finished. `12` H6 gains a companion, V11: no element computes to `--aw-cyan`
while `events.length === 0`.

**D41. On `ready` variant A the headline renders at the 21px step, so the primary
action is the only focal object.**

*Rejected:* keeping the headline at 36px and making the CTA outlined until hover.
*Why:* that trades one defect for two. D33 measured `--fs-border` at 1.37:1 and
`--fs-border-strong` at 1.71:1 against the ground, so an outline quiet enough to
be tasteful fails WCAG 1.4.11's 3:1, and `12` V5 requires exactly one filled
element in the story body, which an outlined CTA would take to zero.

*Rejected:* deferring to the user test `05` section 3.1 proposed. *Why:* `03`
section 4.2 sets that test up on `completed`, not `ready`, so as written it would
never surface this. And the defect is decidable from the pack's own rules without
a participant: `05` section 2 property 2 makes the 36px headline "the only 36px
object" and says the focal point is decided by size before anyone reads a word,
`12` G2.2 and P2 assert exactly one element at the top type step and that it is
the headline, and `05` section 3.1 then declared a different object focal on the
same screen. A one word 36px headline beside the single filled control on the
page is `12` S1's stated failure condition, "two objects compete", and every
numeric budget on `ready` passes while it happens, which is the count based
method failing on its own first screen.

Variant B keeps the 36px headline, because `Cannot run here` is the outcome the
screen reports and its CTA is disabled and therefore unfilled. So the rule is not
"`ready` is special", it is: the headline takes the top type step whenever it
reports something. `12` P2 and G2.2 are restated to match.

**D42. The provenance chip names its axis: `Source: live`, `Source: recorded`.**

*Rejected:* changing the derivation so a replayed live run reads `Recorded`.
*Why:* C2 already settled that, and relabelling a live run's record as a
recording falsifies history. The derivation is right; the vocabulary was wrong.

*Rejected:* leaving the bare word. *Why:* `03` section 2.3 puts the chip first in
the reading order because "truth is the frame; everything after it is the
picture", so on `historical_replay` the reader meets the word `Live` before the
headline `Replaying`. The chip means *produced live*; a reader parses it as
*happening now*. `05` section 3.9 calls that screen the one where the most guard
is spent and lists four guards, without noticing that one of the four argues the
opposite of the other three. `12` void condition 9 covers a recording presented
as live; this is the inverse and was uncovered.

The `TRUTH_LABEL` map is untouched, so `live-state.test.ts:227-235` and `12` T4
still hold: the chip composes its string around the label rather than replacing
it. `#live-provenance` is a handle this pack adds (D39), so no shipped check
reads it. Cost: one word on every chip bearing screen, worst case `recorded` R2
at 48 against a budget of 62. `12` gains H17: on `historical_replay`, no element
renders the unqualified word `Live` above the headline.

**D43. The `completed` sentence is conditional on the events it names.**

*Rejected:* keeping it verbatim, which `04` section 3.10, `05` section 3.6 and C9
all did. *Why:* the entry condition for `completed` is
`finished && run.terminalResult === 'succeeded'` and requires neither an
`incident` event nor an `intervention`, while the sentence asserts both. This is
the defect `04` sections 1.1 and 1.2 exist to fix, in a stronger form: those two
mislabel an event that exists, this asserts two events that may not. Rule 1 of
`11` condemns it directly, and C9's only edit removed one word.

The path is reachable. `tools.py:119` reserves the attempt before the request and
`mcp_server.py:335-339` swallows a publish failure in a bare `except Exception`
so the agent still gets an answer. With `FLEETSCOPE_ATTEMPT_LEDGER` set to a
`FileAttemptStore` (`worker.ts:92`, read at `mcp_server.py:309`), a first call
whose publish fails leaves attempt 1 consumed on disk; the agent calls again,
`reserve` returns 2, `ControlledFault.applies_to(2)` is false because
`fault_attempts=1` (`scenario.py:52`), and the run emits four events. `deriveLive`
returns `completed`, `deriveBeats` correctly marks the fault and retry beats
`pending`, and the sentence claims both happened. The page contradicts itself on
one screen and the half a reader trusts is the sentence.

Second sentence, for a success with no incident: `The governed read returned on
its first attempt. No fault occurred and the Warden was not called.` The first
sentence renders only when an `incident` exists, the latest `intervention` has
`payload.outcome === 'retry_once'`, and a `tool_call` follows it at a higher
sequence. `11` phase 1 gains the case and a fifth test; `12` gains H16.

**D44. Expert Mode has a region budget and a control budget, and the set of
components that render there is closed.**

*Rejected:* leaving it uncounted, which `08` section 893 recorded as the
intention ("Expert Mode's budgets. Phase 3 section 7 item 4 defers them"). *Why:*
the review's first complaint was eight regions competing. The pack answered it
for Story with counts and then moved every dense surface into the one mode with
no count. Composing `11` phase 6's five surfaces with the five components `09`
marks "Mode: Both" gives at least six concurrent regions in Expert on `/live`,
against `02` section 128's Expert budget of five, and nobody had added it up.
`12` compounded it: line 160 scopes every machine precondition to Story Mode
while line 16 instructs the reviewer to work sections 1 to 7 "in both modes",
which makes G1.1 unsatisfiable in Expert and G1.4 absurd beside a timeline of
eight button rows. Expert was either failing the gate on its face or entirely
uncounted.

The budget, and the closed set on `/live`:

| Expert region | Holds | Counted as |
|---|---|---|
| A. Identity | run id, provenance chip, event count, mode switch | 1 |
| B. Verdict | OutcomeHero, CausalProgress, IncidentExplanation, CurrentAgent | 1 |
| C. Evidence | CanonicalTimeline and EventConsole, merged or adjacent | 1 |
| D. Decision | DecisionEvidence | 1 |
| E. Reference | AgentRail and the six relocated fact fields | 1 |

**Five regions, at most eight controls.** Eight rather than three because a
timeline of eight event rows is eight buttons and that is the surface's purpose;
the number that matters in Expert is regions, not controls, and the control cap
exists to stop a sixth surface arriving as a toolbar. Rows inside a list surface
count as one control for G1.4's purpose and the row count is `events.length`.
ModeTruthBadge, OutcomeHero, CausalProgress, CurrentAgent and IncidentExplanation
stay in Expert, inside region B, which is where `09`'s "Mode: Both" resolves to a
place rather than a duplicate. `12` sections 1 to 7 run in Story; section 1a runs
in Expert; sections 2, 5, 6 and 9 run in both.

**D45. Story Mode copy is plain language, and the ban is greppable.**

*Rejected:* the entitlement rule alone. *Why:* the entitlement rule asks whether a
field permits the claim. It does not ask whether a stranger understands the claim,
and five approved strings passed it while failing the second question. `ready`'s
only sentence turned on `admits`, FleetScope's admission control verb, which a
stranger reads as *confesses*, and the sentence never said what the button would
do. `Admitting` was the same verb promoted to a 36px headline. Two payload
rationales rendered verbatim as Story prose, carrying the snake_case
`idempotent_read` and the machine plural `retry(ies)`. And `recovering` explained
itself with `idempotency key`. `05` section 3.4 had already removed
`(first 1 attempt(s))` from the incident line for being a machine detail, so the
pack was applying its own rule inconsistently. This is the jargon leak the
commissioning review named, landing on the default screen.

The rule: **a raw producer string renders verbatim in Expert Decision Evidence,
where a reader who wants the mechanism will look, and Story renders a sentence
that says what it means.** The five rewrites are in `07` sections 3.2, 3.3, 3.8
and 3.9. Free today, because no check asserts `#live-sentence` across
`qa-live.ts:178-297` and `#live-policy` keeps its raw value in Expert, which is
what `qa-live.ts:248-250` reads. `12` gains G2.7: `#live-root`'s `innerText` in
Story contains none of `idempoten`, `admits`, `admitting`, `ledger`, `(ies)`.

**D46. `.aw` goes on a wrapper containing both the command bar and `#live-root`.
`#live-root` stays the region container.**

*Rejected:* `.aw` on `#live-root`, which `08` section 1.2 specified. *Why:* `12`
G1.1 and P7 cap the direct children of `#live-root` that render a box at three,
and those three are regions A, B and C, so the command bar cannot be inside it.
`09` section 4.1 makes that bar the only chrome in Story Mode. So the mode switch
sat outside the token scope, unable to resolve `--aw-space-7`,
`--aw-measure-body`, `--aw-motion-*` or any of the three new hues, while `11`
phase 6 required it to write `data-mode` on `#live-root` and `12` G3.1 read it
there: the control and the element it mutates were in different token scopes.

*Rejected:* moving `.aw` to a wrapper and leaving the counting rules as written.
*Why:* G1.1 and P7 are written against `#live-root` specifically, and silently
changing which element they count is how a budget stops being a budget. Both
selectors are now named in both places: `.aw` is the token scope, `#live-root` is
the region container, and no check reads one meaning the other.

**D47. Horizontal overflow is measured geometrically, not with
`documentElement.scrollWidth`.**

*Rejected:* the shipped measurement. *Why:* it cannot fail. `global.css:70-74`
puts `overflow-x: hidden` on `html` and `:76-78` on `body`, at HEAD and in the
worktree. The root's overflow propagates to the viewport, so
`document.documentElement.scrollWidth` is clamped to `clientWidth` whatever the
layout does, and `qa-live.ts:300-303` measures exactly that expression. Probed in
Chromium at 480x900 against a 1200px child: with neither rule the check fails
correctly at 1208 against 480; with `body` alone it still fails correctly at
1200; with both, as shipped, it reports 480 against 480 and passes. The `html`
rule is the one that does it, and `global.css` is on `11`'s forbidden edit list,
so the propagation cannot be fixed from inside this programme.

The replacement, in `12` P5 and R4, `11` phase 9, and the added `qa-live` checks:

```js
const root = document.getElementById('live-root');
Math.max(...[...root.querySelectorAll('*')].map(e => e.getBoundingClientRect().right))
  <= window.innerWidth
```

plus `el.scrollWidth <= el.clientWidth` on every element not declared
`overflow-x: auto`. In the same probe the geometric form returned 1200 against an
`innerWidth` of 480 in all three cases. `00` section 6.1 records that the shipped
check is a no op, so nobody re derives a constraint from it.

**D48. Component contracts and drawn strings are edited in place. Prose lanes are
not.**

*Rejected:* the blanket policy in `README:96`. *Why:* it is right about prose and
wrong about artifacts. Leaving a superseded argument in place is what makes the
surviving one look earned rather than arbitrary. But `09` is the document an
implementer builds components from, and an ASCII wireframe is the thing they
paste. `09` section 4.2 still asserted it followed `03` section 2.3 "exactly"
after C1 and C2 had removed two of its four branches, so the pack shipped two
opposite answers to the replay versus live question and the wrong one was in the
build spec. `06` section 4 still drew the string C3 forbids, in the position
where it does the most damage. `05` section 5 row 9 reported a violated motion
budget as satisfied.

So: typed props, branch tables, drawn strings and verification tables are
corrected where they stand, each with a marker naming the decision. Narrative
reasoning is left as written. A verification table that reports a violated budget
as satisfied is the one kind of lane text that must never be left alone.

**D49. Page chrome is inside the honesty scope and has its own word cap.**

*Rejected:* scoping every honesty check to `#live-root`, which `12` G1.2, G1.5,
H2 and G6.1 all did. *Why:* it makes the class of defect the gate exists to catch
invisible by construction. `live.astro:22` asserts, in the page header, "One
governed read, one deliberate failure, one policy-authorised retry." That
sentence renders identically in `unavailable`, in `ready` before anything has
run, and on a `LIVE_MODE=false` deployment that cannot run anything, which `05`
section 3.8 calls the highest confusion risk in the set. It is the hopeful
default `03` section 5 item 15 forbids, sitting a few lines above the
`data-state` this pack goes to some trouble to correct in the same file, and `10`
section 5 previously touched it only to change `authorised` to `authorized`.

The lede becomes a description of what the demo will do: **`A governed read, a
deliberate failure, and a bounded recovery policy.`** `12` H2, V3 and V4 rescope
from `#live-root` to `<main>`; the word and control budgets stay on the story
body, where they belong.

*Rejected:* leaving chrome outside the word count, which is how C12 reached 63 by
moving the run id there. *Why:* `03` section 3.3 defines the budget as visible
prose in the first viewport, the command bar is in that viewport, and the judge
reads it. Excluding it by reclassification makes the budget measure a subset of
what the reader sees and establishes a precedent that any future overflow can be
relieved the same way. The command bar gets its own cap: **at most 8 visible
words**, currently 5 (product name, page title, run id, two mode labels). C12's
arithmetic stands; the escape hatch is now bounded.

**D50. `/viewer` does not import `workspace.css` and does not carry `.aw`.**

*Rejected:* `11` phase 7's instruction that `--viewer-violet` becomes
`--aw-violet`. *Why:* `08` sections 1.2 and 1.3 make the file route scoped as a
deliberate fail safe, "a stray `.aw` class on another page changes nothing
because the file is not loaded there". Nothing in the pack adds the import to
`viewer.astro` or puts `.aw` on its subtree, so `--aw-violet` there resolves to
nothing and the declaration is dropped by the cascade. Writing
`var(--aw-violet, #a78bfa)` instead reintroduces the literal beside a token that
`08` section 0.3 cites `viewer.astro:173-174` for.

*Rejected:* importing `workspace.css` on `/viewer`. *Why:* `08` section 1.1
requires that the new layer cannot change any existing route, and `/viewer` is an
existing route with a browser check on it. Two routes sharing the layer means a
token edit is a two route change, which is the property the scoping exists to
prevent.

So on `/viewer`: `--viewer-blue` becomes `--fs-accent`, and the Warden hue is
either an `--fs-` token or the route does not paint one. `/viewer` currently has
no Warden concept in its UI, so not painting one is the cheaper answer and phase
7 takes it.

**D51. A gate item that cannot be reached in this programme's scope is
quarantined, not waived.**

*Rejected:* leaving H8, H9, H13 and the two recorded fallback screens in the main
list. *Why:* `12` opens with "an item that cannot be observed is not on this
list", and four of them are not observable inside the file scope `11` grants. H9
needs a non 200 upstream at `tools.py:132-136`, but `qa-live.ts:91` runs with
`FLEETSCOPE_WORKER_OFFLINE: 'true'`, `transport.py` returns 200 from a module
constant, `apps/api/**` is forbidden and the worker is gated to a one word edit.
H8 needs `recovery.py` to return a `refuse_*` outcome, but the only scenario is
`idempotent_read` with one permitted retry and a retryable injected fault, and
`runs.ts` accepts one field from a fixed enum, so no input produces a refusal.
H13 and both recorded branches need a scripted run reachable from `/live`, which
section 7.3 already records as impossible.

An item that fails a correct build gets waived on its first run, and a waived
item stops guarding anything. So they move to `12` section 2a, keyed to the
deferred work that unblocks each, and the states they cover get unit level
coverage in `apps/web/tests/live-state.test.ts`, which `11` already permits. The
browser gate covers the MCP reachable states and says so.

---

## 3. Contradictions found between the lane documents

Forty. Twenty five found when the lanes were reconciled, and fifteen more that
three adversarial reviewers found afterwards, listed as C26 to C40 and resolved
in the same way. Severity is the cost of getting it wrong in the built product,
not the effort to resolve it.

| # | Subject | Lanes in conflict | Severity |
|---|---|---|---|
| C1 | Run level chip on zero event states | 03, 04, 05, 07, 09 | high |
| C2 | Provenance derivation | 03 vs 04 | high |
| C3 | `Controlled Fault` as a run-level label | 04, 06 vs 03 | high |
| C4 | How to fix `.live-beat__status` | 04, 05 vs 07 | high |
| C5 | Visible per beat truth chips | 07, 08, 09 vs 05 | medium |
| C6 | The fault beat on a live incident | 07 vs shipped, 04 | medium |
| C7 | `BeatStatus.refused` | 05 vs 04, 09 | medium |
| C8 | `authorised` vs `authorized` | 04, 05 vs 07 | low |
| C9 | `authoritative` in the completed sentence | 04, 05 vs 07 | high |
| C10 | The `awaiting_agent` sentence | 04 vs 05 vs 07 | low |
| C11 | The `awaiting_agent` copyable artifact | 05 vs 07 vs 09 | medium |
| C12 | The `awaiting_agent` word budget | 03, 05 vs 07 | medium |
| C13 | Where the run id lives | 04, 05 vs 03, 09 | low |
| C14 | A rendered "status word" per state | 07 vs 05 | medium |
| C15 | Motion on entering `completed` | 04, 05 vs 03, 08 | medium |
| C16 | The busy affordance in `starting` | 04 vs 08 | low |
| C17 | Which type step carries 36px | 02, 08 vs 05 | high |
| C18 | "No border in the story body" | 05 vs 08 | low |
| C19 | The incident disclosure on `completed` | 07 vs 05 | medium |
| C20 | `Back to result` vs `Back to the run` | 04, 05 vs 07 | low |
| C21 | Where the blocked reason renders | 05, 07 vs shipped | low |
| C22 | The graph on `/live` | locked direction, 09 vs 06 | high |
| C23 | The agent rail's data source | 06 vs 09 | medium |
| C24 | The mode switch signal on `/live` | 09 vs the page | low |
| C25 | `#live-facts` vs `.live__facts` | 05 vs shipped | low |
| C26 | Who the topology line names on the Warden screens | 05 vs 09, vs shipped | high |
| C27 | What region C may hold on `awaiting_agent` | 05 vs 03 | high |
| C28 | The horizontal overflow assertion | 12, 11, 09 vs shipped `global.css` | high |
| C29 | Two pass bars for one negative space measurement | 12 G2.4 vs 12 R6 | medium |
| C30 | The hue count is unsatisfiable as a cardinality | 12 G1.5 vs 08 section 7 | high |
| C31 | Orange on the beat marker | 08 section 7 rule 3 vs 12 V3 and D14 | medium |
| C32 | Which `getAnimations()` call | 08 V7 vs 12 G6.2 vs 11 phase 4 | medium |
| C33 | Hiding versus constructing the canvas | 06 13.2 vs D22 | medium |
| C34 | A rendered event count derived from the cursor | 06, 12 H4 vs 09 section 4.1 | medium |
| C35 | `expertAvailable` has no field behind it | 09 section 4.1 vs D18 | medium |
| C36 | Absence words on three shipped fact defaults | 09 sections 4.6, 4.7, 4.12 vs 09 section 2.1 | high |
| C37 | How many tab stops the site nav is | 12 A4, 09 section 2.3 vs `Nav.astro` | medium |
| C38 | Two cited crate files do not exist at the baseline | 09 sections 4.8, 4.13 vs the worktree | high |
| C39 | `global.css` line numbers are worktree coordinates | 00, 09 vs HEAD | medium |
| C40 | Whether the delegation line renders on `awaiting_agent` | 05 vs 03, 09 | medium |

### The eight that change what gets built

**C1. The run-level chip on states with no events.**

`03` section 2.3 derives `Unknown` for `capability !== null && events.length === 0`.
`04` section 3.4 assigns `awaiting_agent` the label `Live`. `05` section 3.2 draws
a `LIVE` chip. `07` sections 3.4 and 7.5 show no chip and flag the conflict. `09`
section 4.2 lists `Unknown` as one of the badge's four states.

*Resolution:* **no chip when `events.length === 0`, except `unavailable`, which
renders `Unavailable`.** `04` section 3.2 already reached this conclusion for
`ready` and gave the reason: `Unknown` invites the reader to think something was
attempted and could not be classified. The same argument covers `starting` and
`awaiting_agent`. `Live` is worse still: it is a hopeful default on a screen with
no record, the same class of error as the hardcoded `data-state="ready"`. The
internal `provenance` field still returns `'unknown'` for an empty event list, so
`04` section 6's derivation is untouched; the component renders nothing for it at
run level. There is no confusion risk from the missing chip, because
`awaiting_agent` requires `cap.runDriver === 'mcp'` and an admitted run, so a
recorded transcript can never reach it.

*Supersedes:* `03` section 2.3 row 3, `04` section 3.4, `05` section 3.2, `09`
section 4.2's `Unknown` state. Resolves `07` open question 3.

**C2. Two incompatible provenance derivations.**

`03` section 2.3 derives run-level truth partly from the state, including
`state === 'historical_replay' -> Recorded`. `04` section 6 derives it from the
events alone.

*Resolution:* **`04` wins**, as `05` section 8.5 already argued. They disagree on
a case a judge will actually produce: run the live MCP demo, then press
`Replay evidence`. Under `03` the chip flips from `Live` to `Recorded`, stating
that the run was a recording. It was not. A rule that relabels history is the
failure this codebase is arranged against.

**C3. `Controlled Fault` at run level.**

`04` section 3.6 gives the `controlled_fault` state the truth label
`Controlled Fault`. `06` section 4 draws the Expert region A header as
`run 019f2a · Controlled Fault · 8 events`. `03` section 2.3 forbids exactly
this.

*Resolution:* **the run-level chip never reads `Controlled Fault`, in either
mode.** Promoting it claims the whole run was a fault, which is the inverse of
what happened: the fault was one deliberate beat inside a successful recovery.
The words live on the third step of the path and in the incident line. `05`
section 8.2 resolved this for Story; this extends the same ruling to `06`'s
Expert header, which had reintroduced it.

**C4. How to fix `.live-beat__status`.**

Every lane found the same defect: `client.ts:78-85` writes the truth label into
the element named status, so a done beat reads `Live` and never `Done`. They
disagree on the fix. `04` section 7.4 and `05` section 8.6 keep the truth word in
that element and change no test. `07` section 7.2 adds a `.live-beat__truth`
sibling, moves the real status word into `.live-beat__status`, and edits
`qa-live.ts:240` in the same commit.

*Resolution:* **keep the shipped content. No `.live-beat__truth`.** The status
word goes into a visually hidden span, and `data-status` remains the machine
readable status it already is. `qa-live.ts:240-245` asserts that
`[data-beat="fault"] .live-beat__status` trims to exactly `Controlled Fault`, and
that assertion is shipped, correct about what the element contains today, and the
only external check on the fault label. `07`'s version is semantically cleaner
and buys nothing a reader or a screen reader can perceive, at the cost of editing
the one check that guards the most important word on the page. The name is wrong
and stays wrong; it is recorded as known rather than renamed.

*Supersedes:* `07` sections 6.3, 6.4 and 7.2, and the `qa-live.ts:240` row of
`07` section 8.1.

**C9. `authoritative` in the `completed` sentence.**

`04` section 3.10 and `05` section 3.6 keep the shipped sentence verbatim,
including "returned the authoritative result". `07` sections 1.6 and 7.1 show the
word is not entitled: `RecordedReadOnlyHttp.get` returns `status=200` from a
module constant (`transport.py:53-57`), `mcp_server.py:278` then emits the
success `tool_result` with `truth="live"` unconditionally, and
`GET /runs/capability` does not publish the offline flag even though the API
reads it at `worker.ts:89`. `qa-live.ts:91` sets `FLEETSCOPE_WORKER_OFFLINE: 'true'`,
so the run this repository points at as its proof is the exact run where the word
is false.

*Resolution:* **drop `authoritative` now; publishing the capability flag is a
follow up that unlocks it.** The two sentences differ by one word, the reader
loses nothing they will notice, and the product stops making a claim it cannot
currently support. No check asserts `#live-sentence`, verified across
`qa-live.ts:178-297`, so this is free today and will not be free once someone
adds one. The term `Runtime confirmed` is not displayed at all until the flag
exists.

**C17. Which type step carries the 36px.**

`02` section 3.3 named the top step "outcome" and `08` section 3.5 sized
`--aw-measure-outcome: 34ch` by wrapping the 133 character `completed` sentence
at 36px into four lines. `04` introduced a `Headline` field per state, and `05`
drew all nine screens with the headline at 36px and the current sentence at 21px.

*Resolution:* **`05` wins. The headline is the 36px object; the sentence is
21px.** A 20 word sentence at 36px is a four line block roughly 166px tall, which
is a paragraph rather than a focal point, and `05`'s per screen focal point table
depends on the headline being the largest object. Consequence: the token
`--aw-measure-outcome: 34ch` is re derived as `--aw-measure-sentence: 46ch`, at
which 133 characters lands in the three lines `05` drew. `08` section 5.3's
negative space arithmetic assumed region A at 720x150; a narrower sentence block
reduces assigned area, so the 45 percent contract and the 70 percent smoke alarm
both still hold with more headroom, not less.

**C22. Whether Expert Mode on `/live` has the Zoetrope graph.**

The locked direction says Expert Mode is "Zoetrope graph plus terminal evidence
plus canonical timeline". `09` sections 4.9 and 4.10 specify `AgentNode` and
`RuntimeEdge` as "Expert only" without naming a surface. `06` specifies the graph
and the rail entirely against the renderer ABI, and section 15 leaves open
"whether the agent workspace's Expert Mode and `/viewer` are one surface or two".

*Resolution:* **`/live` Expert Mode has no canvas. The graph is `/viewer`'s.**
Three verified facts settle it. `agent_viewer_load(name, main, companions)` takes
session document text, and grep finds exactly two call sites, `/viewer` for a
file the visitor picks and `/dashboard` for the bundled demo; no adapter from
canonical run events to a session document exists anywhere in the repository. The
ABI has no append path, and `Viewer::load` rebuilds `app` and `manifest` at
fraction 1.0 with `Playhead::Edge`, so feeding a 400ms polled live run to it
would reset camera, selection and playhead 2.5 times a second, which is `06`'s
own section 1 finding used as the argument against its own placement. And the
rail's data source on `/viewer` is `agent_viewer_agents()`, which has nothing to
answer without a session.

So Expert Mode ships in two tiers. Tier one, in this programme, on `/live`: the
canonical timeline, the event console, Decision Evidence, the text agent rail of
C23, and the relocated fact list. Tier two, `/viewer`: the graph, the ABI backed
rail, the sidecar states, everything `06` drew. The bridge between them is a
canonical events to session adapter, deferred in section 7 with its cost.

**C12. The `awaiting_agent` word budget, and what has to give.**

`03` sets 62 visible words per screen. `05` measured `awaiting_agent` at 44 with
an 11 word sentence, no dead end note and a three token invocation line. `07`
specifies a 15 word sentence, an eight token prompt line, a `Copy prompt` button
and a 16 word dead end note. Nobody counted the combination.

*Resolution:* recounted with every other decision in this document applied:

```
headline        Your turn                                              2
sentence        FleetScope holds no model credential, so the next
                move is yours.                                        11
asserted line 1 Your Gemini/Antigravity agent is ready to call
                FleetScope.                                            8
asserted line 2 FleetScope is governing the tool and recovery policy.   8
prompt line     Use the fleetscope tool read_repository_metadata on
                google/adk-python                                      8
button          Copy prompt                                            2
dead end note   If your agent never calls, this run stays open and a
                new one will be refused.                              16
step labels     Start, Governed read, Controlled Fault, Warden retry,
                Result                                                 8
                                                                     ---
                                                                      63
```

**63, and the budget is 62.** The screen is granted a stated exception of 63,
because 16 of its words are `AWAITING_AGENT_LINES` asserted verbatim at
`qa-live.ts:213-214` and cannot be shortened, reworded or merged. This also
settles C10 in favour of `05`'s 11 word sentence rather than `07`'s 15 word one,
because at 15 the total is 67 and there is nothing left to cut that is not
either asserted or the honest dead end. It settles C13 by moving the run id to
the command bar. **Amended by D49:** the command bar is in the first viewport and
the judge reads it, so calling it chrome does not put it outside the reader's
count. It gets its own cap of 8 visible words, currently 5, so the move is
bounded and cannot be repeated the next time a screen lands at 64.

### The rest, resolved

**C5. Visible per beat truth chips.** `07` section 6.3, `08` section 7 and `09`
section 4.4 all assume a per beat truth chip with orange on the fault beat. `05`
section 8.6 forbids any visible per beat status word. *Resolution:* Story renders
labels and markers only; **orange rides on the fault step's own label**, which is
already the words `Controlled Fault`, so `08`'s token to state map is satisfied
without a second element. Per beat truth chips are Expert Mode.

**C6. The fault beat on a live incident.** `07` section 3.7 wants the fault beat
to stay `Pending` when `truth === 'live'`, because the beat is named for a
specific kind of failure. Shipped `deriveBeats` marks it `done` whenever an
`incident` event exists. `04` section 3.7 says active. *Resolution:* **shipped
code wins.** Suppressing the beat means a run that had a real failure shows no
beat for it, which loses more than the label mismatch costs. The beat is `done`,
its truth word reads `Live`, it takes no orange, and the headline `Read failed`
plus the verbatim reason carry the distinction. Recorded as an accepted residual:
the step labelled `Controlled Fault` can be reached by a failure that was not
one, and the three other signals on the screen say so.

**C7. `BeatStatus.refused`.** `05` section 8.3 requires it; `04` section 8.1
states `BeatStatus` is unchanged; `09` section 4.4 lists the shipped five values.
*Resolution:* **`05` wins and amends both.** Verified that shipped `BeatStatus`
is `pending | active | done | failed | unknown`, so this is a real addition.
`BEAT_DEFINITIONS` entries need a predicate over the matched event rather than a
list of kinds, because the distinction is in `payload.outcome`. No browser check
changes: `qa-live.ts:237-239` asserts all five steps are `done` only on the
successful run, where the outcome is `retry_once`.

**C8. `authorised` vs `authorized`.** `04` section 3.8 and `05` section 3.5 write
`Retry authorised`; `07` section 7.3 rules `z`. *Resolution:* **`z`.** See D25.
Four visible sites change: `state.ts:285`, `state.ts:313`, `live.astro:22`,
`mcp_server.py:359`.

**C11. The `awaiting_agent` copyable artifact.** `05` draws
`read_repository_metadata   target: google/adk-python` with a `Copy` button. `07`
specifies a natural language prompt with `Copy prompt`. `09` names the prop
`startCommand`. *Resolution:* **`07`'s prompt, `07`'s button label, and the prop
is renamed `startPrompt`**, because the word "command" is what reintroduces shell
syntax at the next edit.

**C14. A rendered status word per state.** `07` gives every state block a
"Status word" slot, and its own budget table in section 3.0.1 puts `Completed`
inside the truth chip. `05` renders no status word on any screen. *Resolution:*
**no status word is rendered in Story Mode.** The state's name lives in
`data-state` and in the headline. Rendering both would put one fact in two
places, and it is what pushed `Completed` into the provenance chip in `07`'s own
count. This also resolves `07` open question 1: `failed` needs no approved status
word, because the headline `Not recovered` is the word.

**C15 and C16. Motion in Story.** Resolved by D17: zero, no exceptions, including
the one shot on entering `completed` and the busy indicator in `starting`. The
deciding argument is that `08` check V7 asserts `getAnimations()` is empty in all
twelve states, and a check with two documented exceptions is not a check.

**C18. "No drawn border inside the story body".** `05` section 7 precondition P4
requires every `border-*-width` under `#live-root` to compute to `0px`. `08`
section 5.2 spends two border declarations, one of which is the secondary
action's outline, inside the story body. *Resolution:* **P4 is restated** as: no
border on any element in the story body except a control's own boundary, which is
the secondary action and whatever holds `:focus-visible`. The intent, no grouping
borders, is preserved and the check becomes true.

**C19. The incident disclosure on `completed`.** `07` section 4.1 puts a 112 word
disclosure behind one reveal on both `controlled_fault` and `completed`, and
section 5 puts the four sentence explanation on `completed` behind a disclosure
too. `05` section 4.2 has `completed` at the cap of three controls, and states
that a fourth is a defect. *Resolution:* **the disclosure lives on
`controlled_fault` and in Expert Mode.** `controlled_fault` has zero body
controls, so the disclosure is the first of a permitted three. On `completed` the
reader goes to Expert Mode, which is exactly what the primary action
`Replay evidence` is inviting.

**C20. `Back to result` vs `Back to the run`.** `04` section 3.12 and `05`
section 3.9 say `Back to result`; `07` section 3.12 says `Back to the run`.
*Resolution:* **`Back to result`**, handle `#live-replay-back`. Two lanes to one,
and it is the phrase that only makes sense to a reader who understands they left
something, which `05` names as part of the guard against replay reading as live.

**C21. Where the blocked reason renders.** Shipped `live.astro:35` has
`<p id="live-blocked" role="status" hidden>`. `05` variant B and `07` section 3.2
both put the blocked string in the sentence slot. *Resolution:* **`#live-sentence`
carries it**, so there is one voice and one live region. `#live-blocked` stays in
the DOM, empty and `hidden`, and loses its `role="status"` so a blocked
deployment does not double announce. Verified that no check in `qa-live.ts`
references `#live-blocked`.

**C23. The agent rail's data source.** `06` section 5 derives it from
`agent_viewer_agents()`; `09` section 4.8 derives it from `event.agent`.
*Resolution:* **two rails on two surfaces.** On `/live` it is `09`'s, derived from
`event.agent`, because that is the only place agent identity exists on the
canonical plane. On `/viewer` it is `06`'s, because that is where a session
exists. They share a shape and not an implementation, and this is a consequence
of C22 rather than a separate decision.

**C24. The mode switch signal.** `09` section 2.2 specifies a three part signal:
`data-mode` on the root, `data-cockpit-mode` on `documentElement`, and a
`fleetscope:mode` custom event. *Resolution:* on `/live` the switch writes
`data-mode` on `#live-root` and mirrors `?mode=`. The other two parts exist so
that `CockpitMount` can order its reveal before its mount, and no renderer is
mounted on `/live`, so emitting them there would be signalling to nobody. The
three part contract stays exactly as it is on `/cockpit` and `/viewer`.

**C25. `#live-facts`.** `05` section 3.6 refers to "the six field `#live-facts`
list". There is no such id. Shipped `live.astro:51` is `<dl class="live__facts">`
with six per field ids. *Resolution:* citation error in `05`; the per field ids
are the contract and the class is `live__facts`.

### The fifteen found by adversarial review

**C26. Who the topology line names on the Warden screens.**

`05` sections 3.5 and 3.7 drew `warden · Delegation: Unknown...` on
`warden_authorized`, `recovering` and `failed`, and justified it: "`mcp_server.py:253`
emits the intervention with `agent="warden"`". `09` section 4.5 says the opposite,
"last tool_call's agent, else last event's agent", and "typically `external_agent`".

*Resolution:* **`09` wins, and it is not a preference. `05` was false against the
shipped derivation.** `state.ts:233` is
`lastOf(events, 'tool_call')?.agent ?? events.at(-1)?.agent ?? null`. On every
Warden screen a `tool_call` already exists at sequence 2, so the last tool_call
branch wins and the line renders `external_agent`. The comprehension cost is the
one the pack works hardest to avoid: on the two screens that credit the Warden,
the only actor named in region B would have been the judge's own agent, sitting
one line under a sentence saying the Warden allowed the retry, and a sixty second
reader attributes the decision to the agent. That is exactly the belief `07`
section 2.7 exists to prevent. `05` is corrected in place under D48. The word
counts are unaffected: `external_agent` is one token, as `warden` was.

Who decided is named in region A's sentence, where the Warden is the grammatical
subject, per rule 3 of `11`. Region B names who acted. The two are different
facts and the screen now states each once.

**C27. What region C may hold on `awaiting_agent`.**

`05` section 3.2 put a mono invocation line, a `Copy` control, a run id and a
reserved dead end line into region C, and called the mono line the screen's focal
point. `03` section 3.1 defines region C as "primary action. The only thing the
reader can do."

*Resolution:* **`03` wins.** Four content items, three of them not the action, is
region C absorbing evidence because no fourth region is available to hold it,
which is the grouping failure `03` diagnoses in the prototype arriving from the
opposite direction. Making a mono evidence block focal also runs against `03`
section 5 and `12` G2.1, which restricts mono in the story body to identifiers,
sequences and the copyable prompt, "no sentence, no label, no button". C12 had
already reworked the contents and moved the run id to the command bar without
revisiting the region assignment or the focal claim.

The prompt and the dead end note move to **region A**: the prompt is the
instruction the sentence above it promises, and the note is a statement about the
run's status. Region C holds `Copy prompt` alone. The focal point becomes the
36px headline `Your turn`, so no mono object is focal on any Story screen and P2
needs no exception here. Word count is unchanged at 63, because items moved
region rather than arriving or leaving.

**C28. The horizontal overflow assertion.**

`12` P5 and R4, `11` phase 9 and `09` section 4.3 all treat
`document.documentElement.scrollWidth === clientWidth` as a hard guard, and `09`
calls it "absolute".

*Resolution:* **the shipped check cannot fail, measured rather than argued.** See
D47 for the probe and the replacement. Recorded here because three documents
derived design constraints from it, and `00` section 6.1 now says so where an
implementer reading the QA contract will see it.

One correction to the finding that raised this: the review attributed it to
`body { overflow-x: hidden }` at `global.css:78` and said `html` was
`overflow: visible`. `html` is explicitly `overflow-x: hidden` at
`global.css:70-74`, and the probe shows that `body` alone leaves the check
working correctly. The conclusion was right and the mechanism was not, which
matters because a reader who fixed only the `body` rule would think they had
restored the check.

**C29. Two pass bars for one negative space measurement.**

`12` G2.4 reads "at most 55 percent assigned, investigate above 30 percent".
`12` R6 reads "more than 70 percent of `<main>` is unassigned", which is a pass
bar of 30 percent assigned. `11` phase 10 tells the implementer to automate both.

*Resolution:* **G2.4's bar survives; R6 is restated against it.** A reviewer
measuring 42 percent at 1440x900 in `completed` currently passes one and fails
the other. `08` section 5.3 is the arithmetic behind the number and it derives a
45 percent contract with 55 as the ceiling and 30 as the smoke alarm, so the
55 percent bar is the derived one and the 70 percent phrasing in R6 was the
aspiration read as a threshold. R6 becomes: "Story is one column with a measure
cap; assigned area is at most 55 percent of `<main>` and the target is under 30."

**C30. The hue count is unsatisfiable as a cardinality.**

`12` G1.5 and V2 count "distinct non transparent colour values in use across
visible elements in the story body", passing at "at most 4, of which at least 1
is the neutral ink ramp". `08` section 7 assigns three distinct ink values inside
Story and gives `completed` blue fill, violet, orange and `--fs-bg` as the ink on
the blue fill at once.

*Resolution:* **restate it as a hue count with an explicit collapse list and a
fixed permitted set.** A DOM check on `completed` sees `--fs-text`,
`--fs-text-muted`, `--aw-violet`, `--aw-orange` and `--fs-bg`, which is five, and
six with `--fs-text-faint`, against a bar of four. No automated counter can know
that three greys collapse into "the ink ramp" because `12` never supplied the
allowlist, so the item was both unsatisfiable and unimplementable as written.
The check now collapses `--fs-text`, `--fs-text-muted`, `--fs-text-faint` and
`--fs-bg` into one neutral bucket and compares the rest against the fixed set
`--fs-accent`, `--aw-cyan`, `--aw-violet`, `--aw-orange`. Comparing against a set
is also a better check than counting: it fails on a wrong hue, not only on a
fifth one.

**C31. Orange on the beat marker.**

`08` section 7 rule 3 says orange marks "the Controlled Fault beat and its label".
`12` V3 requires every element computing to `--aw-orange` to carry the string
`Controlled Fault` in its text or accessible name. D14 makes the markers glyphs
each carrying a visually hidden status word, which means the glyph is
`aria-hidden` or the announcement doubles.

*Resolution:* **orange applies only to the element whose text is the words
`Controlled Fault`; the marker takes the neutral ink.** An `aria-hidden` glyph
has an empty accessible name and a text content of `●`, so an orange marker fails
V3, and the implementer would have discovered it when the check they were told to
write failed against the design they were told to build. `08` section 7 rule 3 is
corrected in place under D48.

**C32. Which `getAnimations()` call.**

`08` V7 and `12` V7 say `document.getAnimations()` on the story body. `12` G6.2
says `getAnimations()` on the story body. `11` phase 4's done condition says the
same. Three phrasings, two different APIs.

*Resolution:* **`document.getElementById('live-root').getAnimations({ subtree: true }).length === 0`.**
`Element.getAnimations()` without the option returns animations targeting that
element only, so a descendant animating passes. `document.getAnimations()`
returns the whole document, which on `/live` includes the nav and anything
`global.css` animates, so the check fails for reasons outside the workspace. D17
makes zero motion absolute precisely because "a check with two documented
exceptions is not a check", and this is the pack's most load bearing motion
guard, so the call is now written out wherever it appears.

**C33. Hiding versus constructing the canvas.**

`06` section 13.2 says `#agent-viewer-canvas` "must never be inside a subtree
that Expert Mode hides". D22 says "once built, hiding and revealing is safe; only
construction is the hazard". `06` section 14 item 3 records that the shipped
`/viewer` canvas sits outside the mode panels and is visible in both modes.

*Resolution:* **D22 wins.** The hazard `CockpitMount.astro:146-180` documents is
that ratzilla sizes the grid from `parent.client_width()` exactly once, at
construction, so a grid built at zero columns draws nothing forever while the
status line, summary and fingerprint all still look correct. Hiding a measured
canvas is harmless. `06` 13.2's rule is restated as "must never be *constructed*
inside one", which is the rule that prevents the blank canvas both documents
exist to prevent, and phase 7 no longer has to choose between two normative
statements pointing in different directions.

**C34. A rendered event count derived from the cursor.**

`06` renders "8 events" and "8 events loaded" in region A and the timeline
header. `09` section 4.1 gives RunCommandBar only
`cursor: number; // events.highWaterMark`, and no contract defines an event
count. `12` H4 then checks rendered rows against `#live-cursor`.

*Resolution:* **add `eventCount: number // events.length`, and never derive a
count from a cursor.** `highWaterMark` is the last stored event's `sequence`
(`runs.ts:152, 183, 276`), not a count. `RunEventLedger.all` drops any line that
fails `parseWorkerEvent` and any duplicate sequence, and `POST /runs/:runId/events`
counts rejections and stores nothing for them, so one rejected event leaves
`highWaterMark` one higher than the number of events that exist, and the header
would state a count no set of events supports. That is `12` void condition 8, and
the gate could not catch it because H4 compared the rendered rows to the same
cursor. H4 is restated: the number of timeline rows, the number of console rows
and any rendered event count all equal `events.length`, and `#live-cursor` may
legitimately exceed it.

**C35. `expertAvailable` has no field behind it.**

`09` section 4.1 declares
`expertAvailable: boolean; // false when the WASM renderer failed to load`, with
a state row for it. D18 and `11` phase 6 remove the renderer from `/live`.

*Resolution:* **delete the prop and the row.** No wasm module loads on `/live`, so
nothing can ever set the flag false and the state is unreachable. A prop with no
field behind it is the failure class D23 and `12` section 9 item 2 exist to
catch, appearing inside the document that defines the rule. The renderer
unavailable state stays on `/viewer`, where `06` section 11 specifies it.

**C36. Absence words on three shipped fact defaults.**

`09` section 4.6 renders `none` when there is no incident, justified as "the
shipped empty value, and QA only asserts the populated case". `09` section 4.12
does the same for the policy rationale and `09` section 4.7 renders `not yet` for
the result. `09` section 2.1 defines `None` as "an event exists and its value is
genuinely empty" and `Not observed` as "reportable in principle, and no event
carries it yet".

*Resolution:* **all three become `Not observed`.** No incident event is the second
case, not the first, so "Incident reason: none" during a run in flight states
that the run had no incident, and "Policy rationale: none" states that the Warden
made no decision. `not yet` is not one of the four words at all. `12` H11 forbids
exactly this, so the pack contained a component contract its own gate failed, and
the justification given, that QA only asserts the populated case, is an argument
that nothing will catch it rather than an argument that it is true.

Verified free against `scripts/qa-live.ts`: `:248-250` asserts `#live-policy` is
non empty and not the literal `none`, which `Not observed` satisfies; `:253`
asserts `#live-incident` contains `Controlled Fault`, populated only; `:257`
asserts `#live-result` trims to exactly `succeeded`, populated only. No shipped
check is edited. These fields move to Expert under D16, so the strings are read
there.

**C37. How many tab stops the site nav is.**

`12` A4 says "six stops: skip link, nav, mode switch, `#live-start`,
`#live-replay` when present, `#live-replay-back` when present". `09` section 2.3
lists "2 site nav" as one entry.

*Resolution:* **the nav is nine stops.** `Nav.astro:32` renders a brand anchor and
`Nav.astro:15-23` maps seven links, which D2 takes to eight. A reviewer tabbing
through Story Mode counts fourteen, not six, and records a failure against an
item that is wrong rather than against the page. A4 becomes "six stops after the
site nav" and `09` section 2.3 states the nav as nine so the number is checkable.
`09` section 2.3's Expert list also loses its graph canvas stop, which D18
removed from `/live`, so `12` A5's "four more stops" becomes three.

**C38. Two cited crate files do not exist at the baseline.**

`09` section 4.8 specifies AgentRail's keyboard against
`crates/agent-viewer-render/src/selection.rs:33-36` and `09` section 4.13 makes
the manifest mapping normative, citing
`crates/agent-viewer-render/src/manifest.rs:5-12`.

*Resolution:* **split both contracts by surface, and record the dependency.** Both
files are untracked in this worktree and do not exist at `cfdcca7`, which the
README names as the baseline everything was read against. The wasm ABI at HEAD
exports `load`, `load_demo`, `summary`, `fingerprint`, `snapshot`, `formats`,
`go_live`, `seek` and `toggle_play`, so `agent_viewer_select_agent`,
`agent_viewer_agents`, `agent_viewer_graph_nodes`, `agent_viewer_item_at` and
`agent_viewer_seek_sequence` are all in flight too. Separately, D18 and C23
remove the renderer from `/live` entirely, so on that route there is no selection
to destroy and no `SelectionOutcome` to match. And `crates/**` is forbidden, so if
that work is reverted the `/viewer` half cannot be satisfied within scope.

The `/live` half of each contract depends on none of it and is unblocked. The
`/viewer` half carries an explicit dependency note, and `11` phase 7 gains the
same gate it already has for `viewer.astro`.

**C39. `global.css` line numbers are worktree coordinates.**

`00` sections 2.2, 2.3 and 5, `09` section 2.2 and D22 and D33 cite `global.css`
by line: `:2108-2110`, `:661-711`, `:1436-1457`, `:942-952`.

*Resolution:* **navigate by selector; the offsets are recorded and are not
constant.** At HEAD the expert surface rule is at 1764, `.fs-status` at 334,
`.fs-cockpit-layout` at 1092 and `.fs-button[data-variant='primary']` at 615. The
in-flight work inserts 327 lines at `global.css:107` and a further 19 across three
hunks between HEAD lines 965 and 1003, so a citation at or above HEAD line 107 is
off by +327 and one below HEAD line 1003 by +344. `11` tells the implementer to
confirm whether that work has landed or been reverted, and `global.css` is
forbidden to edit, so these are read-only navigation done with coordinates that
resolve to the wrong rules in the reverted case. `00` carries the offset table and
the selector list at the head of the document.

**C40. Whether the delegation line renders on `awaiting_agent`.**

`05` section 3.2 lists `#live-delegation` under "attached, not rendered". `05`
section 2.1 draws it in region B, `03` section 2.1 makes it item 6 with an 8 word
allowance "on every screen", and `09` section 4.5 calls it "reading order item 6
in its Story form: one line".

*Resolution:* **it is attached and not rendered until the first canonical event,
per D40**, and `03` and `09` are amended to say so. This changes an arithmetic
result, which is why it had to be ruled rather than left: C12's recount grants
`awaiting_agent` 63 words and its table omits the delegation line entirely, so if
the line rendered there the screen would be 70 words and `12` G1.2 and P8 would
fail against the granted exception. `05` section 3.3 already gave the reason for
withholding it and it is the same reason C1 gives for the chip, so this is one
rule surfacing in three places rather than three judgements. `12` P6 is satisfied
by DOM presence, because Playwright's `textContent()` resolves hidden nodes.

---

## 4. Where a lane contradicted the shipped code, and the shipped code won

| Lane claim | Shipped reality | Ruling |
|---|---|---|
| `07` section 7.2: swap the contents of `.live-beat__status` and edit `qa-live.ts:240` | The assertion is shipped and guards the fault label | Keep the shipped content, add a hidden status span (C4) |
| `07` section 3.7: the fault beat stays pending on a live incident | `deriveBeats` marks it done whenever an `incident` exists | Keep shipped behaviour; the truth word carries the distinction (C6) |
| `05` section 3.6: "the six field `#live-facts` list" | The class is `live__facts`; there is no such id | Citation corrected (C25) |
| `05` and `07`: the blocked reason replaces the sentence | `#live-blocked` exists with `role="status"` | Sentence carries the string; the element stays, empty and role free (C21) |
| `09` section 4.2: the badge has an `Unknown` state | Nothing shows a truth label with zero events today, and `04` argued against it for `ready` | No chip on zero event states (C1) |
| `04` section 8.1: `BeatStatus` is unchanged | The enum has five values and none of them is `refused` | `05` wins, and it is a real addition rather than a rediscovery (C7) |

## 5. Where the shipped code loses, and why

Each row changes shipped behaviour. Each one is justified by a source line
showing that the shipped behaviour states something the events do not support, or
by a defect a reader can hit.

| Change | Shipped behaviour | The source line that justifies changing it |
|---|---|---|
| Split `incident` into `controlled_fault` and `incident` | `state.ts:322` hardcodes "failed on purpose" for every incident | `tools.py:131-137` raises `ToolFailure(truth="live")` on any non 200 upstream, and `mcp_server.py:240-251` copies that truth onto the incident. A real outage renders as a scripted one. |
| Split `recovering` into `warden_authorized` and `recovering` | `state.ts:308` enters `recovering` on any intervention and `state.ts:313` says the Warden authorised a retry | `recovery.py:25-26` defines four outcomes of which three are refusals, and `mcp_server.py:252-263` emits the intervention before checking `permits_retry`. Three of four Warden refusals narrate as an authorised retry. |
| The fourth beat renders `◇` on a refusal | `deriveBeats` marks it `done` on any intervention | Same source. A step whose label is a verb claims the verb happened. |
| Static markup ships `data-state="unavailable"` | `live.astro:25` hardcodes `data-state="ready"` | It contradicts the file's own header comment at lines 7 to 14, and lets `qa-live.ts:185-189` pass off a static attribute rather than a derived one. |
| `Back to result` clears the replay flag | `client.ts:239` sets `session.replaying = true` and nothing clears it | `state.ts:271-279` returns `canStart: false` on that branch, so pressing `Replay evidence` loses the start button until reload. |
| A failed start shows its reason | `client.ts:229` writes `session.unavailableReason` | That field is read-only on the `capability === null` branch (`state.ts:209`), which a reachable API does not take, so a failed start is silent. |
| The action moves below the verdict | `.live__actions` at `live.astro:26` precedes `#live-sentence` at `:37` | A control outweighs a sentence, so this demotes the verdict rather than merely reordering it. |
| `authorised` becomes `authorized` | Four user visible sites use `s` | The new state identifier is `warden_authorized`, and `browser-qa.ts:1128` spells the claim word with a `z`. |
| `authoritative` is dropped from the completed sentence | `state.ts:285` claims it unconditionally | `transport.py:53-57` returns 200 from a constant and `mcp_server.py:278` labels it `live` regardless, and the capability payload does not publish the offline flag. |
| The six fact `dl` leaves the viewport | `live.astro:51-58` renders it by default | Named by the review as the inspector in the default view. The nodes stay attached, so no check changes. |
| Three fact defaults become `Not observed` | `none`, `none`, `not yet` at `live.astro:53-55` and `client.ts:104-106` | `09` section 2.1 defines `None` as an event existing with an empty value. No incident event is `Not observed`, and `not yet` is not one of the four words at all (C36). |
| The page lede stops claiming a failure and a retry | `live.astro:22` reads "One governed read, one deliberate failure, one policy-authorised retry." | It renders identically in `unavailable`, in `ready` before anything has run, and on a deployment that cannot run anything. It is the hopeful default `03` section 5 item 15 forbids, three lines above the `data-state` this pack corrects in the same file (D49). |
| The `completed` sentence branches on the events it names | `state.ts:285` asserts an incident and an intervention unconditionally | The state's entry condition requires neither, and a four event success is reachable through the attempt ledger (D43). |
| Partial opacity is removed | `.live-beat__status` at 0.8, `.live__facts dt` at 0.75 | All three ink levels clear AA; opacity converts a measured contrast into an unmeasured one. |
| `#live-blocked` loses `role="status"` | `live.astro:35` | The sentence becomes the one live region, and two regions announcing one blocked reason double announces. |
| `aria-label` on `#live-beats` becomes `Causal path` | Currently `Story beats` | The pack calls this object the causal path everywhere else, and nothing asserts the shipped value. |

## 6. Supersession log

Recorded rather than silently applied, so a later reader who finds two live
statements knows which one is current.

| Superseded | By | Subject |
|---|---|---|
| `03` section 2.3, rule 1 and row 3 | `04` section 6, and C1 | Provenance derivation, and the zero event chip |
| `04` section 3.4 truth label | C1 | `awaiting_agent` shows no chip |
| `04` section 3.6 truth label | `05` section 8.2, and C3 | `Controlled Fault` is never a run-level chip |
| `04` sections 3.3, 3.10, 3.11 motion | D17 | Story Mode has zero motion |
| `04` section 8.1 "`BeatStatus` unchanged" | `05` section 8.3, and C7 | `BeatStatus` gains `refused` |
| `04` section 3.10 sentence, and `05` section 3.6 | C9 | `authoritative` is dropped |
| `04` section 3.8 and `05` section 3.5 spelling | `07` section 7.3 | `authorized` with a z |
| `05` section 3.2 chip, sentence and invocation line | C1, C10, C11 | `awaiting_agent` copy |
| `05` section 7 precondition P4 | C18 | Borders: controls are exempt |
| `06` section 4 region A header | C3 | Expert never shows `Controlled Fault` at run level |
| `06` sections 5 and 11 as `/live` guidance | C22 | `06` targets `/viewer` |
| `07` sections 6.3, 6.4, 7.2 | C4 | No `.live-beat__truth`; keep the shipped element |
| `07` section 3.7 fault beat | C6 | Shipped `deriveBeats` wins |
| `07`'s "Status word" slot in section 3 | C14 | Not rendered in Story |
| `07` sections 4.1 and 5 placement | C19 | No disclosure on `completed` |
| `07` section 3.12 `Back to the run` | C20 | `Back to result` |
| `08` section 3.5 `--aw-measure-outcome: 34ch` | C17 | `--aw-measure-sentence: 46ch` |
| `08` section 7 orange on a beat chip | C5 | Orange rides on the fault step's label |
| `09` section 4.2 `Unknown` state | C1 | No chip on zero event states |
| `09` section 2.2 three part signal on `/live` | C24 | `data-mode` and `?mode=` only |
| `09` section 4.3 prop `startCommand` | C11 | `startPrompt` |
| `05` sections 3.5 and 3.7 topology line | C26 | `external_agent`, not `warden` |
| `05` section 3.2 region C contents and focal claim | C27 | Prompt and dead end note move to region A |
| `05` section 3.1 focal point, deferred to a user test | D41 | Headline drops to 21px on `ready` variant A |
| `05` section 5 row 9 and section 7 P9 | D17, C32 | A violated motion budget was reported as satisfied |
| `05` section 3.6 and `04` section 3.10 `completed` sentence | D43 | Conditional on the events it names |
| `04` section 3.10 motion on entry | D17 | Zero motion, no exceptions |
| `03` section 2.1 item 6, delegation "on every screen" | D40, C40 | Not until the first event |
| `03` section 3.1 region C, as read by `05` | C27 | Region C holds the action and nothing else |
| `06` section 4 "four regions" | D44 | Five labelled regions including A |
| `06` section 13.2 "never inside a subtree that Expert hides" | D22, C33 | Never *constructed* inside one |
| `07` sections 3.2, 3.3, 3.8, 3.9 five Story strings | D45 | Plain language in Story, verbatim in Expert |
| `08` section 0.3 grep pattern `--fs-[a-z-]*:` | C39 note, `11` | Anchored form with digits |
| `08` section 1.2 `.aw` on `#live-root` | D46 | `.aw` on a wrapper |
| `08` section 4.1 cyan condition | D40 | Only once an event exists |
| `08` section 7 rows `starting`, `awaiting_agent` | D40 | No cyan, hue count 1 |
| `08` section 7 rule 3 orange "beat and its label" | C31 | The label only; the marker takes neutral ink |
| `08` section 8 `--aw-measure-outcome: 34ch` | C17 | `--aw-measure-sentence: 46ch` |
| `08` section 9 V2 and V7 | C30, C32 | Collapse list and the exact call |
| `09` section 2.3 nav as one stop, and the graph canvas stop | C37, D18 | Nine stops; no canvas on `/live` |
| `09` section 4.1 `expertAvailable` | C35 | Deleted; `eventCount` added (C34) |
| `09` section 4.2 branch table | C1, C2, D42 | Two branches removed, wording changed |
| `09` sections 4.6, 4.7, 4.12 absence defaults | C36 | `Not observed` |
| `09` section 4.5 "typically `external_agent`" | C26 | Always `external_agent` on the MCP path |
| `09` section 4.3 "the QA overflow assertion is absolute" | C28, D47 | It cannot fail; the measurement is replaced |
| `12` G1.4 "anywhere on the page" | D49 | Story body plus the mode switch |
| `12` G2.4 vs R6 | C29 | One bar, 55 percent |
| `12` H2, V3, V4 scoped to `#live-root` | D49 | Scoped to `<main>` |
| `12` P5, R4 overflow measurement | D47 | Geometric |
| `12` H8, H9, H13 and the recorded screens | D51 | Quarantined in section 2a |
| `11` phase 7 `--viewer-violet` becomes `--aw-violet` | D50 | `/viewer` does not load the layer |
| `README:96` leave lanes unedited, as applied to artifacts | D48 | Contracts and drawn strings are corrected in place |

Earlier supersessions recorded in `02` section 6 still stand: no cream or paper
outer layer, no terminal window framing or control dots, no serif, and violet now
means Warden rather than historical.

## 7. Deferred, with the reason and the owner

Each of these was reached, evaluated and left out. None is forgotten.

1. **The capability offline flag.** One boolean on `GET /runs/capability`,
   derived from what `worker.ts:89` already reads. It unlocks the word
   `authoritative` and the term `Runtime confirmed`. Deferred because it is an
   API change and this programme is scoped to the web app. Owner: whoever next
   touches `apps/api/src/routes/runs.ts`.
2. **A canonical events to session adapter.** The bridge that would let `/live`
   Expert Mode render the Zoetrope graph. Deferred because it does not exist, and
   because `06` section 1 shows the renderer has no append path, so the adapter
   alone would not be enough: a polled live run would need a reload policy as
   well. Owner: the Expert Mode tier two programme.
3. **Reaching a recorded run on a `LIVE_MODE=false` deployment.** `05` section
   8.4 found that such a deployment tells the reader it "may replay evidence" and
   has no route to any: `canReplay` is false on the `run === null` branch,
   `client.ts:198` returns early without a `runId`, and there is no list route.
   Fixing it needs either a `?run=` query parameter or a list endpoint. Until one
   exists, branch R1 of `05` section 3.8 is what that screen must say.
4. **Unifying the three Story adapters.** `00` section 1. Out of scope, see D3.
5. **Reconciling `/viewer`'s light theme.** `viewer.astro:168-199` runs paper
   `#f6f7fb`, Georgia at up to 58px, a gradient filled button and a conic gradient
   orb. Phase 7 of the handoff touches it, gated on the in-flight work there
   landing first.
6. **`--aw-fail`.** Expert Mode will need a terminal row marker that does not
   require parsing text. Not defined here because Story has no use for it and an
   undefined token cannot be misused.
7. **Restoring a working horizontal overflow check at the page level.** D47
   replaces the measurement inside the workspace, which is all this programme can
   reach. The shipped `html { overflow-x: hidden }` at `global.css:70-74` still
   makes `documentElement.scrollWidth` useless as an overflow signal for every
   other route, and `browser-qa.ts` may be relying on it. Owner: whoever next
   owns `global.css`. The cheap fix is to drop the `html` rule and keep the
   `body` one, which the probe in `00` section 6.1 shows still clips while
   leaving the measurement honest.
8. **A Warden refusal reachable from a test.** `12` H8 is quarantined by D51
   because no input to `POST /runs` produces a `refuse_*` outcome: one scenario,
   one permitted retry, a retryable injected fault, and a fixed enum on the
   request. Making it reachable needs either a second scenario or a worker level
   fault switch. Until then the four refusal renderings are covered by unit tests
   over `deriveLive` and not by the browser gate. Owner: whoever adds the second
   scenario.
9. **A `truth: 'live'` incident reachable from a test.** `12` H9, same shape.
   `qa-live.ts:91` runs with `FLEETSCOPE_WORKER_OFFLINE: 'true'` and
   `transport.py` returns 200 from a module constant, so the branch at
   `tools.py:132-136` cannot fire under QA. This is the state the pack created so
   a real outage is never narrated as a scripted one, so it is the most expensive
   one to get wrong and the one with the least coverage. Owner: the same person
   as item 8.

## 8. Open questions this document does not close

1. **Whether `Ended without recovery` is needed at all.** C14 removes the
   rendered status word, which removes the need. If a later phase reintroduces a
   status word for any reason, `07` section 1.7's proposal is the starting point
   and the question reopens.
2. **The exact wording of the `awaiting_agent` dead end note.** C12 counts it at
   16 words and the screen at 63. Any rewording has to hold that count or the
   exception has to be restated.
3. **Which of the five Expert regions absorbs the merge, if the event console and
   the canonical timeline become one surface on `/live`.** D44 budgets five
   regions and puts both inside region C, so merging them does not change the
   count and the decision is free either way. The question below is the original
   one and it stands.

4. **Whether the Expert Mode event console and the canonical timeline are one
   surface or two on `/live`.** `06` separates them because on `/viewer` they read
   different planes. On `/live` they read the same plane, so the separation may be
   redundant. Decide during phase 6 of the handoff, with the rule that a merged
   surface must still answer both of `02`'s questions: what order did things
   happen in, and what were the recorded field values.
