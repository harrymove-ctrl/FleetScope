# Information hierarchy

Phase 3 of the agent workspace redesign. This document fixes **what a reader
meets, in what order, and how much of it there may be**, before any visual
design exists. Nothing here specifies a colour value, a font file, a spacing
unit or a layout. Those belong to the phases that follow, and they are
constrained by the budgets below rather than free to invent their own.

## Why this document exists

The review that commissioned this work rejected the earlier prototype for six
reasons, and four of them are hierarchy failures rather than styling failures:
too much at once, Story and Expert not separated, sidebar and graph duplicating
each other, and an inspector that is too technical for the default view. A
stylesheet cannot fix any of those. They are decided by what the page shows
first and what it is allowed to show at all.

Phase 1 measured the rejected artifact and phase 2 set the numeric budgets it
missed. This document turns those budgets into an ordering and a set of
per item allowances, so the layout phase has something it can fail against.

## 0. What this document inherits, and what it decides

Inherited from `02-reference-matrix.md` section 3, and not reopened:

| Budget | Value | Source |
|---|---|---|
| Concurrent regions, Story | 3 | 02 section 3.1 |
| Distinct hues, Story | 4 maximum, one of which is neutral | 02 section 3.1 |
| Border and outline declarations, Story | 6 | 02 section 3.1 |
| Type steps | 5, ladder in 02 section 3.3 | 02 section 3.3 |
| Animations in Story | 0 | 02 section 3.1 |
| Classed elements in one Story screen | under 40 | 02 section 3.1 |

Inherited from `01-prototype-autopsy.md` section 6: `data-mode` must carry real
`story` and `expert` values that render different DOM; no fact may be rendered
in two places at once; every number must trace to a canonical event; and
`Delegation: Unknown / not observable in this runtime` must survive verbatim in
both modes.

This document decides: the reading order, the mode each item belongs to, the
word allowance for each item above the fold, the interactive element budget,
the rule that keeps the hue count inside the inherited maximum, and the
acceptance test.

## 1. The seven items, and the order a judge reads them

### 1.1 The order

```text
1  current truth              is what I am looking at real, recorded, or nothing
2  outcome or current action  what happened, or what is happening right now
3  causal progress            the shape of the run: five beats, in order
4  incident or result         the one fact that makes the run worth watching
5  primary next action        the single thing I can do
6  agent topology             who acted, and what is not observable
7  technical evidence         the canonical events themselves
```

Items 1 to 5 are Story Mode. Item 6 is split: Story gets one sentence, Expert
gets the graph. Item 7 is Expert only, though it stays in the DOM in Story for
the reason given in section 3.2.

### 1.2 Why each item sits where it does

**1. Current truth, first.** Every later statement's meaning depends on it. The
sentence "the retry returned the authoritative result" describes a live run, a
replayed recording and a fixture equally well, and the reader has no way to tell
which without the label. Truth is the frame; everything after it is the picture.
Putting the frame second means the reader builds a belief and then has to revise
it, and belief revision is slower and less reliable than reading in the right
order the first time. It also costs almost nothing: the label is at most two
words.

**2. Outcome or current action, second.** This is the page's one job. A judge
who reads nothing else should still be able to say what FleetScope did. It sits
second rather than first only because it is meaningless without item 1, and it
sits ahead of everything else because the alternative is asking the reader to
synthesise the outcome from evidence, which is the reader doing the page's work.

**3. Causal progress, third.** The outcome sentence asserts a sequence: a read
failed on purpose, a Warden authorised a retry, the retry returned the result.
The beat list is the receipt for that assertion. It comes directly after the
claim it supports, because a claim and its receipt separated by other content
read as two unrelated facts.

**4. Incident or result, fourth.** This is the specific fact the run exists to
demonstrate: the fault was deliberate, and the recovery was authorised rather
than automatic. It sits after the beats because the beats give it a position in
time. Read on its own, "Controlled Fault" is a category; read after the beats it
is an event that happened at a known point and was answered at another.

**5. Primary next action, fifth.** An action offered before the reader knows
what happened is an interruption. Offered after, it is an obvious next step. The
shipped page has this wrong: `apps/web/src/pages/live.astro` puts
`.live__actions` at line 26 and `#live-sentence` at line 37, so the button
precedes the sentence in the document. In the `ready` state that is harmless
because there is no outcome yet. In `completed` it puts a control in the
reader's path before the verdict, and a control always wins attention against
prose.

**6. Agent topology, sixth.** Who acted is context, not a decision. It also
carries the delegation admission, and that admission needs a frame before it
lands. A reader who is told "delegation is not observable" before being told
what happened hears a missing feature. The same reader, told it after a
complete and successful story, hears a boundary of the runtime, which is what
it is.

**7. Technical evidence, last.** It is the densest content on the page and it
attracts the eye out of proportion to its importance for a first read. Any
promotion of it re creates the failure the review named. It is also the only
item a judge can reach for deliberately: a reader who wants event payloads will
go looking, whereas a reader who wants the outcome will not go looking for it if
it is not offered first.

### 1.3 What breaks when two items swap

Each row is a real failure mode, not a hypothetical.

| Swap | What the reader experiences | Severity |
|---|---|---|
| 1 and 2: truth after outcome | The reader forms a belief about a live recovery, then discovers it was a recording, and has to revise it. People anchor on the first framing, so the revision is partial. This is the current shipped behaviour by omission: there is no run-level truth on the page at all, so a replayed run and a live run present identically except for one sentence. | Highest. It is the only swap that can leave a judge with a false belief. |
| 2 and 3: progress before outcome | The reader meets five beats and has to assemble the outcome themselves. This is precisely the monitoring wall reading: the page displays state and delegates interpretation. Phase 1 measured the rejected prototype stating progress four times in two incompatible numbering systems, which is what happens when progress is the primary content and nothing arbitrates it. | High. It converts a demonstration into a dashboard. |
| 3 and 4: result before progress | The reader learns "succeeded" and stops. FleetScope's claim is not that a run succeeded, it is that a run failed on purpose and recovered under policy. Result first makes the run look trivially successful and throws away the entire reason it is interesting. | High. It discards the product argument while remaining literally accurate. |
| 4 and 5: action before incident or result | The reader is invited to act before knowing what happened. A button is a stronger visual signal than a sentence, so this does not merely reorder, it demotes the verdict. | Medium, and currently shipped. |
| 5 and 6: topology before action | The reader is given an actor list before being told what to do, and meets the delegation admission with no context. The admission reads as an incomplete product rather than an honest boundary. | Medium. It damages the one place the page is most careful to be honest. |
| 6 and 7: evidence before topology | Event payloads arrive before the reader knows who produced them, so every line is unattributable. Evidence is also the densest block, so promoting it pushes items 1 to 5 down. | Medium. |
| 7 into position 2 | This is the rejected prototype. Phase 1 measured four of its seven content blocks as evidence. The result was the inspector first reading the review rejected. | Highest, and already proven by rejection. |
| 1 into position 7 | Truth last. A recorded run reads as live for the entire viewing, and the label arrives after the reader has stopped reading. | Highest. Functionally identical to having no truth label. |

## 2. Mode assignment and word budget

### 2.1 The table

"Above the fold" means the first viewport at both 1440x900 and 480x900, and the
budget applies to the smaller one. Words are counted as whitespace separated
tokens containing at least one alphanumeric character, which is how the figures
in the source column were measured.

| # | Item | Story | Expert | Max words above the fold | Source of the figure |
|---|---|---|---|---|---|
| 1 | Current truth | yes | yes | **2** | Longest value in `TRUTH_LABEL` is `Controlled Fault`, 2 words. |
| 2 | Outcome or current action | yes | yes | **20** | Longest sentence in `state.ts` is the `completed` sentence, measured at 20 words. |
| 3 | Causal progress | yes | yes | **16** | Five beat labels total 8 words; five status words total at most 6; 2 words of slack. |
| 4 | Incident or result | yes | yes | **12** | `terminalResult` is 1 word; the incident reason is a payload string, so this is a cap the copy must meet, not a measurement. |
| 5 | Primary next action | yes | yes | **4** | `Run live recovery demo`, asserted verbatim at `scripts/qa-live.ts:193`. Not negotiable. |
| 6 | Agent topology | one line | graph | **8** | `DELEGATION_UNKNOWN` is 7 words and must survive verbatim; 1 word for the acting agent id. **Rendered only once the run has produced a canonical event** (`10` D40): on `unavailable`, `ready`, `starting` and `awaiting_agent` the element is attached and visually hidden, because a non observation about a run that has produced nothing invites the reader to think an observation was attempted and failed. That is `10` C1's argument for the chip, applied to the same four states. `12` P6 and H1 read the node with `textContent()` and `getAttribute()`, which resolve hidden nodes. |
| 7 | Technical evidence | **0** | uncapped | **0 in Story** | Evidence lines are exempt from measure caps in Expert, per 02 section 5, because truncating evidence hides it. |

Story total above the fold: **62 words**. The shipped page in `ready` state was
measured at 72 words in phase 0, so this is a reduction of 10 words against a
page that already passes review, and a reduction of 210 against the rejected
prototype's 272.

### 2.2 How 15 seconds was sized

Silent reading of unfamiliar non fiction runs at roughly four words per second.
That figure is approximate and is used only to size the budget; the real gate is
the human test in section 4.

The 62 words are not all read. They divide into two kinds:

```text
prose, read in sequence      item 1 (2) + item 2 (20) + item 4 (12)  = 34 words
labels, scanned not read     item 3 (16) + item 5 (4) + item 6 (8)   = 28 words
```

34 words of prose at four words per second is about 8.5 seconds, which leaves
roughly 6.5 seconds to scan 28 label words and locate the single action. If
prose exceeds 34 words the test fails on time alone, before any question of
clarity. This is why item 2 is capped at exactly the measured length of the
longest existing sentence rather than at a round number: the cap is already met
by the shipped copy, so no rewrite is required to satisfy it, and any future
sentence that exceeds it is a regression rather than a judgement call.

### 2.3 Run level truth does not exist yet, and must not be invented

`state.ts` has no run-level truth field. `Truth` is a property of
`CanonicalEvent`, and `LiveView` exposes it only per beat. Item 1 therefore
needs a derivation, and the derivation must not assert anything the events do
not support:

```text
state === 'unavailable'                         -> Unavailable
state === 'historical_replay'                   -> Recorded
capability !== null and events.length === 0     -> Unknown
otherwise                                       -> the truth of the run_start event
```

Two constraints on that derivation. First, `Controlled Fault` is never a run
level truth. It is an event level label, and promoting it to the run header
would claim the whole run was a fault, which is the opposite of what happened.
Second, the derivation reads existing fields only. It adds no state, and it must
live beside `deriveLive` so that it stays a function of events like everything
else.

## 3. Hard budget for Story Mode

### 3.1 Three regions, holding seven items

The inherited budget is 3 regions. Seven information items in three regions is
not a contradiction, and the distinction is the whole lesson of the rejected
prototype: **it gave each information item its own frame.** Eight regions was
not a decision to show too much, it was the absence of any grouping decision at
all.

| Region | Items it holds | Why these belong together |
|---|---|---|
| A. Verdict | 1 truth, 2 outcome, 4 incident or result | All three answer "what am I looking at". They are one paragraph's worth of meaning and should read as one block, not three. |
| B. Progress | 3 beats, 6 topology line | The beats are the sequence and the topology line names who performed it and what could not be seen. Both are the receipt for region A. |
| C. Action | 5 primary action | The only thing the reader can do, and nothing else. It is a region of its own because it is the only element permitted to compete with region A. **This definition is normative and `10` C27 enforces it**: an earlier draft of `05` section 3.2 put a prompt block, a `Copy` control, a run id and a reserved dead end line into region C on `awaiting_agent`, three of the four not being the action. The prompt and the note moved to region A, where they are the instruction and a statement about the run; the run id moved to the command bar. Region C holds one control on every screen that has one, and two only where a secondary action exists. |

Nothing else may be a region. If a fourth candidate appears during layout, it
belongs inside A, B or C, or it belongs to Expert Mode.

### 3.2 Interactive elements

| Condition | In the story body | In the viewport | Which |
|---|---|---|---|
| Before a run | **1** | 2 | `#live-start`, plus the mode switch |
| Run under way | **0** | 1 | mode switch only; `canStart` is false and the CTA is disabled, so it is not an available action |
| After a run | **2** | 3 | `#live-start`, `#live-replay`, plus the mode switch |

The mode switch is counted separately and sits outside the story body, because
it changes the surface rather than acting on the run. Counting it inside the
body would either break the one action rule or force the rule to be weakened,
and neither is honest.

**The DOM constraint that makes this possible.** `scripts/qa-live.ts` reads
`#live-policy`, `#live-incident`, `#live-result`, `#live-cursor`, `#live-budget`
and `.live-beat__status` with `textContent()`, and reads `#live-delegation` and
the beats with `getAttribute()`. Both APIs resolve the selector and read the
node directly without any visibility or actionability check; this was confirmed
by reading the resolver in the vendored
`playwright-core@1.62.1` bundle rather than assumed. Only `click()` requires
visibility. Therefore:

* must be **visible** in whatever mode QA drives: `#live-start`, `#live-replay`;
* need only be **attached**: every other asserted node.

Story Mode may consequently move all six fields of the `live__facts` list out of
view without touching a single one of the 58 checks, provided they remain in the
document. This is the mechanism that resolves the review's fifth complaint, and
it costs no QA edits.

### 3.3 Four hues, and the rule that keeps it there

The locked direction names four chromatic meanings, blue, cyan, violet and
orange, and the inherited budget allows four hues of which one is neutral. Those
two statements are only compatible if the chromatic hues cannot all appear at
once. They cannot, and the reason is already in `state.ts`:

| Hue | Painted only when | Excluded by |
|---|---|---|
| Blue | the primary action is **enabled** | `canStart` is false for every state in which a run is under way |
| Cyan | the run **is under way**: `starting`, `awaiting_agent`, `running`, `incident`, `recovering` | absent once the run reaches `completed`, `failed` or `historical_replay` |
| Orange | a `controlled_fault` event exists | absent until the incident occurs |
| Violet | the Warden acted | absent until an `intervention` event exists |

Blue and cyan are therefore mutually exclusive: while a run is under way the CTA
is disabled and renders neutral, and once it finishes the run is no longer live.
The worst cases are `recovering` with cyan, orange and violet, and `completed`
with blue, orange and violet. Both are **three chromatic hues plus neutral,
which is four**, inside the inherited budget.

Two corollaries the layout phase must honour. Cyan marks the run, not each
event, so it appears on the run-level truth label and nowhere else; painting it
per beat would put four cyan marks on a completed run that is no longer live.
And orange stays on the Controlled Fault beat and its label only, because it is
the one hue whose meaning is a single specific event kind.

### 3.4 Why three regions answers the eight region failure

The rejected artifact assigned the entire viewport to bordered regions:
`grid-template-rows: 44px minmax(0, 1fr) 124px` with a border, and exactly one
`max-width` measure cap in 1219 lines of CSS. Nothing was ever permitted to end
before its container did, so there was no negative space anywhere, and with 31
border declarations no border meant anything.

The three region budget attacks that mechanically rather than by taste:

1. three regions cannot fill a 1440x900 viewport at a 720px measure cap, so at
   least 45 percent of the surface stays unpainted, which is the phase 2 target;
2. six border declarations for three regions means at most two per region, so a
   border cannot be the default way to group anything;
3. one focal object and one action means the reader is never asked to choose
   where to look, which was the review's first complaint stated exactly.

## 4. The 15 second comprehension test

### 4.1 Machine precondition

Run this before showing the page to any human. If it fails, the human test is
void, because a failure here means the page is not the page the test assumes.
Written in the style of `scripts/qa-live.ts`, at both 1440x900 and 480x900, in
Story Mode, in the `completed` state.

```text
P1  #live-root has data-mode="story"
P2  the story body contains exactly 2 enabled controls: #live-start, #live-replay
P3  no element matching [data-evidence], [data-graph] or [data-console] is visible
P4  the six live__facts values are attached and not visible
P5  visible prose in regions A and B totals <= 34 words
P6  total visible word count above the fold <= 62
P7  #live-delegation textContent contains
    "Delegation: Unknown / not observable in this runtime"
P8  computed colour values in use resolve to at most 4 distinct hues,
    of which at least 1 is the neutral ink ramp
P9  document.getAnimations() on the story body returns an empty array
P10 zero horizontal overflow at 480px, zero console errors, zero 404s
```

P10 restates hygiene checks that `qa-live.ts` already performs, listed here so
the precondition is complete on its own. P5, P6, P8 and P9 are new and have not
been executed; they encode this document's budgets and are written to be added
in the phase that builds the surface.

### 4.2 Protocol

**Recruit.** Five people who have not seen FleetScope, at least two of whom do
not write software. A judge at a demonstration is closer to the second group
than the first.

**Set up.** One screen at 1440x900. Story Mode. The run has finished and the
page is in `completed`. Scrolling is disabled. The participant may not click.

**Run.** Read this aloud, verbatim:

> "You are about to see one screen for fifteen seconds. You cannot scroll or
> click. Afterwards I will ask you five questions. There are no wrong answers
> and I am testing the screen, not you."

Show the screen for exactly 15 seconds, then replace it with a blank neutral
surface. Ask the five questions in order. Record answers verbatim. Do not
paraphrase the participant's answer back to them, do not repeat a question with
different words, and do not answer a question with a question.

```text
Q1  What just happened?
Q2  Was that real, or a recording?
Q3  Did anything go wrong? If so, was it an accident or on purpose?
Q4  If you could press one thing, what would you press?
Q5  How many agents were involved, and did any of them hand work to another?
```

### 4.3 Scoring

| Question | Passes on | Fails on | Threshold |
|---|---|---|---|
| Q1 | any answer containing a failure and a recovery, in either order | "it worked", "it loaded", "it ran a test" | 4 of 5 |
| Q2 | "real" or "live" | "recording", "not sure", any hedge | 4 of 5 |
| Q3 | "on purpose", "deliberate", "by design" | "it broke", "a bug", "an error" | 4 of 5 |
| Q4 | naming the primary action, in any words | naming any other element, or "I do not know" | 4 of 5 |
| Q5 | **"it does not say", "unknown", "it would not tell me"** | **any number, and any claim that one agent handed work to another** | 5 of 5 |

The suite passes only if every row meets its threshold. One row below threshold
is a failure of the whole test, not a partial score.

Two further void conditions. If any participant describes the screen unprompted
as a dashboard, a monitor, or logs, the test is void regardless of scores,
because the review's second complaint has reappeared. And if any participant
asks to scroll before the 15 seconds elapse, record it: it means the fold is in
the wrong place.

### 4.4 Why Q5 passes on ignorance

Q5 is inverted on purpose and it is the most FleetScope specific criterion here.
Every other question rewards the participant for knowing something. Q5 rewards
them for correctly not knowing.

Delegation is not observable on the MCP path, because Gemini CLI has no sub
agents. A participant who answers "two agents, one handed off to the other" has
been misled by the page, and it does not matter whether the page said so in
words or merely implied it with a graph, an arrow, or two avatars side by side.
A participant who answers "it says it cannot tell" has read the one sentence the
product is most careful about. Any design that scores well on Q1 through Q4 and
fails Q5 is worse than the shipped page, which passes Q5 today.

## 5. What Story Mode must not contain

Each item names what is excluded and the reason, so a later reader can tell
whether a proposed addition is covered.

1. **No graph, canvas or node diagram.** It is item 7 content wearing item 6
   clothing, and it is the surface most likely to imply delegation that was
   never observed.
2. **No console, feed or log stream.** A log implies there is more arriving. The
   real MCP run is eight events and then it is over.
3. **No raw event inspector.** No payload keys, no sequence numbers as primary
   content, no cursor value, no latency. Latency in particular does not exist:
   `CanonicalEvent` has no latency field, and the rejected prototype displayed
   three latency values anyway.
4. **No second progress number.** Exactly one progress representation, the five
   beats. The rejected prototype stated progress four times in two incompatible
   systems.
5. **No duplicated fact.** If the acting agent appears in the topology line it
   does not also appear in region A, and the reverse.
6. **No fourth region**, no matter how small. A caption, a legend, a badge strip
   and a footnote are all regions.
7. **No truth legend.** If the truth labels need a key, they are the wrong
   labels.
8. **No colour without a word.** Every state carrying a hue also carries its
   word, so a monochrome or forced colours rendering loses nothing.
9. **No animation.** Zero in Story, per the inherited budget. `client.ts` polls
   every 400ms and refetches from cursor 0 each tick, so anything keyed to a
   render fires 2.5 times a second. Any motion added later must key off state
   change, and Story does not get any.
10. **No window chrome.** No traffic light dots, no title bar, no frame around a
    mono block.
11. **No agent avatars beyond one mark per acting agent**, and never a mark
    without its label.
12. **No cream, paper or warm surface.** One near black surface, per 02 section
    6 item 1.
13. **No serif.** Sans for product copy, mono for evidence, and nothing else.
14. **No fake typing, no fake streaming, no fake delegation.**
15. **No hopeful default.** Nothing may claim a state before the API has
    answered, which is the rule `live.astro` already documents at lines 7 to 14
    and then breaks at line 25 by hardcoding `data-state="ready"`.

## 6. Two shipped defects this hierarchy resolves

Both were found in phase 0 and are recorded here because the fix is a hierarchy
decision rather than a styling one.

**The status slot carries two vocabularies.** `client.ts` writes the truth label
into `.live-beat__status` when a beat is done, so a completed beat reads "Live"
or "Controlled Fault" and never reads "Done". Items 1 and 3 of the reading order
are therefore rendered in the same slot, and a reader cannot separate "this beat
finished" from "this beat was live". The hierarchy requires them separate: truth
is item 1 and belongs to region A at run level, status is item 3 and belongs to
region B per beat. Note that `scripts/qa-live.ts:240-245` currently asserts the
conflation, requiring `[data-beat="fault"] .live-beat__status` to read exactly
`Controlled Fault`. Fixing the defect therefore requires editing that assertion
in the same change, and the replacement should assert the Controlled Fault label
wherever it lands rather than dropping the check.

**The action precedes the outcome.** `live.astro` places `.live__actions` at
line 26 and `#live-sentence` at line 37. That is items 5 and 2 in the wrong
order, and section 1.3 gives the consequence.

## 7. What this document does not decide

1. Where region A, B and C sit relative to each other on screen. The order is a
   reading order; a layout may satisfy it with stacking, and at 1440x900 it may
   satisfy it with something else, provided the resulting reading order is the
   one in 1.1.
2. What the mode switch looks like or where exactly it sits, beyond being
   outside the story body.
3. Any hex value. Section 3.3 constrains how many hues may coexist and what
   excludes each one, not what they are.
4. The Expert Mode hierarchy. Expert inherits items 1 to 7 in the same order but
   has its own budgets, and it is the next document.
5. Whether the six `live__facts` fields move to Expert Mode or are reduced. This
   document establishes only that they leave the Story viewport and stay in the
   DOM.

## Links

* Shipped Story page: `apps/web/src/pages/live.astro`
* Shipped state machine: `apps/web/src/features/live/state.ts`
* Shipped client and beat rendering: `apps/web/src/features/live/client.ts`
* The 58 checks: `scripts/qa-live.ts`
* Phase 0: `docs/design/agent-workspace/00-current-state-audit.md`
* Phase 1: `docs/design/agent-workspace/01-prototype-autopsy.md`
* Phase 2: `docs/design/agent-workspace/02-reference-matrix.md`
