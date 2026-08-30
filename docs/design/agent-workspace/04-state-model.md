# State model: the contract the frontend implements

Status: normative for Story Mode and Expert Mode

Phase: 1, depends on `00-current-state-audit.md` and `02-reference-matrix.md`

Last updated: 2026-08-29

## Why this document exists

The review asked for twelve states where ten are shipped. Ten of them are
already derived, already tested, and already asserted by a browser suite that
waits on four of their names by string. Adding names to that enum is cheap to
type and expensive to get wrong, because every name in it is simultaneously a
screen, a DOM attribute value, and a claim about what a run did.

So this document does three things before it describes a single screen. It
decides which of the three requested names become states and which do not, and
says why. It names the exact assertions that change under that decision, with
file and line, so nobody discovers the cost after the fact. And it records two
facts about event delivery that determine which of these states a judge will
ever actually see, because designing a screen nobody reaches is the most
expensive mistake available here.

Everything below was read from source at `cfdcca7`, not from an earlier plan.

## 0. What the shipped machine actually is

`apps/web/src/features/live/state.ts:19-29` defines ten states. `deriveLive`
(`state.ts:178-337`) is a pure function of three inputs and two flags, and it
decides in this order:

1. `capability === null` gives `unavailable` (`state.ts:204`)
2. `starting === true` gives `starting` (`state.ts:245`)
3. `run === null` gives `ready` (`state.ts:256`)
4. finished, meaning `run.endedAt !== null || page.complete === true`, gives
   `historical_replay` when the replay flag is set, otherwise `completed` or
   `failed` on `run.terminalResult` (`state.ts:267-291`)
5. `events.length === 0` gives `awaiting_agent` on the MCP driver and `running`
   on the worker driver (`state.ts:294`)
6. any `intervention` gives `recovering` (`state.ts:308`)
7. any `incident` gives `incident` (`state.ts:318`)
8. otherwise `running` (`state.ts:327`)

Two of those rules are wrong in a way that matters to this redesign, and the
review's request is the fix rather than an addition. Sections 1.1 and 1.2 give
the source for each.

## 1. The decision: extend by two, refuse the third

**Extend the shipped enum with `controlled_fault` and `warden_authorized`.
Refuse to make `recorded` a state. Keep it where it already lives, on the
`Truth` axis, and give it the visibility the review wanted there.**

The resulting enum has twelve members. That is the count the review asked for,
reached by a different route than the one the review proposed, and section 1.3
explains why the route matters.

### 1.1 `controlled_fault` becomes a state, because `incident` currently lies

`incident` is entered whenever an `incident` event exists (`state.ts:318`), and
its sentence is hardcoded to say the failure was deliberate:

> `The first read failed on purpose to exercise recovery: ...` (`state.ts:322`)

But the incident event carries its own truth label, and it is not always
`controlled_fault`. `apps/adk-worker/src/fleetscope_worker/tools.py:131-137`
raises a `ToolFailure` with `truth="live"` whenever the upstream returns a
non-200, and `mcp_server.py:240-251` copies `failure.truth` straight onto the
incident event. A real GitHub outage during a live demo therefore produces an
incident whose truth is `live`, and the shipped page says on purpose about it.

That is precisely the class of claim the whole derivation discipline exists to
prevent, and it cannot be fixed by editing the sentence, because the two cases
need different words, a different colour, and a different recovery story. They
are two screens. Two screens are two states.

* `controlled_fault` when `incident.truth === 'controlled_fault'`
* `incident` when it is anything else

Orange is reserved for the first and forbidden in the second, which is the only
way the locked direction's "orange for Controlled Fault only" rule can be
enforced rather than hoped for.

### 1.2 `warden_authorized` becomes a state, because `recovering` currently lies

`recovering` is entered whenever an `intervention` event exists
(`state.ts:308`), and its sentence asserts that a retry was authorised:

> `The Warden authorised one idempotent retry under the same key.` (`state.ts:313`)

The Warden emits an intervention for every decision it makes, including its
refusals. `apps/adk-worker/src/fleetscope_worker/recovery.py:25-26` defines four
outcomes:

```
retry_once | refuse_not_idempotent | refuse_budget_exhausted | refuse_not_retryable
```

and `mcp_server.py:252-263` emits the intervention before checking
`decision.permits_retry`. Three of those four outcomes are the Warden declining
to act, and the shipped page narrates all four as an authorised retry. A refusal
because the operation is not idempotent is the single most important thing this
system can demonstrate about governance, and today it renders as recovery.

So authorisation is a property of the intervention payload, not of its
existence:

* `warden_authorized` when the latest intervention has
  `payload.outcome === 'retry_once'`
* a refusal is not a state of its own; see section 1.4

Splitting also recovers a distinction the causal timeline already has and the
shipped enum threw away. The intervention and the retry are separate events
(sequence 5 and sequence 6 in the real transcript). The Warden deciding and the
retry being in flight are two different moments, and `recovering` is now free to
mean the second one honestly.

### 1.3 `recorded` does not become a state, because a run can be two things at once

The review asked for `recorded` as distinct from `historical`. The distinction
is real and this document keeps it. What it refuses is the enum slot.

The reason is in `session.py:91-116`. On the scripted worker path every event is
emitted with `truth=evidence_truth`, which is `recorded` (`runtime.py:86`), with
one deliberate exception: the `tool_result` and the `incident` carry
`truth=failure.truth` instead, and the comment says why.

> the failure's own truth label rides on the record (`session.py:93`)

So a recorded run's incident is labelled `controlled_fault`. A run is therefore
`recorded` **and** passing through `controlled_fault` at the same moment. One
variable cannot hold two values, and the first bug produced by pretending
otherwise is a recorded run whose Controlled Fault beat stops saying Controlled
Fault, which is the same class of lie as section 1.1.

`recorded` is a property of how evidence was produced. The codebase already has
a type for exactly that, `Truth` (`state.ts:32`), it already includes
`recorded`, and `TRUTH_LABEL` already renders it. Nothing needs inventing.

What was genuinely missing is that the shipped page never uses it at run level.
Section 6 adds one derived field, `provenance`, on its own axis, and gives the
rule for how it changes the words in `completed`, `failed` and
`historical_replay`. That is the distinction the review asked for, placed where
it cannot collide with the causal position.

### 1.4 Two states that were considered and refused

**`warden_refused`.** Tempting after 1.2, and rejected because no event sequence
leaves the UI resting in it. Both emitters write `run_end` immediately after a
refusing intervention (`mcp_server.py:264-270`, `session.py:133-134`), and the
finished branch runs before any intervention check, so the reader lands in
`failed`. A state the machine passes through inside one poll tick is not a
screen. The refusal rationale is surfaced instead as the `failed` headline and
sentence, which is where a reader is actually looking. Section 3.11 gives the
derivation.

**`blocked`.** A deployment with `LIVE_MODE` off or a non-durable ledger shows
`ready` with no CTA and a reason (`state.ts:217-221`). That is a fact about the
deployment, not about where a run got to, and there is no run. Modelling it as a
state would put a configuration value into the causal timeline. It stays a
modifier on `ready`, and section 3.2 specifies both variants of that screen.

### 1.5 Exactly which shipped assertions change

Two vitest expectations change. Zero browser checks change. The full accounting:

| File and line | Today | Under this model | Required edit |
|---|---|---|---|
| `apps/web/tests/live-state.test.ts:123-128` | expects `incident` for a 4 event slice whose incident has `truth: 'controlled_fault'` | that slice is now `controlled_fault` | change the expectation and the test name; **add** a sibling test with `truth: 'live'` that still expects `incident`, otherwise the generic branch ships untested |
| `apps/web/tests/live-state.test.ts:130-134` | expects `recovering` for a 5 event slice ending at the intervention | that slice is now `warden_authorized` | change the expectation and the test name; **add** a 6 event slice test that expects `recovering`, otherwise the retry-in-flight branch ships untested |
| `apps/web/tests/live-state.test.ts:227-235` | asserts the exact `TRUTH_LABEL` map | unchanged | none. This is the assertion that makes 1.3 free |
| `scripts/qa-live.ts:187, 207, 232, 279` | waits on `ready`, `awaiting_agent`, `completed`, `historical_replay` by string | all four keep their exact names and meanings | none |
| `scripts/qa-live.ts` everywhere else | never waits on `incident`, `recovering`, `running`, `failed`, `starting` or `unavailable` | unchanged | none |
| `apps/web/src/pages/live.astro` style block | contains no `[data-state]` selector at all | two new attribute values appear | none today. Any future CSS keyed on `[data-state='incident']` must also list `[data-state='controlled_fault']` |
| `apps/web/src/features/live/client.ts:100` | writes `view.state` into `#live-root[data-state]` | writes two additional values | none |

Note what the second column of rows one and two means in practice. Both edits
are corrections rather than churn: the existing assertions currently encode the
two bugs from 1.1 and 1.2 as expected behaviour. Leaving them untouched is not
the conservative option, it is the option that keeps the bugs.

### 1.6 The alternative that was rejected, and why

The cheaper design is to keep ten states and expose the two distinctions as
extra attributes, say `data-fault="controlled"` and `data-policy="retry_once"`,
derived from the same events. It costs zero test edits.

It is rejected for two reasons.

First, `#live-root[data-state]` is the only handle the browser suite has. A
distinction that lives only inside a render function cannot be asserted from
outside the page, and the entire value of this codebase's derivation discipline
is that its claims are checkable by something that did not compute them. Put the
distinction where a browser can read it.

Second, two attributes that must be read together to know which screen you are
on is a bug generator. The first defect it produces is an incident headline
rendered beside a Controlled Fault chip. One screen, one variable.

## 2. Which of these twelve a judge can actually reach

This determines where design effort goes, and it is not obvious from the code.

`handle_call` (`mcp_server.py:320-339`) runs the entire governed read, collects
every event it produced, and calls `api.publish(run.run_id, outcome.events)`
**once**, at line 336. All eight events of the real transcript land in a single
`POST /runs/:runId/events`. The page polls every 400ms
(`client.ts:22`), so on the MCP path the reader observes:

```
awaiting_agent  ->  completed
```

and nothing in between. `qa-live.ts` confirms this by construction: it waits for
`awaiting_agent`, calls the tool, then waits for `completed`, and never asserts
an intermediate state.

The worker driver behaves differently. `apps/api/src/runs/worker.ts:195` appends
each event as its stdout line arrives, inside a per-line handler, so every
intermediate state is observable there.

| State | MCP driver (the live demo) | Worker driver | Replay |
|---|---|---|---|
| `unavailable` | yes | yes | yes |
| `ready` | yes | yes | n/a |
| `starting` | yes | yes | n/a |
| `awaiting_agent` | yes | never | n/a |
| `running` | no | yes | yes, when stepped |
| `controlled_fault` | no | yes | yes, when stepped |
| `incident` | no | yes | yes, when stepped |
| `warden_authorized` | no | yes | yes, when stepped |
| `recovering` | no | yes | yes, when stepped |
| `completed` | yes | yes | yes |
| `failed` | yes | yes | yes |
| `historical_replay` | yes | yes | yes |

Three consequences for the design, and they are the reason this section exists.

1. Story Mode's live demo is a **three screen** experience: `ready`,
   `awaiting_agent`, `completed`. Those three carry the entire judge-facing
   argument and deserve the whole budget of care.
2. The six middle states are real, derived, and testable, but their audience is
   the replay scrubber and Expert Mode, not the live run. They should be
   specified correctly and designed economically.
3. No screen may be built on the assumption that the reader watched the
   transition into it. `completed` has to work for someone who saw nothing
   happen, which is exactly what makes the five-beat causal path load-bearing
   rather than decorative.

## 3. The twelve states

### 3.0 Notation, and three rules that apply to all twelve

Conditions below are written against the three API reads the page already makes.

```
cap       GET /runs/capability          null when it did not answer
run       GET /runs/:runId  -> .run     null before a run is admitted
E         GET /runs/:runId/events?after=0 -> .events, ordered by sequence
finished  run.endedAt !== null || page.complete === true
last(k)   highest sequence event of kind k, else null
after(e,k) an event of kind k exists whose sequence is greater than e.sequence
```

**Rule 1: no state is entered by a timer.** The 400ms poll (`client.ts:22`) is
transport. It delivers events; it never decides anything. Two transitions are
driven by a user action rather than an event, `ready -> starting` and
`completed -> historical_replay`, and both are named as such in section 4.
Everything else is a function of `cap`, `run` and `E`.

**Rule 2: motion fires once, on a change of `state`, never on a render.** The
client refetches from cursor 0 every tick (`client.ts:204`) and repaints
unconditionally, so any transition or keyframe attached to a render re-fires two
and a half times a second. The implementation compares the previous `state`
before writing `data-state` and only then plays anything. Every motion budget
below assumes that gate, and every one of them is suppressed entirely under
`prefers-reduced-motion: reduce`.

**Rule 3: `#live-start` keeps the text `Run live recovery demo` in every state.**
It is asserted by string (`qa-live.ts:193`). A state that needs a differently
worded action uses a different element. Enabled state and visual prominence may
change freely.

Each state below gives the ten fields the specification requires. "Causal step"
names which of the five-beats is active: Start, Governed read, Controlled Fault,
Warden retry, Result.

---

### 3.1 `unavailable`

* **Headline** `No API`
* **Current sentence** This page has no FleetScope service to talk to, so no run
  can be started and no evidence can be read.
* **Primary CTA** None. There is nothing the page can do about it, and a button
  that retries a fetch the poller already retries every 400ms would be theatre.
* **Secondary CTA** None.
* **Truth label** `Unavailable`. This is the label's only purpose: it is the one
  `Truth` value that describes the absence of a record rather than a record.
* **Causal step** None. No beat is active, and all five render as pending rather
  than as unknown, because nothing was attempted.
* **Motion** None.
* **Technical evidence** None to reach. Expert Mode shows the resolved API base
  and the reason string, which is the only diagnostic that exists.
* **Failure and recovery** This *is* the transport failure state. It is left the
  moment a capability read succeeds, with no user action. It is reachable from
  every other state, including mid run, and leaving a run behind is not a loss:
  the ledger is append-only and the run is re-addressable by id.
* **Condition** `cap === null`. Produced by an unset `PUBLIC_API_BASE_URL`, a
  fetch that threw, or a non-2xx from `/runs/capability` (`client.ts:190-195`).

---

### 3.2 `ready`

Two variants, one state. The causal position is identical, only the affordance
differs, and section 1.4 gives the reason they are not two states.

**Variant A, startable.**

* **Headline** `Ready`
* **Current sentence** Starting a run admits it against one fixed scenario and
  nothing else.
* **Primary CTA** `Run live recovery demo` (`#live-start`), enabled. The only
  action on the screen.
* **Secondary CTA** None. Story Mode's default view has exactly one action, and
  there is no evidence yet to offer as an alternative.
* **Truth label** None shown. A truth label describes how a record was produced
  and there is no record. Showing `Unknown` here would invite the reader to think
  something was attempted and could not be classified.
* **Causal step** None active. All five-beats visible and pending, which is the
  contract being previewed rather than progress being claimed.
* **Motion** None.
* **Technical evidence** Story Mode shows nothing. Expert Mode shows the budget
  and the scenario definition, both of which are readable before committing to
  anything and are the honest thing to let a sceptic check first.
* **Failure and recovery** Pressing the CTA can fail; see 3.3.
* **Condition** `cap !== null && startPending === false && run === null && cap.liveMode && cap.durableLedger`

**Variant B, refused.**

* **Headline** `Cannot run here`
* **Current sentence** One of two exact strings, never a summary of both:
  `LIVE_MODE is off, so this deployment may replay evidence but not start a run.`
  or
  `The run ledger is not durable, so a run cannot be recorded and will not be started.`
  (`state.ts:218-220`)
* **Primary CTA** None. The button is present but disabled, so that a reader who
  looks for it finds it beside the reason instead of wondering where it went.
* **Secondary CTA** None.
* **Truth label** None shown, for the same reason as variant A.
* **Causal step** None.
* **Motion** None.
* **Technical evidence** Expert Mode shows the capability payload verbatim. This
  is the one refusal a reader is most likely to suspect of being cosmetic, so the
  raw response is the answer.
* **Failure and recovery** Not a failure. It is a deployment that declines to
  make a promise it cannot keep, and it is left only by changing the deployment.
* **Condition** `cap !== null && run === null && (cap.liveMode === false || cap.durableLedger === false)`

---

### 3.3 `starting`

* **Headline** `Admitting`
* **Current sentence** Admitting a run against the fixed scenario.
* **Primary CTA** `#live-start`, disabled, showing a busy affordance in place.
  Keeping the button in the same place rather than swapping it for a spinner
  means the layout does not move under the reader's cursor.
* **Secondary CTA** None.
* **Truth label** None shown. Still no record.
* **Causal step** None. The Start beat is not done until `run_start` exists,
  which happens after admission, on the agent's first tool call.
* **Motion** The one exception in the whole model. An indeterminate busy
  indication is permitted, because this is the only state whose duration is
  bounded by a network request rather than by an event, and because a reader who
  just clicked needs to know the click registered. It is bound to the `POST`
  promise, and it stops when the promise settles. It is not a progress bar: there
  is nothing to be a fraction of.
* **Technical evidence** None. Nothing exists yet to inspect.
* **Failure and recovery** A non-2xx or a thrown fetch returns the page to
  `ready` and must show why. The shipped client has a defect here: it writes
  `session.unavailableReason` (`client.ts:229`) which is only ever read on the
  `cap === null` branch, so a failed start is silent. Section 7.2 specifies the
  fix. The API's refusal reasons are enumerable (`admission.ts:20-30`) and
  `run_already_active` is the one a reader will actually hit.
* **Condition** The `POST /runs` promise issued by the CTA has not settled. This
  is a UI flag, not an event, and it is one of only two such flags in the model.

---

### 3.4 `awaiting_agent`

The most important screen in the product, and the one the shipped design treats
as an interstitial. On the MCP path this is where a judge spends the entire
middle of the demo, because section 2 shows there is nothing between here and
`completed`.

* **Headline** `Your turn`
* **Current sentence** FleetScope admitted the run. It holds no model
  credential, so the next move is yours: call the FleetScope tool from your own
  Gemini or Antigravity session.
* **Body copy** The two shipped lines, verbatim, because they are asserted by
  string (`qa-live.ts:212-215`):
  `Your Gemini/Antigravity agent is ready to call FleetScope.` and
  `FleetScope is governing the tool and recovery policy.`
* **Primary CTA** The tool invocation itself, presented as a copyable monospace
  line. This is the one place the term-v0 reading in `02-reference-matrix.md`
  earns its keep: a mono command alone on a line is the action, and it needs no
  window chrome to say terminal. It is a copy action, not a run action, and the
  distinction is the honest one, because FleetScope genuinely cannot perform it.
* **Secondary CTA** None. There is no cancel endpoint, and offering one that
  reloads the page would misrepresent what happened to the run.
* **Truth label** `Live`. The run is admitted in a live ledger and the next event
  will be a live observation.
* **Causal step** None done yet, Governed read is next. The Start beat is still
  pending, because `run_start` is emitted by the agent's call
  (`mcp_server.py:158-171`), not by admission.
* **Motion** None. Explicitly forbidden: no pulsing dot, no fake typing, no
  animated ellipsis. Every one of those implies the system is doing work, and it
  is doing none. It is waiting for a human to type in another window, and the
  screen should look exactly as patient as that.
* **Technical evidence** Story Mode shows the run id, because a reader may need
  it to correlate with their own terminal. Expert Mode shows the cursor at 0,
  which is the strongest possible evidence that nothing has been claimed.
* **Failure and recovery** The real dead end in this model, and it is honest to
  name it. If the agent never calls, the run stays `admitted` forever: there is
  no timeout on the MCP path, and `run_already_active` (`admission.ts:29`) will
  refuse every subsequent start. The reader has no in-page escape. Until the API
  grows an abandon route, this screen must say what to do about it in words,
  and must not offer a button that appears to cancel and does not.
* **Condition** `run !== null && !finished && E.length === 0 && cap.runDriver === 'mcp'`

---

### 3.5 `running`

* **Headline** `Reading`
* **Current sentence** Two forms, chosen by whether a `tool_result` exists:
  `The agent called the governed read.` before one, and
  `The governed read returned; the run is still under way.` after one.
* **Primary CTA** None. Nothing the reader can usefully do, and a disabled
  primary button would be a worse answer than an absent one.
* **Secondary CTA** None.
* **Truth label** `Live`, or `Recorded` when section 6's provenance rule says so.
* **Causal step** Governed read, active.
* **Motion** None in Story Mode. In Expert Mode the graph and the event rail
  extend as events land, which is content changing rather than motion added.
* **Technical evidence** Story Mode, no. Expert Mode, the canonical rows so far.
* **Failure and recovery** Leaves to `controlled_fault` or `incident` on a
  failure, to `completed` or `failed` on `run_end`. If the driving process dies
  the run stops advancing with no event to say so, and the page correctly keeps
  showing the last thing that was true rather than inventing a timeout.
* **Condition** `!finished` and either `E.length === 0 && cap.runDriver === 'worker'`,
  or `E.length > 0 && last('incident') === null && last('intervention') === null`

---

### 3.6 `controlled_fault`

* **Headline** `Failed on purpose`
* **Current sentence** The first read failed by design, so the recovery is
  something you watch rather than something you take on trust.
* **Primary CTA** None. The Warden acts next, not the reader.
* **Secondary CTA** None.
* **Truth label** `Controlled Fault`. The only state in the model that carries
  it, and the only place orange is permitted anywhere in the product.
* **Causal step** Controlled Fault, active. Start and Governed read done.
* **Motion** None. The temptation here is an alarm treatment, and it is wrong
  twice over: the failure was scheduled, and animating it would make the one
  deliberately safe failure in the system look like the dangerous kind.
* **Technical evidence** Story Mode shows the incident reason as a sentence,
  because it is the payload field a reader most wants and it is already plain
  English (`Controlled Fault: injected`). Expert Mode shows the whole incident
  payload including `sideEffectClass` and `retryable`, which are what make the
  next decision legible.
* **Failure and recovery** This is a failure that the system expects. It leaves
  to `warden_authorized` when the policy allows a retry, and to `failed` when it
  does not. A refusing intervention with no `run_end` yet leaves the reader here
  by design, with the refusal rationale shown, because the fault is unresolved
  and the screen should keep saying so.
* **Condition** `!finished && I = last('incident') !== null && I.truth === 'controlled_fault'`,
  and no authorising intervention after `I` (see 3.8). Emitted at
  `mcp_server.py:240-251` and `session.py:107-117`.

---

### 3.7 `incident`

* **Headline** `Read failed`
* **Current sentence** The read failed, and FleetScope did not cause it.
* **Primary CTA** None.
* **Secondary CTA** None.
* **Truth label** Whatever `I.truth` is, which on this branch is `Live` in
  practice and could be `Unknown`. Never `Controlled Fault`, and never orange.
* **Causal step** Controlled Fault, active, but labelled by its own beat text
  rather than the scenario's. This is the one place the five-beat vocabulary and
  the run disagree, and the beat defers to the event.
* **Motion** None.
* **Technical evidence** Same as 3.6. The `reason` field here is an upstream
  message rather than a scripted one (`upstream returned HTTP 503`), so Expert
  Mode is more likely to be needed and Story Mode should not paraphrase it.
* **Failure and recovery** Identical mechanics to 3.6 and a different story. The
  policy decides on `sideEffectClass` and `retryable` (`recovery.py:56-72`), so a
  genuine upstream 5xx on an idempotent read is still retried once, and a 4xx is
  not.
* **Condition** `!finished && I = last('incident') !== null && I.truth !== 'controlled_fault'`,
  and no authorising intervention after `I`.

---

### 3.8 `warden_authorized`

* **Headline** `Retry authorized` (C8: `z` everywhere)
* **Current sentence** The Warden allowed exactly one retry, because this read
  can be repeated without changing anything.
* **Primary CTA** None.
* **Secondary CTA** None.
* **Truth label** `Live`. The intervention is emitted with the run's own
  evidence truth (`mcp_server.py:252-263`), never with the fault's.
* **Causal step** Warden retry, active. Its authorisation half.
* **Motion** None. Violet is the Warden's colour and this is where it appears.
  Colour arriving is enough of an event; it does not also need to move.
* **Technical evidence** Story Mode shows `payload.rationale`, which the policy
  writes as a readable sentence on purpose (`recovery.py:72-75`). Expert Mode
  adds `outcome`, `retriesUsed`, `maxRetries` and `idempotencyKey`. That last one
  is the proof that the retry is the same operation and not a second one, and it
  is the single most checkable claim in the demo.
* **Failure and recovery** Leaves to `recovering` when the retry call is
  observed. If the driver stops between the decision and the call, the page stays
  here, which is accurate: a decision was recorded and no retry happened.
* **Condition** `!finished && V = last('intervention') !== null && V.payload.outcome === 'retry_once' && !after(V, 'tool_call')`

---

### 3.9 `recovering`

* **Headline** `Retrying`
* **Current sentence** The retry is running under the same idempotency key, so
  the ledger counts one operation and not two.
* **Primary CTA** None.
* **Secondary CTA** None.
* **Truth label** `Live`, or `Recorded` per section 6.
* **Causal step** Warden retry, active. Its execution half.
* **Motion** None in Story Mode.
* **Technical evidence** Story Mode, no. Expert Mode shows the retry `tool_call`
  beside the first one so the two idempotency keys can be compared directly. Two
  rows with the same key is the whole argument.
* **Failure and recovery** Leaves to `completed` or `failed` on `run_end`. A
  second incident sends the reader back to 3.6 or 3.7, where the next
  intervention will carry `refuse_budget_exhausted` because `max_retries` is 1
  (`recovery.py:67-71`), and the run then ends as `failed`.
* **Condition** `!finished && V = last('intervention') !== null && V.payload.outcome === 'retry_once' && after(V, 'tool_call')`

---

### 3.10 `completed`

One of the three screens the live demo actually reaches, and the one that has to
work for a reader who watched nothing happen.

* **Headline** `Recovered`
* **Current sentence** **Conditional on the events it names. Amended by `10`
  D43, and by C9 for the last word.** The shipped sentence is the product's whole
  argument in one line, but this state's entry condition,
  `finished && run.terminalResult === 'succeeded'`, requires neither an
  `incident` event nor an `intervention`, and the sentence asserts both. A
  success with no incident is reachable: see `07` section 3.10 for the ledger
  path that produces one. So the sentence branches.
  * `incident` exists, the latest `intervention` has
    `payload.outcome === 'retry_once'`, and a `tool_call` follows it:
    `The governed read failed once by design, the Warden authorized one
    idempotent retry, and the retry returned the result.`
  * otherwise: `The governed read returned on its first attempt. No fault
    occurred and the Warden was not called.`

  This is the same correction sections 1.1 and 1.2 of this document make to the
  shipped `incident` and `recovering` sentences, applied to the one sentence
  those sections left alone.
* **Primary CTA** `Replay evidence`. This is a change from the shipped page,
  where the start button is the only styled action. The reasoning: the run has
  just asserted something, and the next question any sceptical reader has is
  prove it, not do it again. Making the proof the obvious action is the design
  answering the question the screen just raised.
* **Secondary CTA** `#live-start`, still reading `Run live recovery demo`, still
  enabled when `cap` permits, demoted to secondary weight.
* **Truth label** Per beat rather than per screen. The Controlled Fault beat says
  `Controlled Fault`, the others say `Live` or `Recorded`. A single screen level
  label would have to average four differently produced records into one word,
  and averaging truth is how truth stops meaning anything.
* **Causal step** All five done. This is the only state in which the causal path
  is complete, and it is where that path stops being a progress indicator and
  starts being the evidence summary.
* **Motion** **None. Superseded by `10` D17.** This bullet permitted one
  transition on entry; `02` budgets zero animations for Story and `08` check V7
  asserts an empty array in all twelve states, which is only checkable with no
  exceptions. The product argument is the stronger one: on the MCP path all eight
  events arrive in one POST, so `completed` is a batch arriving, and animating it
  dramatises a transaction.
* **Technical evidence** Story Mode shows the outcome and the five-beats and
  stops. The six fact definition list the shipped page renders by default
  (`live.astro:51-58`) moves behind Expert Mode; it is an inspector, and the
  review named it as one of the reasons the default view reads as devtools.
* **Failure and recovery** Terminal and stable. The poller keeps running against
  a finished run and reads the same events forever, which is why replay is
  provably free: `observedWork` (`event.ts:118-129`) is computed from the stored
  events and re-reading cannot move it.
* **Condition** `finished && run.terminalResult === 'succeeded' && replaying === false`

---

### 3.11 `failed`

* **Headline** `Not recovered`
* **Current sentence** Derived, in this order of preference:
  1. When the last intervention refused, its rationale, prefixed so the refusal
     reads as a decision rather than a breakage: `The Warden refused the retry:
     <rationale>.` The four possible rationales are written by
     `recovery.py:57-75` and are already plain sentences.
  2. Otherwise the shipped fallback, `The run ended as <terminalResult>.`
  This is where the `warden_refused` state refused in section 1.4 pays its way.
  A policy refusal is the most interesting failure this system produces, and it
  belongs in the largest sentence on the screen rather than in an inspector.
* **Primary CTA** `Replay evidence`. Same reasoning as 3.10, more strongly: a
  failure is the outcome a reader is least willing to take on trust.
* **Secondary CTA** `#live-start`, demoted, enabled when `cap` permits.
* **Truth label** Per beat, as in 3.10.
* **Causal step** All beats that were reached are done; the rest stay pending
  rather than becoming `failed`. `deriveBeats` (`state.ts:155-165`) is right
  about this and the comment there says why: a run that never reached a beat did
  not reach it, and that is the same statement as it never happened.
* **Motion** One permitted transition, once, on entry. Identical budget to 3.10;
  a failure gets no extra emphasis, because emphasis would be editorialising.
* **Technical evidence** Same split as 3.10, with one addition promoted into
  Story Mode: the intervention `outcome` string, because `refuse_not_idempotent`
  is the difference between a bug and a policy working.
* **Failure and recovery** Terminal and stable.
* **Condition** `finished && run.terminalResult !== 'succeeded' && replaying === false`.
  The API maps terminal results at `runs.ts:250-266`, so this branch also covers
  `timed_out` and `unknown`.

---

### 3.12 `historical_replay`

* **Headline** `Replaying`
* **Current sentence** `Historical replay of <runId>.` followed by `REPLAY_NOTE`
  verbatim, because `zero model, tool and Warden calls` is asserted by string
  (`qa-live.ts:283-286`).
* **Primary CTA** None while replaying. This is the one screen in Story Mode
  whose purpose is reading rather than acting.
* **Secondary CTA** `Back to result`. New, and it fixes a defect: the shipped
  client sets `session.replaying = true` on click (`client.ts:239`) and never
  sets it back, so `historical_replay` is a one-way door out of which only a page
  reload leads, and `canStart` is false the whole time. See section 7.1.
* **Truth label** Per beat, plus the run level provenance chip from section 6.
  This is the screen where provenance matters most, because replaying a live run
  and reading a scripted transcript look identical and are not the same claim.
* **Causal step** Whichever step the scrubber is on. This is the only state in
  which the causal path is navigable rather than a report, and it is the reason
  the six middle states of section 2 are worth specifying at all: replay is where
  a reader can actually visit them.
* **Motion** Movement of the playhead, driven by the reader's own input. No
  autoplay, ever. An autoplaying replay of a recorded run is indistinguishable
  from a live run to anyone who did not read the label, which is the exact
  confusion `Truth` exists to prevent.
* **Technical evidence** Fully reachable, in both modes. Replay is the evidence
  view; hiding evidence inside it would leave it with no purpose.
* **Failure and recovery** Cannot fail. It performs no writes: the handler only
  reads (`runs.ts:169-189`) and returns
  `replay: { modelCalls: 0, toolCalls: 0, wardenActions: 0 }` as a literal, which
  `qa-live.ts:288-293` verifies by comparing the cursor before and after.
* **Condition** `finished && replaying === true`. The second and last UI flag in
  the model, and like `starting` it is set by a user action and named as such.

## 4. Transition table

Every row is justified by a canonical event or by a named user action. There is
no row whose trigger is elapsed time. The poll interval appears nowhere in this
table because it delivers events; it does not cause transitions.

`E'` means the event set after the transition. `V` means `last('intervention')`,
`I` means `last('incident')`.

| # | From | To | Trigger | Exact condition | Reversible |
|---|---|---|---|---|---|
| T1 | any | `unavailable` | transport | `GET /runs/capability` returns null, threw, or non-2xx | yes, T2 |
| T2 | `unavailable` | `ready` | transport | a capability read succeeds and `run === null` | yes, T1 |
| T3 | `unavailable` | last known state | transport | a capability read succeeds and `run !== null`; the run record and events are re-read and the state is recomputed from scratch | yes, T1 |
| T4 | `ready` | `starting` | **user action**: clicks `#live-start` | `cap.liveMode && cap.durableLedger` | no |
| T5 | `starting` | `ready` | transport | `POST /runs` returned non-2xx or threw. The rejection reason (`admission.ts:19-30`) becomes the visible sentence | yes, T4 |
| T6 | `starting` | `awaiting_agent` | event absence | `POST` 2xx, `cap.runDriver === 'mcp'`, and `E' .length === 0` | no |
| T7 | `starting` | `running` | event absence | `POST` 2xx, `cap.runDriver === 'worker'` | no |
| T8 | `awaiting_agent` | `running` | `tool_call` | `E'.length > 0`, no `incident`, no `run_end` | no |
| T9 | `awaiting_agent` | `completed` | `run_end` | the whole batch lands at once; `terminalResult === 'succeeded'`. **This is the transition the live MCP demo actually takes**, per section 2 | no |
| T10 | `awaiting_agent` | `failed` | `run_end` | same batch, `terminalResult !== 'succeeded'` | no |
| T11 | `running` | `controlled_fault` | `incident` | `I !== null && I.truth === 'controlled_fault'` | no |
| T12 | `running` | `incident` | `incident` | `I !== null && I.truth !== 'controlled_fault'` | no |
| T13 | `controlled_fault` | `warden_authorized` | `intervention` | `V.sequence > I.sequence && V.payload.outcome === 'retry_once'` | no |
| T14 | `incident` | `warden_authorized` | `intervention` | same | no |
| T15 | `controlled_fault` or `incident` | stays put | `intervention` | `V.payload.outcome` starts with `refuse_`. The screen does not move, and the refusal rationale is added to it. `run_end` follows immediately in both emitters, so T18 fires within the same poll | n/a |
| T16 | `warden_authorized` | `recovering` | `tool_call` | an event of kind `tool_call` exists with `sequence > V.sequence` | no |
| T17 | `recovering` | `controlled_fault` or `incident` | `incident` | a second `incident` with `sequence > V.sequence`; routed by its own truth, exactly as T11 and T12 | no |
| T18 | `running`, `controlled_fault`, `incident`, `warden_authorized`, `recovering` | `completed` | `run_end` | `finished && run.terminalResult === 'succeeded'` | no |
| T19 | the same five | `failed` | `run_end` | `finished && run.terminalResult !== 'succeeded'`; covers `failed`, `timed_out` and `unknown` (`runs.ts:250-266`) | no |
| T20 | `completed` or `failed` | `historical_replay` | **user action**: clicks `Replay evidence` | `finished` | yes, T21 |
| T21 | `historical_replay` | `completed` or `failed` | **user action**: clicks `Back to result` | routed by `run.terminalResult`. **New.** See 7.1 | yes, T20 |
| T22 | `completed` or `failed` | `starting` | **user action**: clicks `#live-start` | `cap.liveMode && cap.durableLedger && cap.activeRunId === null` | no |

Four user actions in twenty two rows: T4, T20, T21, T22. Everything else is an
event arriving or the transport changing its mind. That ratio is the point.

### 4.1 Two transitions that deliberately do not exist

**No transition out of `awaiting_agent` on elapsed time.** There is no abandon
route on the API, and inventing a client-side timeout would mean the page
declaring a run dead that the ledger still holds open, after which
`run_already_active` refuses every restart while the screen says the opposite.
See 3.4.

**No transition out of `completed` or `failed` on new events.** The API refuses
to append to a finished run with a 409 (`runs.ts:211-216`), so a finished run
cannot reopen. The page inherits that guarantee rather than reimplementing it.

## 5. State diagram

```
  ANY  ---------------- capability read fails ---------------->  unavailable
  unavailable  -------- capability read succeeds ------------->  ready | resume

     ready
       |  user action: clicks Run live recovery demo
       v
     starting  ------------- POST refused ------------------->  ready
       |
       |  POST 2xx
       +--- cap.runDriver == 'mcp'    ---->  awaiting_agent
       +--- cap.runDriver == 'worker' ---->  running

     awaiting_agent  --- first tool_call, no incident --------->  running

     running
       |  incident event arrives
       +--- incident.truth == 'controlled_fault' -->  controlled_fault
       +--- otherwise                             -->  incident

     controlled_fault | incident
       |  intervention arrives
       +--- payload.outcome == 'retry_once' ------>  warden_authorized
       +--- payload.outcome starts 'refuse_' -----> (stays; run_end follows)

     warden_authorized  --- tool_call at a higher sequence --->  recovering

     recovering  --------- a second incident ----------------->  controlled_fault
                                                                 | incident

     running | controlled_fault | incident | warden_authorized | recovering
       |  run_end event arrives
       +--- terminalResult == 'succeeded' -------->  completed
       +--- otherwise                    -------->  failed

     completed | failed  -- user action: Replay evidence ----->  historical_replay
     historical_replay   -- user action: Back to result ------>  completed | failed
     completed | failed  -- user action: Run again -----------> starting
```

### 5.1 The path the live demo actually walks

Section 2's finding, drawn. Everything in the middle of the diagram above is
real, derived and testable, and on the MCP driver it is skipped in one tick
because `handle_call` publishes all eight events in a single POST
(`mcp_server.py:336`).

```
   ready  -->  starting  -->  awaiting_agent  -->  completed
                                              ^
                                              |
                             the eight event transcript arrives
                             in ONE poll: run_start, tool_call,
                             tool_result[controlled_fault],
                             incident[controlled_fault],
                             intervention[warden, retry_once],
                             tool_call, tool_result, run_end
```

Design consequence, stated once so it is not rediscovered later: the causal
path on the `completed` screen is not a replay of something the reader watched.
It is the first time the reader sees any of it. It has to stand on its own.

## 6. Provenance: where `recorded` lives instead

Section 1.3 refused `recorded` as a state. This is where the distinction the
review asked for actually gets made, on an axis that cannot collide with the
causal position.

Add one derived field to `LiveView`:

```ts
readonly provenance: Truth;   // 'live' | 'recorded' | 'unknown'
```

derived from the events and nothing else:

```
provenance = E.length === 0                          -> 'unknown'
             E.some(e => e.truth === 'live')         -> 'live'
             otherwise                               -> 'recorded'
```

**Why derived from events rather than from `cap.workerMode`.** The capability
endpoint does report it (`runs.ts:113`), so this looks like the shorter path. It
is the wrong one. Capability describes the deployment *now*; the events describe
the run *then*. A deployment that changed `workerMode` between the run and the
read would silently relabel history, which is the failure this whole codebase is
arranged against. The events carry their own truth on every line
(`event.ts:23-30`) precisely so nothing outside them has to be trusted. As a
side benefit, `Capability` (`state.ts:76-86`) does not currently carry
`workerMode` at all, so the honest rule is also the one that needs no type
change.

**Why `some(live)` and not `every(recorded)`.** A recorded run's `tool_result`
and `incident` carry `truth: 'controlled_fault'`, not `recorded`
(`session.py:93-110`, and the comment there explains it). A rule written as
"every event is recorded" would classify every recorded run as `live`, which is
the exact inversion of the intent.

### 6.1 What provenance changes on screen

It never changes a headline and never changes which state you are in. It changes
one chip and one clause, in three states.

| State | `provenance === 'live'` | `provenance === 'recorded'` |
|---|---|---|
| `completed` | shipped sentence, unchanged | shipped sentence, plus: `No model ran. This transcript was produced deterministically.` |
| `failed` | shipped or refusal sentence | same, plus the same clause |
| `historical_replay` | `Re-reading the record of a run that happened.` | `This transcript was scripted. No model ran, then or now.` |

The run-level chip renders `TRUTH_LABEL[provenance]`, which already exists
(`state.ts:34-40`) and is already asserted by string
(`live-state.test.ts:227-235`). Nothing about the beat level truth labels
changes: the Controlled Fault beat keeps saying Controlled Fault on a recorded
run, which is the behaviour section 1.3 was protecting.

### 6.2 The delegation asymmetry, and why it must not be read as quality

A consequence of provenance that the design has to handle deliberately.

The scripted path emits a real `delegation` event (`session.py:55-60`), so a
recorded run legitimately shows `Delegation: observed at event N`. The MCP path
never emits one, because Gemini CLI has no sub-agents, so a live run shows
`Delegation: Unknown / not observable in this runtime` (`state.ts:117`).

So the *live* run shows less than the *recorded* one on this single axis. A
reader skimming two runs side by side will read that as the live run being worse
instrumented. It is not: it is the only one of the two telling the truth about a
runtime that genuinely cannot report delegation.

The design requirement that follows: wherever both provenances can appear, the
delegation line states which runtime it is describing, and the word `Unknown`
is never rendered in the same treatment as a failure. It is an absence of
observation, not an absence of behaviour, and `deriveBeats` already gives it its
own `BeatStatus` for that reason (`state.ts:88`, and the header comment at
`state.ts:12-16`).

## 7. Defects in the shipped derivation that this model requires fixing

Five, in the order they should be fixed. The first two are the ones a judge can
hit.

**7.1 `historical_replay` is a one-way door.** `client.ts:239` sets
`session.replaying = true` and nothing ever sets it false. Because
`deriveLive` returns `canStart: false` on that branch (`state.ts:271-279`), a reader
who presses Replay evidence loses the start button permanently and can only
recover by reloading. Fix: T21, a `Back to result` control that clears the flag.
`qa-live.ts` never leaves the state, so this is additive and breaks nothing.

**7.2 A failed start is silent.** `client.ts:229` writes
`session.unavailableReason` when the POST throws, but that field is only read on
the `capability === null` branch (`state.ts:209`), which is not the branch a
reachable API takes. The reader sees the button re-enable with no explanation.
Fix: carry the reason on a field the `ready` branch reads, and render the
`admission.ts:19-30` rejection reason when the API gave one. `run_already_active`
is the case a reader will actually meet.

**7.3 The page ships claiming `ready` before it has asked.**
`live.astro:25` hardcodes `data-state="ready"` in the static HTML, which
contradicts the file's own header comment about not claiming a state until the
API has answered, and lets `qa-live.ts:185-189` pass on the static attribute
rather than on a derived one. Fix: the initial attribute is `unavailable`, which
is what is actually true before the first capability read.

**7.4 `.live-beat__status` does not contain a status.** `client.ts:75-85` writes
the *truth label* into the element named status, so a done beat renders
`Live` and never `done`. The class name is now contractual:
`qa-live.ts:240` reads `Controlled Fault` out of it. Fix by addition rather than
renaming: keep `.live-beat__status` carrying the truth word, and let
`[data-beat][data-status]` remain the machine-readable status it already is.
Record the naming as known and do not rename it.

**7.5 and 7.6** are sections 1.1 and 1.2. They are the reason this model exists
and are fixed by adopting it.

## 8. What implementing this contract requires

### 8.1 Type changes in `apps/web/src/features/live/state.ts`

```ts
export type LiveState =
  | 'unavailable' | 'ready' | 'starting' | 'awaiting_agent' | 'running'
  | 'controlled_fault'      // new
  | 'incident'
  | 'warden_authorized'     // new
  | 'recovering'
  | 'completed' | 'failed' | 'historical_replay';
```

plus `readonly provenance: Truth` on `LiveView` (section 6) and a
`readonly startFailure: string | null` for 7.2. `Truth`, `TRUTH_LABEL`,
`BeatStatus`, `Beat` and `CanonicalEvent` are unchanged.

### 8.2 Derivation order in `deriveLive`

Replace steps 6 and 7 of the shipped order with:

```
6.  V = last('intervention')
    if V !== null && V.payload.outcome === 'retry_once':
        after(V,'tool_call') ? 'recovering' : 'warden_authorized'
7.  I = last('incident')
    if I !== null:
        I.truth === 'controlled_fault' ? 'controlled_fault' : 'incident'
8.  otherwise 'running'
```

Steps 1 to 5 and 8 are unchanged. The function stays pure and stays total: a
refusing intervention falls through step 6 to step 7 and holds the reader on the
fault screen, which is T15.

### 8.3 DOM contract

Unchanged, in full: `#live-root[data-state]`, `#live-start` and its exact text,
`#live-delegation[data-observed]`, `#live-awaiting`,
`[data-beat][data-status]`, `.live-beat__status`, `#live-policy`,
`#live-incident`, `#live-result`, `#live-cursor`, `#live-budget`,
`#live-replay`, `#live-replay-note`.

Added: `#live-root[data-state]` gains the values `controlled_fault` and
`warden_authorized`; `#live-provenance[data-provenance]` for the section 6 chip;
`#live-replay-back` for T21; `#live-start-error` for 7.2.

### 8.4 Tests

Two edits and four additions in `apps/web/tests/live-state.test.ts`, per the
table in 1.5:

1. edit `:123-128` to expect `controlled_fault`
2. edit `:130-134` to expect `warden_authorized`
3. add: a `truth: 'live'` incident still gives `incident`
4. add: a six event slice, ending at the retry `tool_call`, gives `recovering`
5. add: an intervention with `outcome: 'refuse_not_idempotent'` and no `run_end`
   leaves the state at `controlled_fault`, and does not give `recovering`
6. add: `provenance` is `recorded` for an all recorded transcript whose incident
   carries `truth: 'controlled_fault'`, which is the case 6.1 was written for

`scripts/qa-live.ts` needs no change to keep passing. It should gain one check,
that `Back to result` returns `data-state` to `completed`, so T21 is covered by
the browser suite that covers the rest of the replay contract.
