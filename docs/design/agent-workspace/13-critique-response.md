# Critique response

Three reviewers read this pack as built and returned thirty eight findings: ten
blockers, fourteen majors, fourteen minors. All three verdicts were
`accept_with_changes`. This document accounts for every finding, including the
ones that were rejected, so that a later reader can tell the difference between a
defect that was fixed, a defect that was deferred, and a claim that was wrong.

Thirty seven were accepted and fixed. One was rejected on measured evidence.
Three were fixed with a correction to the finding's own reasoning, which is
recorded beside them because a fix applied for the wrong reason is a fix that
comes undone.

The changes land in `10-design-decisions.md` as twelve new decisions, D40 to
D51, and fifteen new contradictions, C26 to C40. Where a lane document
carried a typed contract, a drawn string or a verification table that an
implementer would copy, the lane was corrected in place with a marker; where it
carried reasoning, it was left alone. That split is itself a decision, D48,
because the pack's original policy of never editing a lane was protecting the
wrong thing.

---

## What the findings say about the pack's method

Worth stating before the table, because it is the reason three reviewers found
this much in a pack built around counts.

**The method works, and it was applied unevenly.** Story Mode has a region count,
a word count, a control count, a hue count, a border count and a motion count,
and the review's six complaints are each answered by one of them. Expert Mode had
none, and every dense surface was moved into it (D44). The honesty checks were
scoped to `#live-root`, and the one false claim that shipped was three lines
above it in the page header (D49). The overflow constraint was derived from a
check that cannot fail (D47). In each case the count existed and pointed at the
wrong thing.

**Three failures were the same failure.** C1 removed the provenance chip on zero
event states, `05` section 3.3 independently withheld the topology line on the
same states for the same stated reason, and `08` section 7 was still painting
cyan there. Three documents had each found half of one rule. D40 states it once:
nothing in regions A or B says anything about a run before that run's first
canonical event.

**The blessing problem.** The `completed` sentence asserts an `incident` and an
`intervention` that the state's entry condition does not require. It survived
four documents and a gate item because the pack had explicitly approved it as
verbatim, and `12` void condition 2, "any string on screen cannot be traced to a
canonical event field", reads as being about strings someone invented rather than
strings someone approved. Void condition 2 now says so explicitly.

---

## 1. Blockers

| # | Reviewer | Document | Finding, in one line | Disposition |
|---|---|---|---|---|
| B1 | Comprehension | `05` §3.5, §3.7 | The topology line is drawn as `warden` on the Warden screens; `state.ts:233` renders `external_agent` | **Fixed.** `10` C26 |
| B2 | Comprehension | `07` §3.2, §3.3, §3.8, §3.9 | Five approved Story strings carry `admits`, `Admitting`, `idempotent_read`, `retry(ies)`, `idempotency key` | **Fixed.** `10` D45, gate G2.7 |
| B3 | Comprehension | `11` phase 6, `09`, `12`:160 | Expert Mode has six or seven concurrent regions and no budget | **Fixed.** `10` D44, gate §1a |
| B4 | Truth | `04` §3.10, `05` §3.6, `07` §3.10, `10` C9, `11` phase 1 | The `completed` sentence asserts two events its entry condition does not require | **Fixed.** `10` D43, gate H16 |
| B5 | Implementability | `12` P5/R4, `11` phase 9, `09` §4.3, `00` §6.1 | The zero overflow assertion cannot fail | **Fixed, mechanism corrected.** `10` D47, C28 |
| B6 | Implementability | `12` G1.5/V2 vs `08` §7 | The four-hue count is unsatisfiable and unimplementable as a cardinality | **Fixed.** `10` C30 |
| B7 | Implementability | `08` §1.2 vs `12` G1.1/P7, `09` §4.1 | `.aw` on `#live-root` puts the command bar outside the token scope | **Fixed.** `10` D46 |
| B8 | Implementability | `11` phase 7 vs `08` §1.2, §1.3 | `--aw-violet` does not resolve on `/viewer`, which never loads the layer | **Fixed.** `10` D50 |
| B9 | Implementability | `12` H8, H9, H13, §3 | Four gate items are unreachable inside the granted file scope | **Fixed.** `10` D51, gate §2a |
| B10 | Implementability | `09` §4.8, §4.13 vs `10` D18, `11` scope | Two cited crate files are untracked and absent at the stated baseline | **Fixed.** `10` C38 |

### B1. The topology line on the Warden screens

`05` sections 3.5 and 3.7 drew `warden · Delegation: Unknown...` and justified it
with `mcp_server.py:253`, which does emit the intervention with `agent="warden"`.
The justification is true about the event and false about the line.
`state.ts:233` is
`lastOf(events, 'tool_call')?.agent ?? events.at(-1)?.agent ?? null`, and a
`tool_call` exists at sequence 2 on every Warden screen, so the line renders
`external_agent`. `09` section 4.5 had it right and `10` section 3 had not
recorded the disagreement.

The comprehension cost is the one the pack works hardest to avoid: on the two
screens that credit the Warden, the only actor named in region B would have been
the judge's own agent, one line under a sentence saying the Warden allowed the
retry. Both drawings are corrected, `09` section 4.5 now says `external_agent` at
every stage rather than "typically", and the split is stated: region A's sentence
names who decided, region B names who acted. Word counts are unaffected.

### B2. Jargon on the default screen

`ready` is where a judge with sixty seconds starts, and its only sentence turned
on `admits`, FleetScope's admission control verb, without ever saying what the
button would do. `Admitting` was the same verb at 36px. Two payload rationales
rendered verbatim as Story prose. `recovering` explained itself with `idempotency
key`. `05` section 3.4 had already removed `(first 1 attempt(s))` from the
incident line for being a machine detail, so the pack was applying its own rule
inconsistently.

The entitlement rule asks whether a field permits a claim. It does not ask
whether a stranger understands it, and all five strings passed the first question
while failing the second. D45 adds the second rule and splits the registers: raw
producer strings render verbatim in Expert Decision Evidence, Story renders a
sentence that says what it means. Five rewrites in `07`, mirrored in `05`. Free,
because no check asserts `#live-sentence` and `#live-policy` keeps its raw value.
Gate G2.7 bans `idempoten`, `admits`, `admitting`, `ledger` and `(ies)` from
Story's `innerText`, beside H2.

### B3. Expert Mode was never counted

Composing `11` phase 6's five surfaces with the five components `09` marks
"Mode: Both" gives six or seven concurrent regions against `02`'s Expert budget
of five, and nobody had added it up. `08` recorded the omission as deliberate:
"Expert Mode's budgets. Phase 3 section 7 item 4 defers them." `12` compounded
it, scoping every machine precondition to Story while instructing the reviewer to
work sections 1 to 7 in both modes, which makes G1.1 unsatisfiable in Expert.

The review's first complaint was eight regions competing. The pack answered it
for Story with counts and moved every dense surface into the mode with no count.
D44 gives Expert five named regions, a control cap of eight, and a closed
component set; gate section 1a checks it; the mode scoping contradiction is
resolved in the same edit with a table saying which sections run where.

### B4. The `completed` sentence

The most important finding in the set, because it is the failure class this
codebase is arranged against, appearing inside the document that defines the
rule. `completed`'s entry condition is
`finished && run.terminalResult === 'succeeded'` and requires neither an
`incident` nor an `intervention`; the sentence asserts both. `04` sections 1.1
and 1.2 reject the shipped `incident` and `recovering` sentences for a weaker
version of the same defect, and `11` rule 1 condemns it directly.

Reachable, not theoretical: `tools.py:119` reserves the attempt before the
request, `mcp_server.py:335-339` swallows a publish failure so the agent still
gets an answer, and with `FLEETSCOPE_ATTEMPT_LEDGER` set to a `FileAttemptStore`
the retry sees `applies_to(2) === false` because `fault_attempts=1`. The run
emits four events, `deriveLive` returns `completed`, `deriveBeats` correctly
marks the fault and retry beats `pending`, and the sentence claims both happened
on the same screen. D43 branches the sentence on the events it names, `11` phase
1 gains the case and a fifth test, gate H16 checks it, and void condition 2 now
states that a blessing is not a field.

### B5. The overflow assertion

Accepted, and the finding's mechanism corrected, because the correction changes
what a fixer would do. The reviewer attributed the no op to
`body { overflow-x: hidden }` at `global.css:78` and said `html` was at
`overflow: visible`. `html` is explicitly `overflow-x: hidden` at
`global.css:70-74`, at HEAD and in the worktree. Probed in Chromium at 480x900
against a 1200px child:

```
neither rule                  scrollWidth 1208  clientWidth 480  -> FAILS  (correct)
body { overflow-x: hidden }   scrollWidth 1200  clientWidth 480  -> FAILS  (correct)
html + body, as shipped       scrollWidth  480  clientWidth 480  -> PASSES (wrong)
```

`body` alone leaves the check working. The `html` rule is the one that defeats
it, so someone who fixed only `body` would think they had restored the check.
D47 replaces the measurement with a geometric one, which returned 1200 against an
`innerWidth` of 480 in all three cases; `00` section 6.1 records the probe;
`10` section 7 item 7 defers the page level fix, which belongs to whoever owns
`global.css`.

### B6 to B10, in brief

**B6.** `completed` renders three ink levels plus violet plus orange plus
`--fs-bg` as the ink on the blue fill, which is five or six distinct computed
values against a bar of four, and `12` never supplied the allowlist that would
let a counter collapse the greys. Restated as a collapse list plus a fixed
permitted set, which also fails on a wrong hue rather than only on a fifth one.

**B7.** `12` G1.1 and P7 cap the direct children of `#live-root` at the three
regions, so the command bar cannot be inside it, so `.aw` on `#live-root` leaves
the mode switch unable to resolve any workspace token while `11` phase 6 requires
it to write `data-mode` there. `.aw` moves to a wrapper; both selectors are named
explicitly in every check that reads one.

**B8.** `workspace.css` is route scoped by design, so `--aw-violet` on `/viewer`
resolves to nothing and the declaration is dropped. `/viewer` has no Warden
concept in its UI, so the hue is dropped rather than aliased or defaulted.

**B9.** Four gate items are unreachable: no input to `POST /runs` produces a
`refuse_*` outcome, `qa-live.ts:91` runs offline against a constant 200, and no
scripted run is reachable from `/live`. `12` opens with "an item that cannot be
observed is not on this list". They move to section 2a with what unblocks each,
and the states get unit coverage over `deriveLive`, which `11` already permits.

**B10.** `selection.rs` and `manifest.rs` are untracked and absent at `cfdcca7`,
the stated baseline, and the wasm ABI at HEAD exports nine functions of which
none is the five those contracts need. `crates/**` is forbidden. Both contracts
split into a `/live` half that depends on none of it and a `/viewer` half with an
explicit dependency note.

---

## 2. Majors

| # | Reviewer | Document | Finding | Disposition |
|---|---|---|---|---|
| M1 | Comprehension | `05` §3.1 | `ready` has two focal objects and the mitigation was deferred to a test that would never surface it | **Fixed.** `10` D41 |
| M2 | Comprehension | `05` §3.9, `10` C2, `12` H12 | The bare `Live` chip argues against the three other replay guards | **Fixed.** `10` D42, gate H17 |
| M3 | Comprehension | `09` §4.2 | The build spec still carries two branches C1 and C2 removed | **Fixed.** `10` D48, `09` §4.2 rewritten |
| M4 | Comprehension | `05` §3.2 vs `03` §2.1 | Region C holds four items, three not the action, and a mono block is focal | **Fixed.** `10` C27 |
| M5 | Truth | `08` §7 vs `10` C1 | Cyan claims liveness on two states with zero events | **Fixed.** `10` D40, gate V11/H18 |
| M6 | Truth | `09` §4.6, §4.7, §4.12 | Three absent values render `none` and `not yet`, which `12` H11 forbids | **Fixed.** `10` C36 |
| M7 | Implementability | `00`, `09`, `10` | `global.css` line citations are worktree coordinates | **Fixed.** `10` C39 |
| M8 | Implementability | `11` phase 2 | "each with a visually hidden status word" does not say which span holds which | **Fixed.** `11` phase 2 rewritten |
| M9 | Implementability | `09` §4.1 | `expertAvailable` has no field behind it once D18 removed the renderer | **Fixed.** `10` C35 |
| M10 | Implementability | `12` G2.4 vs R6 | One measurement, two pass bars, both automated | **Fixed.** `10` C29 |
| M11 | Implementability | `05` §3.2 vs `05` §2.1, `03`, `09` | Whether the delegation line renders on `awaiting_agent`, worth 7 words | **Fixed.** `10` C40 under D40 |
| M12 | Implementability | `12` A4, `09` §2.3 | The nav is nine tab stops, counted as one | **Fixed.** `10` C37 |
| M13 | Implementability | `08` V7, `12` G6.2, `11` phase 4 | Three phrasings of the motion check, two measuring the wrong scope | **Fixed.** `10` C32 |
| M14 | Implementability | `12` V3 vs `08` §7 rule 3 | An orange `aria-hidden` marker fails the check the design mandates | **Fixed.** `10` C31 |

**M1** was decided rather than deferred. `05` offered the fix conditionally, on a
user test `03` sets up in `completed` rather than `ready`, so the test as written
would never have surfaced it. The defect is decidable from the pack's own rules:
a one word 36px headline beside the single filled control is `12` S1's stated
failure condition, and every numeric budget on `ready` passes while it happens.
The outlined CTA alternative was rejected because D33 measured both border tokens
below WCAG 1.4.11 and `12` V5 requires exactly one filled element.

**M2** keeps the derivation, which C2 settled correctly, and changes the
vocabulary. The chip means *produced live*; a reader parses a bare `Live` above
`Replaying` as *happening now*, and it is item 1 in the reading order because
"truth is the frame". `TRUTH_LABEL` is untouched, so `12` T4 still holds.

**M4** resolves the region assignment as well as the focal claim, which C12 had
left. The prompt and the dead end note move to region A as the instruction and a
statement about the run; region C holds `Copy prompt` alone; the focal point
becomes the headline, so no mono object is focal on any Story screen.

**M6** was justified in `09` as "QA only asserts the populated case", which is an
argument that nothing will catch it rather than an argument that it is true.
All three become `Not observed`, verified free against `qa-live.ts:248-257`.

**M8** matters because `10` C4 resolves the substance and the phase an
implementer executes never says which span holds which word. Written out:
`.live-beat__status` keeps the truth word and is hidden, a second hidden span
carries the status word, `data-status` stays machine readable, and only the label
and the marker are visible.

---

## 3. Minors

| # | Reviewer | Subject | Disposition |
|---|---|---|---|
| m1 | Comprehension | `12` G1.4 counts controls "anywhere on the page" and so fails a compliant build | **Fixed.** Rescoped, `10` D49 |
| m2 | Comprehension | `06`:149 says four regions and draws five labels | **Fixed.** Five, and D44 fixes the convention for both modes |
| m3 | Comprehension | `06`:139 still draws the `Controlled Fault` header C3 forbids | **Fixed.** Redrawn as `Source: live` |
| m4 | Comprehension | `05` §5 row 9 and §7 P9 report a violated motion budget as satisfied | **Fixed.** Both annotated as superseded by D17 and C32 |
| m5 | Comprehension | `10` C12 relieves a word overflow by reclassifying content as chrome | **Fixed.** D49 caps the command bar at 8 words |
| m6 | Comprehension | `12` G1.3 lists ten states of twelve and omits both recorded branches | **Fixed.** Twelve, with the recorded branches mapped to their states |
| m7 | Truth | An event count derived from `cursor` can state a number no events support | **Fixed.** `10` C34, `eventCount` prop, H4 restated |
| m8 | Truth | `live.astro:22`'s lede claims a failure and a retry outside every honesty check | **Fixed.** `10` D49, rewritten, H2 rescoped to `<main>` |
| m9 | Truth | `12` G1.3 omits `incident`, the state with the most expensive false claim | **Fixed.** Added at 0 enabled controls |
| m10 | Implementability | `08` §0.3's grep `--fs-[a-z-]*:` matches no numbered token | **Fixed.** Anchored form, matching `11` and G6.6 |
| m11 | Implementability | `08` §0.1 says 32 `:root` properties; the reviewer counted 33 | **Rejected.** See below |
| m12 | Implementability | `11` says 26 `check(` sites; there are 25 plus the declaration | **Fixed.** In `11`, `12` T1 and `08` §9 |
| m13 | Implementability | `06` §13.2 and D22 rule opposite ways on hiding the canvas | **Fixed.** `10` C33 rules for D22 |
| m14 | Implementability | `08` §8's pasteable block still declares `--aw-measure-outcome: 34ch` | **Fixed.** Corrected in the block and its derivation |

### m11, the one rejection

> **Claim:** "The `:root` block at global.css:12-66 contains 33 declarations",
> against `08` section 0.1's table summing to 32.

**Rejected. There are 32 declarations.** The `:root` block contains 33 lines
matching `--fs-`, and the thirty third is a prose mention inside a comment:

```
apps/web/src/styles/global.css:25
   * surface above — including `--fs-surface-raised`, the lightest, which is
```

Counted with an anchored declaration pattern rather than a substring match:

```
$ awk '/^:root/,/^}/' global.css | grep -cE '^\s*--fs-[a-z0-9-]+\s*:'
32
$ awk '/^:root/,/^}/' global.css | grep -c -- '--fs-'
33
```

`08` section 0.1's table sums to 32 and each of its ten category rows is correct.
No change.

This is worth recording rather than dismissing, because it is exactly the
counting error the same reviewer correctly identified two findings later: `11`
said `qa-live.ts` has 26 `check(` sites because `grep -c 'check('` matched the
`function check(` declaration at line 39. One substring count was inflated by a
declaration, the other by a comment, and the pack got one of them wrong and the
reviewer got the other. Both counts are now stated with the pattern that produced
them.

---

## 4. What changed, by document

| Document | Change |
|---|---|
| `00` | Coordinate note at the head; the overflow probe recorded in §6.1 |
| `03` | Region C definition made normative; item 6 gated on the first event |
| `04` | `completed` sentence branched; motion bullet superseded; `authorized` |
| `05` | Topology lines corrected; `awaiting_agent` redrawn; `ready` headline dropped a step; chips renamed; four sentences rewritten; two verification rows marked superseded; word table recounted |
| `06` | Region A header redrawn; region count corrected; §13.2 amended to construction |
| `07` | Five Story strings rewritten; `completed` gains a third branch |
| `08` | Grep pattern anchored; `.aw` moved to a wrapper; cyan condition made positive; two §7 rows and rule 3 corrected; measure token renamed in three places; V2 and V7 restated; check count corrected |
| `09` | §4 policy header; `ModeTruthBadge` rewritten; three absence values corrected; `expertAvailable` removed and `eventCount` added; focus order recounted; `AgentRail` and `CanonicalTimeline` split by surface with dependency notes |
| `10` | §2.9: D40 to D51. §3: C26 to C40, and the count restated as forty. §5, §6, §7 and §8 extended |
| `11` | Phase 1 gains the conditional sentence and a fifth test; phase 2 gains the span assignment, the wrapper and D40; phase 6 gains the Expert budget; phase 7 drops `--aw-violet` and gains the crates gate; phase 9 replaces the overflow measurement; phase 10 gains four checks; a new cross phase rule |
| `12` | Mode scoping table; G1.1 to G1.5 rescoped or restated; G2.2, G2.4 and G2.7; new §1a for Expert; H2 rescoped, H4 restated, H8/H9/H13 quarantined into §2a, H16 to H18 added; P2, P5, P7, P8, P9 amended; V2, V3, V4, V7 amended and V11 added; A4 and A5 recounted; R3, R4, R6 amended; void conditions 2 and 8 sharpened; sign off extended |

---

## 5. What a later reviewer should check first

The four items most likely to come undone, because each one was wrong in a way
that read as correct.

1. **The `completed` sentence.** Four documents carried it verbatim and the gate
   checked it for one word. If a future edit simplifies it back to one string,
   H16 is what should stop it.
2. **The provenance chip.** `Source: live` is two words where the pack's budget
   arithmetic assumed one, and the pressure to shorten it back will come from a
   screen landing at 63. Shortening it re-creates the replay confusion H17 exists
   to catch.
3. **The Expert budget.** It is new, it has never been built against, and five
   regions is a judgement rather than a measurement. `02`:128 is the source; if
   the built surface needs six, say so in `10` rather than letting the count
   drift.
4. **The overflow check.** `qa-live.ts:300-303` still passes and still means
   nothing. If someone deletes the geometric check because "the suite already
   covers overflow", the constraint is unenforced again and nothing fails.
