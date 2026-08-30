# Agent workspace redesign

> **Historical/superseded for the current demo.** This pack describes the old
> `/live` Story/Expert CASE-1042/Warden surface. FleetScope's active product is
> the read-only Session Observer; use `docs/product/session-observer.md`,
> `docs/product/ui-ux-plan.md`, and `docs/design/session-observer.md`. The pack
> remains only as implementation history for existing UI code and tests.

The design pack for FleetScope's judge-facing surface: a restrained Story Mode
that answers "what happened" in one screen, and an opt-in Expert Mode that shows
the evidence behind it.

Everything here was written against the source at `cfdcca7` on branch
`feat/agent-viewer-cli`. Where a document cites a file and a line, that citation
was read rather than recalled. Where two documents disagree, the disagreement is
resolved in `10-design-decisions.md` rather than left for the implementer to
discover.

The cross-route public launchpad, onboarding, and carousel are specified in the
[canonical frontend experience design](../fleetscope-frontend-experience.md).
That document links here and must defer to this pack for every `/live` claim,
state, word, color, motion, and acceptance rule.

## What this pack is for

An earlier prototype was rejected for six reasons: too much information at once;
reading as a SOC or devtools dashboard rather than an agent-native workspace;
Story and Expert not separated enough; sidebar and graph duplicating each other;
an inspector too technical for the default view; and treating "Antigravity like"
as a colour swap rather than as hierarchy, negative space, typography, focus,
restrained chrome and one obvious action.

Those six were stated as impressions. Impressions are hard to design against,
because the next attempt can satisfy the words and repeat the mistake. This pack
turns each of them into a count, a line number, or a check that fails.

## The locked direction

| | |
|---|---|
| **Story Mode** | The default. One outcome, one action. No graph, no console, no raw event inspector. |
| **Expert Mode** | Opt in. Canonical timeline, terminal evidence, Decision Evidence, and on `/viewer` the Zoetrope graph. |
| **Shared** | Blue for selection and the primary action, cyan for a run under way, violet for the Warden, orange for Controlled Fault and nothing else, on a near black surface. Sans for product copy, mono for evidence. |
| **Never** | Mac traffic light dots, cream workstation, pastel agent cards, rainbow borders, full screen animated gradients, mono for all product copy, green filled nodes, yellow selection, fake typing, fake delegation. |

## Reading order

Read `10` and `11` if you are implementing. Read `00` through `09` if you need
to know why a decision was made, or if you are about to argue with one.

### Start here

| # | Document | What it is for |
|---|---|---|
| **10** | [10-design-decisions.md](10-design-decisions.md) | Every significant decision, the alternative that was rejected, and why. Section 3 lists all forty contradictions found between the lane documents and how each was resolved. Section 2.9 holds the twelve decisions added after adversarial review, D40 to D51, several of which change what gets built. **This document overrides the lanes wherever they disagree.** |
| **11** | [11-coding-handoff.md](11-coding-handoff.md) | The paste-ready prompt for a coding agent: file scope, ten implementation phases in order, the acceptance gate, and the prohibitions. |
| **12** | [12-acceptance-gate.md](12-acceptance-gate.md) | The checklist a reviewer runs before calling the UI done. Every item is something you can observe, not something you can feel. Section 2a lists the four items that cannot be observed inside this programme's scope, and says what would unblock each. |
| **13** | [13-critique-response.md](13-critique-response.md) | What three adversarial reviewers found in the finished pack, and what was done about each of the thirty eight findings. Read it if you are about to argue that something in `10` is arbitrary. |

### The evidence, in the order it was gathered

| # | Document | What it establishes | Read it when |
|---|---|---|---|
| **00** | [00-current-state-audit.md](00-current-state-audit.md) | What the UI is today: ten routes, the `--fs-` token system, what shipped `/live` does well, where it is too dense, and every DOM contract the three test suites assert. | Before touching any existing file. |
| **01** | [01-prototype-autopsy.md](01-prototype-autopsy.md) | The rejected prototype measured rather than described: 8 panes, 25 controls, 84 border edges, 7 hues, 272 words, and a seventh failure the review did not name, invented evidence. Ends with 8 conditions the replacement must satisfy. | When you want to know what "too much" means numerically. |
| **02** | [02-reference-matrix.md](02-reference-matrix.md) | What each reference contributes and what it may not. Turns "Antigravity restraint" into budgets: 3 regions, 4 hues, 6 borders, 5 type steps, 0 animations, a 2.40 top-to-body ratio. | Before proposing anything borrowed from a reference. |
| **03** | [03-information-hierarchy.md](03-information-hierarchy.md) | The reading order of seven items, the word budget per item, the three region grouping, the hue exclusion rule, and the 15 second comprehension test. | Before deciding what goes where. |
| **04** | [04-state-model.md](04-state-model.md) | Twelve states, their conditions, the 22 row transition table, the `provenance` axis, and five defects in the shipped derivation. Also the finding that the live MCP demo is a three screen experience. | Before writing any derivation. |
| **05** | [05-story-mode-wireframes.md](05-story-mode-wireframes.md) | Nine Story screens drawn in one chassis, with per-screen copy, control counts, word counts and acceptance questions. Section 8 records seven things that only appeared once the screens were drawn. | While building Story Mode. |
| **06** | [06-expert-mode-wireframes.md](06-expert-mode-wireframes.md) | Ten Expert wireframes, the two data planes, why the timeline is indexed by sequence and never by wall clock, and the guarantee that switching modes moves nothing. Targets `/viewer`. | While building Expert Mode. |
| **07** | [07-content-and-vocabulary.md](07-content-and-vocabulary.md) | Eleven approved terms, each with the field that entitles it. The forbidden phrases with the source line that makes each one false. Every user visible string, and the accessibility layer. | Before writing a single word of copy. |
| **08** | [08-visual-system.md](08-visual-system.md) | The 13 tokens `global.css` does not already have, with measured contrast, the scoping mechanism, and the derivation of "no colour alone" from a colour vision simulation. | Before writing CSS. |
| **09** | [09-component-contracts.md](09-component-contracts.md) | Fourteen components: props, the API field each prop reads, states including empty and error, keyboard, three viewports, and what each one is forbidden from displaying. | While writing components. |

## The five facts that constrain everything

Stated once here because every document assumes them.

1. **FleetScope holds no model credential.** The model runs in the developer's
   own Gemini or Antigravity CLI. The middle of the live demo is a screen that
   waits for a human to type in another window.
2. **Delegation is not observable on the MCP path.** Gemini CLI has no sub
   agents. The string `Delegation: Unknown / not observable in this runtime` is
   in the DOM verbatim in every state and both modes, and is asserted by the
   browser suite. It becomes *visible* from the run's first canonical event
   onward (`10` D40), because a non observation about a run that has produced
   nothing invites the reader to think an observation was attempted and failed.
3. **The real transcript is eight events, and they all arrive in one POST.**
   `mcp_server.py:336` publishes them together, so the live reader goes
   `awaiting_agent` to `completed` in a single 400ms poll and never sees the
   middle. `completed` has to work for someone who watched nothing happen.
4. **Nothing is narrated.** `deriveLive` is a pure function of capability, run
   and events. A beat is `done` only because an event of that kind exists.
5. **58 browser checks guard the DOM.** `scripts/qa-live.ts` has 25 `check(` call
   sites, 24 of them outside a five iteration loop, so it runs 29 checks at each
   of 1440x900 and 480x900 against a real governed MCP tool call. The redesign
   adds checks and edits none. One of the 58, the horizontal overflow assertion,
   cannot fail; `00` section 6.1 has the probe and `10` D47 has the replacement.

## Where the work lands

| Surface | Today | After |
|---|---|---|
| `/live` | The Story page. Nine regions, an inspector grade fact list, no visual identity, not in the navigation. | Story Mode by default, Expert Mode behind `?mode=expert`, in the navigation. |
| `/viewer` | The Agent Viewer over a local session file, running its own light theme. | Expert Mode's graph surface, on the shared near black ground. |
| `/cockpit`, `/cases`, `/audit`, `/catalog`, `/approvals` | Unchanged. | Unchanged. This pack does not touch them. |

## Status

Phases 00 to 09 are complete and closed. `10` is the live document: if you change
a decision, change it there and record what it supersedes.

A lane document's **reasoning** is kept as written, so the argument behind each
decision stays readable and a superseded argument does not make the surviving one
look arbitrary. A lane document's **artifacts** are not: typed props, branch
tables, drawn ASCII strings and verification tables are corrected where they
stand, each marked with the decision that changed it. `10` D48 records why. An
implementer copies a component contract and pastes a wireframe string; leaving a
superseded one in place is not preserving reasoning, it is shipping two answers
and putting the wrong one in the build spec.

---

## The state of this pack

Written after three adversarial reviews, so that the next person knows which
parts of this are settled, which are open, and which they will have to decide
alone. `13-critique-response.md` has the detail.

### Settled

Everything with a number behind it. The twelve state machine and its derivation
order; the three Story regions and the seven items in them; the 62 word budget
and its one stated exception; the three control cap; the four hues and their
measured contrast; zero motion in Story; the twelve `data-state` values and the
control count for each; the eleven Story screens and their copy; the token layer,
its thirteen declarations and the two greps that keep it from leaking; the
provenance derivation, which reads events and never capability or state; and the
rule that a term renders only when a named field entitles it.

Also settled, and newer, so more likely to be argued with: Expert Mode's five
regions and eight control cap (D44); the geometric overflow measurement (D47);
the conditional `completed` sentence (D43); the `Source: live` chip (D42); and
the rule that nothing states anything about a run before that run's first event
(D40).

### Open, and named

1. **Expert Mode has never been built against its budget.** Five regions is a
   judgement carried over from `02`:128, not a measurement of a real surface. If
   the built page needs six, that is a decision to record in `10`, not a drift.
2. **Four gate items cannot be observed** inside the granted file scope: a Warden
   refusal, a `truth: 'live'` incident, a scripted transcript, and the two
   recorded fallback screens. `12` section 2a says what unblocks each. Until then
   they are covered by unit tests over `deriveLive` and not by a browser.
3. **Nine deferred items** in `10` section 7, each with an owner. Three of them
   are new: the page-level overflow check, a reachable Warden refusal, and a
   reachable live incident.
4. **Four open questions** in `10` section 8, including whether the Expert event
   console and the canonical timeline are one surface or two.
5. **The fifteen-second comprehension test has never been run.** Every claim
   about what a stranger understands is a designer's prediction. `12` section 8
   is the protocol; five participants, two of whom do not write software.
6. **The in-flight work in the worktree.** `global.css` is 344 lines longer than
   HEAD across four hunks, two crate files that `09` cites are untracked, and the
   wasm ABI is mid-extension. `11` tells you to establish which state you are in
   before starting, and the offsets are in `00`.

### What the coding agent must decide for itself

The pack deliberately stops short of these. Deciding them is not deviating.

1. **Layout inside a region.** The pack fixes what each region contains, its word
   budget and its type step. It does not fix margins, alignment, grid or the
   order of items within a region beyond the reading order.
2. **What the mode switch looks like.** Two buttons with `aria-current`, in the
   command bar, outside `#live-root`. Everything else is yours.
3. **Whether the Expert timeline and console merge.** `10` section 8 item 4.
   Both live in region C either way, so the count does not move.
4. **How the prompt block on `awaiting_agent` is presented inside region A.** It
   is mono, it is not a terminal frame, and `Copy prompt` is in region C. The
   rest is layout.
5. **The shape of the added `qa-live` checks.** The pack specifies what each one
   asserts and, where it matters, the exact expression. It does not specify how
   you factor them.
6. **Anything the pack got wrong.** `11` rule 9: deviating is allowed, deviating
   silently is not. If a decision in `10` turns out to be wrong once it exists in
   code, say so, give the source line, and record it in `10` section 6 in the
   same change. Three reviewers found thirty eight things in a pack that was
   written carefully; the next person will find more.
