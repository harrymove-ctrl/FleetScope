# 07. Content and vocabulary

Phase 5 of the agent workspace design. This document locks the words. Every
other document in this directory decides where something goes; this one decides
what it says, and, more importantly, what has to be true before it may say it.

## Why this document exists

The review that commissioned this work rejected the earlier prototype for six
reasons. Five of them are layout problems. The sixth, "treating Antigravity-like
as a colour swap", is a content problem wearing a visual costume: a screen reads
as a devtools panel largely because of the words on it, and no palette change
fixes a screen that says `result awaiting runtime` in green.

The autopsy in `01-prototype-autopsy.md` found a seventh failure the review did
not name: the prototype displayed thirteen events for an eight event run, three
latency figures for a type with no latency field, and a `warden-policy@1.2.0`
string taken from a recorded fixture and shown under a `Live` pill. Every one of
those is a content failure. None of them would have been caught by a layout
review, and all of them would have been caught by a rule that says a string may
appear only when a named field entitles it.

So this document is written as an entitlement table rather than a copy deck. For
each approved term it gives the predicate over canonical events that permits the
UI to render it. A term with no predicate is not approved, however good it reads.

## 0. What was verified before writing anything

Every claim below was read out of source at `cfdcca7`, not recalled.

| Claim | Verified at |
|---|---|
| Ten shipped states, twelve after phase 4 | `apps/web/src/features/live/state.ts:19-29`, `docs/design/agent-workspace/04-state-model.md:895-902` |
| Five truth labels, exact strings | `apps/web/src/features/live/state.ts:34-40` |
| Nine canonical event kinds | `apps/adk-worker/src/fleetscope_worker/mcp_server.py`, `session.py` emitters |
| The Warden is the event author, not the model | `mcp_server.py:253` emits `agent="warden"` |
| The retry loop is FleetScope's, not the runtime's | `apps/adk-worker/src/fleetscope_worker/recovery.py:3-8`, and the `while True` at `mcp_server.py:198` |
| Four policy outcomes, only one of which retries | `recovery.py:25-26`, `recovery.py:56-75` |
| The Controlled Fault text the UI shows | `apps/adk-worker/src/fleetscope_worker/faults.py:36-37` |
| The fault is bounded to attempt 1 | `apps/adk-worker/src/fleetscope_worker/scenario.py:52` (`fault_attempts=1`) |
| Delegation is never observed on the MCP path | `mcp_server.py:287-291`, comment and `delegationObserved: False` |
| Contractual strings asserted by the browser suite | `scripts/qa-live.ts:193, 198-200, 213-214, 243, 253, 257, 263, 284-286` |
| `TRUTH_LABEL` asserted exactly by unit test | `apps/web/tests/live-state.test.ts:228-235` |
| The success `tool_result` truth is hardcoded `live` | `mcp_server.py:278` |
| The QA harness runs the tool offline against a fixture | `scripts/qa-live.ts:91`, `apps/adk-worker/src/fleetscope_worker/transport.py:53-57` |

Three findings fell out of that reading and they shape the vocabulary. They are
recorded in section 7 rather than buried: the success result is labelled `Live`
even when it came from a fixture, the word `authorised` is spelled two ways in
the same product, and `04-state-model.md` assigns a truth label to a screen that
has no events to derive one from.

---

## 1. The approved vocabulary

Eleven terms. Each one gets a one sentence definition, the exact evidence that
entitles the UI to display it, and the thing it is most often confused with.

The general rule these follow: **a term names a record, not a mood.** If you
cannot point at the field that produced the word, the word is not available.

### 1.1 Live

**Definition.** This record was produced by watching a real execution in this
deployment, as it happened.

**Entitling evidence.** `event.truth === 'live'` on the record being labelled.
At run level, `provenance === 'live'`, derived per `04-state-model.md:784-790`
from the events actually present.

**Where it may appear.** As the per beat chip on any beat whose source event
carries `truth: 'live'`. As the run level provenance chip once at least one
event exists.

**What it is not.** It is not "happening right now". A finished run's
`run_start` is still `Live`, because the label describes how the record was
made, not whether the clock is still running. The word for "right now" is the
state, and the state is shown separately. Conflating the two is the reason the
shipped page has a bug: `apps/web/src/features/live/client.ts:78-85` writes the
truth label into the slot named `.live-beat__status`, so a finished beat reads
`Live` and never reads `Done`. See section 7.2.

**Caveat that is currently unenforced.** `Live` on the success `tool_result` is
not entitled in an offline deployment. See section 1.6 and section 7.1.

### 1.2 Awaiting agent

**Definition.** FleetScope has admitted a run and is holding it open, and the
next action belongs to a human in another window.

**Entitling evidence.** `run !== null && !finished && events.length === 0 &&
capability.runDriver === 'mcp'`. All four conjuncts are load bearing: the
`runDriver` test is what distinguishes this from `running`, where a worker
process is genuinely executing.

**Where it may appear.** As the status word on the `awaiting_agent` screen, and
nowhere else.

**What it is not.** It is not "loading", "starting", "connecting", or
"initialising". Every one of those implies FleetScope is doing work. FleetScope
is doing none: it holds no model credential, it has spawned no process, and it
will wait indefinitely. The word has to carry that, which is why it names the
party being waited for.

### 1.3 Controlled Fault

**Definition.** This failure was injected by FleetScope on purpose, and it
announces itself as such on every record it produces.

**Entitling evidence.** `event.truth === 'controlled_fault'`. That value
originates at `apps/adk-worker/src/fleetscope_worker/tools.py:121-126`, where
the fault raises `ToolFailure(truth="controlled_fault")`, and it is copied onto
the `tool_result` and the `incident` at `mcp_server.py:231` and `:243`. It is
never inferred from the message text.

**Where it may appear.** On the `fault` beat chip, on the `controlled_fault`
screen, and as the only permitted use of orange in the palette.

**Capitalisation is fixed.** `Controlled Fault`, both words capitalised, in all
positions including mid sentence. It is a defined term in this system, not a
description, and `scripts/qa-live.ts:243` asserts the exact string. Lowercasing
it in prose would make the beat chip and the sentence look like two different
things.

**What it is not.** It is not `incident`. A run can reach `incident` with
`truth: 'live'` when a real upstream fails, and calling that a Controlled Fault
would claim FleetScope caused an outage it merely observed. This is the whole
reason `04-state-model.md` splits the two states.

### 1.4 Warden authorized

**Definition.** FleetScope's recovery policy examined the incident and permitted
exactly one retry.

**Entitling evidence.** An `intervention` event exists, authored by
`agent: 'warden'`, whose `payload.outcome === 'retry_once'`. The outcome field
is the entitlement; the presence of an intervention is not, because three of the
four possible outcomes are refusals (`recovery.py:25-26`).

**Where it may appear.** As the status word on the `warden_authorized` screen,
and in the `completed` sentence.

**Spelling.** `authorized`, with a `z`, everywhere. See section 7.3 for the
seven sites that currently disagree and why the `z` wins.

**What it is not.** It is not "the retry happened". Authorisation and execution
are two events at two sequences: the `intervention` at sequence 5 and the retry
`tool_call` at sequence 6. `04-state-model.md` splits them into two states for
exactly this reason, and the words must not merge what the model separated.

### 1.5 Retry executing

**Definition.** The authorised retry is in flight, running under the same
idempotency key as the attempt that failed.

**Entitling evidence.** A `tool_call` event exists at a sequence greater than
the authorising `intervention`, and no later `tool_result` has arrived.

**Where it may appear.** As the status word on the `recovering` screen.

**Why not "Recovering".** Because "recovering" is a claim about the outcome of
something still in progress, and the outcome is not known until `run_end`. The
repo already holds this line elsewhere: `scripts/browser-qa.ts:1128` lists
`recovered` among six claim words that the local session route may never print.
Applying the same standard here costs nothing and keeps one rule instead of two.
The internal state identifier stays `recovering`, because renaming a state in
`state.ts` is a larger change than this document is entitled to make, and
identifiers are not user visible.

**What it is not.** It is not "retrying" in the sense of a client library
retrying. This retry produced an incident record, a policy decision record, and
a second tool call at a known sequence. A transparent SDK retry produces none of
those, which is the argument `recovery.py:3-8` makes for owning the loop.

### 1.6 Runtime confirmed

**Definition.** The retried read reached the real upstream service and that
service returned the facts.

**Entitling evidence.** All three of:

1. a `tool_result` event with `payload.status === 'ok'`,
2. at a sequence greater than the authorising `intervention`,
3. and the deployment is not answering from a recorded fixture.

**Condition 3 is not satisfiable today, so this term must not ship yet.**
`RecordedReadOnlyHttp.get` returns `status=200` from a constant
(`transport.py:53-57`), and `mcp_server.py:278` then emits the `tool_result`
with `truth="live"` regardless. The web client cannot tell the difference,
because `GET /runs/capability` publishes `liveMode`, `durableLedger`,
`workerMode` and `runDriver` (`apps/api/src/routes/runs.ts:111-114`) and does
not publish the offline flag, even though the API reads it at
`apps/api/src/runs/worker.ts:89`.

This matters more than it looks, because `scripts/qa-live.ts:91` sets
`FLEETSCOPE_WORKER_OFFLINE: 'true'`. The repository's own 58 check proof runs
against a fixture, and the header of that file says so in plain words. So the
run the team points at as evidence is the exact run where "Runtime confirmed"
would be false.

**What is required before the term may be used.** One additional boolean on the
capability payload, and one derivation reading it. Until then, use `Result
returned`, defined in section 1.7, which claims only what the event proves.

**What it is not.** It is not "succeeded". `terminalResult: 'succeeded'` says
the run finished its script. Runtime confirmation says an external system agreed.
A run can be `succeeded` and unconfirmed, which is precisely the offline case.

### 1.7 Completed

**Definition.** The run reached its end and the terminal result was `succeeded`.

**Entitling evidence.** `finished && run.terminalResult === 'succeeded'`, where
`finished` is `run.endedAt !== null || page.complete === true`
(`state.ts:267`).

**Where it may appear.** As the status word on the `completed` screen. The
headline on that screen is `Recovered`, which is a stronger claim and is
entitled here and only here: at `run_end` with `succeeded`, the incident, the
authorisation and the second successful result are all present in the record.

**Supporting term this list omits.** There is no approved word for the `failed`
state. The vocabulary the brief supplied has none, and rather than quietly
invent one this document proposes `Ended without recovery` as the status word
and keeps `Not recovered` as the headline `04-state-model.md:599` already
assigns. Both are claims the events support: `run_end` exists,
`terminalResult !== 'succeeded'`, and no successful post retry `tool_result` is
present. Flagged in section 8 for the phase owner to accept or replace.

**What it is not.** It is not "fixed", "resolved", or "healed". See section 2.

### 1.8 Recorded evidence

**Definition.** What you are reading was replayed from stored events; no model,
tool or Warden call was made to produce this view.

**Entitling evidence.** Run level `provenance === 'recorded'`, derived from the
events per `04-state-model.md:784-790`.

**Where it may appear.** As the run level provenance line, which is a sentence
about the whole view.

**Relationship to the chip word `Recorded`.** `TRUTH_LABEL.recorded` is the bare
word `Recorded` and stays that way. The two are not redundant, they answer
different questions at different scopes: the chip sits next to a beat label and
answers "how was this one record produced", where a second noun would be noise;
the provenance line stands alone and answers "what am I looking at", where the
bare adjective is ambiguous. The rule that keeps this honest is one sentence:
**never print bare `Recorded` as a standalone statement about the run.** Inside
a chip, beside the thing it modifies, one word is enough.

Keeping the chip word unchanged also avoids editing
`apps/web/tests/live-state.test.ts:228-235`, which asserts the label map by
exact equality. That is a convenience rather than the reason, but a vocabulary
decision that costs zero test churn is worth preferring when it is also the
better reading.

**What it is not.** It is not `Historical`. See 1.9.

### 1.9 Historical

**Definition.** The reader has explicitly asked to re-read a finished run, and
the page is in that mode now.

**Entitling evidence.** `replaying === true && finished`, that is, the reader
pressed `#live-replay`.

**Where it may appear.** As the status word on the `historical_replay` screen.

**Why it is separate from `Recorded evidence`.** `Recorded evidence` is a
property of the data. `Historical` is a property of the reader's current mode.
They are independent: replaying a run that was originally live gives you a
`Historical` view of `Live` records. Collapsing them would make it impossible to
say that sentence, and that sentence is the one a sceptical reviewer most needs
to hear.

Note that `02-reference-matrix.md` records a supersession here: violet now means
Warden, so any surface that used violet for historical has to move.

### 1.10 Unknown

**Definition.** This runtime does not let FleetScope observe the thing being
asked about, which is different from the thing not happening and different again
from it failing.

**Entitling evidence.** For delegation, the absence of a `delegation` event on a
path that structurally cannot emit one. For a beat, `BeatStatus === 'unknown'`.
For a record, `truth === 'unknown'`.

**The one string that must survive verbatim.**

```text
Delegation: Unknown / not observable in this runtime
```

Asserted by substring at `scripts/qa-live.ts:198-200`, defined as
`DELEGATION_UNKNOWN` at `state.ts:117`, and reproduced in the static HTML at
`live.astro:48`. The prototype got this right and it is the one thing from it
carried forward untouched (`01-prototype-autopsy.md`, finding 11).

**What it is not.** It is not `0`, not "none", not an empty state, and not a
dash. Each of those reads as a measurement returning zero. The distinction this
word protects is the difference between "we looked and there were none" and "we
cannot look". Gemini CLI has no sub agents, so on the MCP path the second is
true and the first is unsayable.

**A trap the design must handle.** The scripted path emits a real `delegation`
event (`session.py:57`), so a recorded run shows delegation observed while a
live run cannot. The live run therefore shows *less*, and a reader comparing the
two could conclude the live path is worse instrumented. It is not; it is more
honest. `04-state-model.md:829-848` owns this asymmetry, and the words on any
screen where both appear must not let the comparison read as quality.

### 1.11 Unavailable

**Definition.** There is no FleetScope service reachable from this page, so
nothing can be started, replayed or claimed.

**Entitling evidence.** `capability === null`.

**Where it may appear.** As the status word on the `unavailable` screen, and as
`TRUTH_LABEL.unavailable`.

**What it is not.** It is not "offline", which in this codebase already means
"answering the allowlisted read from a fixture" and is a completely different
condition. It is not "error", which implies something broke; a page built with
no `PUBLIC_API_BASE_URL` is correctly configured for a static deployment and
nothing has gone wrong.

### 1.12 The words this list deliberately does not contain

`Blocked` is not a vocabulary term. It is the shipped page's word for two exact
policy strings (`state.ts:218-220`) which are rendered verbatim into
`#live-blocked`, and it never appears as a label of its own.

`Agent` appears only as a field name and a value copied from `event.agent`. It
is never used as a subject in a sentence about a decision, because the decisions
in this system are made by the Warden and by FleetScope's own code.

---

## 2. The forbidden vocabulary

Each entry gives the phrase, the specific false thing a reader would believe, the
source line that makes it false, and the sanctioned replacement. The pattern is
deliberate: a ban with no replacement gets ignored under deadline pressure.

There is precedent for enforcing this mechanically. `scripts/browser-qa.ts:1128`
already fails the build if the local session route prints any of `blocked`,
`recovered`, `activated`, `retried`, `authorized` or `confirmed`, and
`:1144` fails it for `warden`, `model armor` or `vendor activation`. Section 2.9
proposes extending that guard to the live surface, where the claims are larger.

### 2.1 "AI fixed it"

**Falsely implies.** That a model diagnosed a failure and repaired it.

**Why it is false here.** The model made one tool call. Everything after that
happened inside FleetScope before the model received any answer:
`mcp_server.py:198` opens a `while True`, the incident is detected at `:226`,
the policy decides at `:251`, the retry runs on the next pass, and
`handle_call` returns a single string at `:339`. The model was not consulted
between the failure and the retry and could not have been. It did not fix
anything; it was handed a result.

**Say instead.** `FleetScope retried once under policy.` Or, at run level, the
approved `completed` sentence, which names the Warden as the actor.

### 2.2 "reasoning chain"

**Falsely implies.** That FleetScope observed the model's intermediate thinking.

**Why it is false here.** The canonical event kinds are `run_start`,
`agent_start`, `delegation`, `tool_call`, `tool_result`, `incident`,
`intervention`, `agent_end`, `run_end`. None of them carries model output, and
none carries a token, a thought or a step. FleetScope observes the tool
boundary, which is the entire point of the architecture: it sees what the agent
*did*, not what it *decided*.

**Say instead.** `Canonical events` for the stream, `Causal path` for the five
beat summary. Both are accurate and both are already in use.

### 2.3 "autonomous success"

**Falsely implies.** That the system succeeded without human involvement.

**Why it is false here.** On the MCP path the run cannot advance at all until a
human types into their own Gemini or Antigravity session. That is the entire
content of the `awaiting_agent` state, which `04-state-model.md:393-399` calls
the screen where a judge spends the middle of the demo. A product whose middle
state is "waiting for a person" cannot describe its end state as autonomous.

There is a second problem with the word. "Autonomous" is the property the
governance layer exists to constrain. Claiming it as an achievement inverts what
FleetScope is for.

**Say instead.** `Recovered under policy`, or name the actors: the agent called,
the Warden authorised, FleetScope retried.

### 2.4 "gateway routed"

**Falsely implies.** That a delegation passed through an agent gateway and a
routing decision was recorded.

**Why it is false here.** `docs/architecture.md:108` states the invariant: a
`GatewayDecision` is required before a routed edge exists. On the MCP path there
is no delegation event at all, so there is no edge, so there is nothing for a
gateway to have routed. The term is real in this product, but it belongs to the
recorded fixture world (CASE-1042 and the cockpit surfaces), not to the live
run.

**Say instead.** On the live surface, nothing: the honest statement about
delegation is already fixed by section 1.10 and it is the only thing that may be
said. Do not substitute a weaker routing word.

### 2.5 "Model Armor protected"

**Falsely implies.** That prompt or response screening ran on this run.

**Why it is false here.** No screening step exists on the MCP path. There is no
event kind for it, no field, and no call. The protection this run actually
performed is a different and narrower thing: a closed allowlist checked before a
URL is built (`tools.py:113-116`), and a transport port with no write method
(`tools.py:53-56`).

**Say instead.** Describe what actually happened: `The target is checked against
a closed allowlist before any request is built.` It is a smaller claim and it is
provable, which makes it worth more.

**Additional risk.** `Model Armor` is a named vendor capability. Printing it
beside a `Live` chip asserts a vendor integration that is not present, which is
a stronger category of wrong than imprecision.

### 2.6 "provider outage"

**Falsely implies.** That an external service was down.

**Why it is false here.** In the demo the first read fails because FleetScope
injected the failure. `ControlledFault.describe()` returns `Controlled Fault:
injected transient tool unavailability (first 1 attempt(s))`, and
`faults.py:10-13` states the rule in the source: a controlled fault is never
anonymous, so a viewer can always tell "we broke this on purpose" from "this
broke". "Provider outage" is precisely the sentence that erases that
distinction.

There is a narrow case where an outage claim would be true: a real non 200
response raises `ToolFailure(truth="live")` at `tools.py:131-137`. Even then the
honest phrasing is the message itself, `upstream returned HTTP 503`, because
FleetScope observed a status code, not an outage.

**Say instead.** `Controlled Fault` when `truth === 'controlled_fault'`. The
verbatim reason string when `truth === 'live'`.

### 2.7 Any phrase implying the model chose to retry

This is the most important entry, because it is the easiest sentence to write by
accident and the one that most damages the product's argument.

**Forbidden constructions**, all of which make the model the subject of the
retry decision:

* "the agent tried again"
* "the agent recovered"
* "the model decided to retry"
* "the agent worked around the failure"
* "self healing", "self correcting", "resilient agent"
* any active voice sentence whose subject is the agent and whose verb is retry,
  recover, fix, resolve, handle or work around

**Why they are false here.** Three independent facts, any one of which is
sufficient:

1. The `intervention` event's author is `warden`, hardcoded at
   `mcp_server.py:253`. The event says who decided, and it is not the agent.
2. The decision is a pure function of declared metadata:
   `RecoveryPolicy.decide` keys on `incident.side_effect_class` and
   `incident.retryable` (`recovery.py:56-75`). No model output reaches it.
3. The agent never saw the failure. It made one call and received one string.

**Why it matters commercially, not just factually.** If the model chose to
retry, FleetScope observed a retry. If the policy chose, FleetScope caused the
retry, and the record proves a governance layer did something a bare runtime
would not have done. The second is the product. Writing the first gives it away
in a sentence.

**Say instead.** Keep the Warden or FleetScope as the grammatical subject:
`The Warden authorized one idempotent retry.` `FleetScope retried once under the
original idempotency key.` Passive voice is acceptable here where it names the
authority: `One retry was authorized under policy.`

### 2.8 Four more that the phase 1 and 2 audits found in use

Carried in because they were on the rejected artifacts and would otherwise
return.

| Phrase | Falsely implies | Say instead |
|---|---|---|
| `result awaiting runtime` styled as success (`prototype css:869`) | that a value which has not arrived is good | `Not yet` in the neutral colour, or omit the row |
| `historical` used as a fifth truth label (`prototype css:310`) | that there are five ways a record can be produced | `Recorded` for the record, `Historical` for the reading mode; sections 1.8 and 1.9 |
| latency figures such as `+124ms` | that FleetScope timed the call | nothing; `CanonicalEvent` has no latency field, so the number would be invented |
| a version string such as `warden-policy@1.2.0` under a `Live` chip | that the live run used that policy build | nothing on the live surface; the string exists only in a recorded fixture |

### 2.9 Making the ban executable

A prose ban decays. The cheapest durable enforcement, and the one consistent
with how this repo already works, is to extend the existing honesty guard.

`scripts/browser-qa.ts:1126-1133` builds a `claimWords` array and asserts no
evidenced card contains any of them. The same shape applies to `/live`, with a
different list, because `/live` is *entitled* to say `authorized` and
`recovered` once the events support it. The live list is the phrases that are
never entitled:

```text
'ai fixed', 'reasoning chain', 'autonomous', 'gateway', 'model armor',
'provider outage', 'self healing', 'self-healing', 'the agent retried',
'the agent recovered', 'the model decided'
```

Asserted against the full `innerText` of `#live-root` in every state the suite
already visits. It costs one check per viewport, it never needs updating when
copy is reworded, and it fails loudly the first time someone writes the sentence
in 2.7 by accident.

---

## 3. Every user-visible string in Story Mode

Twelve states, in the order `04-state-model.md` defines them. Each block gives
the complete set of strings for that screen. If a string is not listed here, it
does not appear in Story Mode.

### 3.0 How to read these blocks

Every block has the same seven slots, and the slots are the reading order that
`03-information-hierarchy.md` locked: truth, outcome, causal progress, incident
or result, action, topology, evidence. Evidence is empty in Story Mode by
design; it is the review's "inspector too technical for the default view", and
moving it to Expert Mode costs zero browser checks because Playwright's
`textContent()` reads detached nodes without a visibility check.

Notation used below:

* **[C]** marks a string asserted verbatim or by substring in `scripts/qa-live.ts`.
  Changing one of these is a coordinated change to the test in the same commit,
  never a silent edit.
* **(n)** after a sentence is its word count, against the caps in
  `03-information-hierarchy.md` section 2.1: outcome 20, incident or result 12,
  topology 8.
* A slot marked `none` renders nothing at all, not an empty box and not a dash.

### 3.0.1 The budget, measured

`03-information-hierarchy.md` sets 62 words above the fold for Story Mode. The
densest state is `completed`, because it is the only one carrying a result and a
complete causal path at the same time. Counted by the same method that document
used, whitespace separated tokens containing at least one alphanumeric
character:

```text
truth chip           Completed                                     1
outcome              the unconfirmed completed sentence           19
causal path          five labels plus five status words           16
result               succeeded                                     1
primary action       Run live recovery demo                        4
topology             the delegation line                           7
evidence             none in Story Mode                            0
                                                                 ---
                                                                  48
```

Fourteen words of headroom against the budget, and 224 fewer than the rejected
prototype's 272. The headroom is deliberate: sections 3.8 and 3.11 add a
rationale line in the refusal and failure paths, and those paths must fit
without a rewrite.

Two strings appear in all twelve blocks and are written once here:

* Primary or secondary button, always present in the DOM, text always exactly
  `Run live recovery demo` **[C]** (`qa-live.ts:193`). Its enabled state
  changes; its text never does.
* Topology line, unless a `delegation` event exists:
  `Delegation: Unknown / not observable in this runtime` (7) **[C]**
  (`qa-live.ts:198-200`).

### 3.1 `unavailable`

* **Status word** `Unavailable`
* **Headline** `No API`
* **Outcome** one of four, chosen by cause, never summarised into a generic
  message:
  * no base URL configured:
    `PUBLIC_API_BASE_URL is not set, so this page has no API to talk to.` (13)
    (shipped, `client.ts:163`)
  * configured but silent:
    `The FleetScope API did not answer, so nothing can be started.` (11)
    (shipped, `client.ts:194`)
  * the start request failed:
    `Starting the run failed: the API did not answer.` (9)
    (shipped, `client.ts:229`; see section 7.4, this string is currently
    written to a field nothing displays)
  * fallback:
    `The FleetScope API is not reachable, so no run can be started or replayed.` (14)
    (shipped, `state.ts:210`)
* **Causal progress** all five beats `Pending`. Not hidden: a reader who lands
  here should still see what the run *would* have been.
* **Incident or result** none
* **Action** `Run live recovery demo`, disabled
* **Topology** the delegation line
* **Evidence** none

### 3.2 `ready`

* **Status word** `Ready`
* **Headline** `Ready`
* **Outcome** `One button starts one fixed scenario. Nothing else can be run from
  here.` (13) **Rewritten by `10` D45.**
  * The shipped string and the first draft above both turn on **admits**, which
    is FleetScope's admission control verb (`admission.ts`). A stranger reads it
    as *confesses*, and neither sentence ever says what pressing the button will
    do. `ready` is where a judge with sixty seconds starts, so it is the worst
    screen in the pack to spend its only sentence on an internal term. The
    replacement says the same two things the original meant, one fixed scenario
    and no free input, in words that need nothing explained. `05` section 6
    already states the intended takeaway as "nothing has run, one button starts
    one fixed thing"; this is that sentence.
  * The leading `Ready.` still drops, because the headline carries it. Saying it
    twice in adjacent elements is the duplication the review flagged between the
    sidebar and the graph.
* **Causal progress** all five beats `Pending`
* **Incident or result** none
* **Action** `Run live recovery demo`, enabled, primary
* **Topology** the delegation line
* **Evidence** none

**Blocked variants.** When `capability.liveMode` or `capability.durableLedger`
is false, the outcome slot is replaced by one of two exact strings, never both
and never a summary of both (`state.ts:218-220`):

* `LIVE_MODE is off, so this deployment may replay evidence but not start a
  run.` (14)
* `The run ledger is not durable, so a run cannot be recorded and will not be
  started.` (17)

The CTA is disabled. It keeps its text, because a button that changes its label
when disabled makes the reader wonder what else changed.

### 3.3 `starting`

* **Status word** `Starting`
* **Headline** `Starting` **(rewritten by `10` D45; was `Admitting`)**
* **Outcome** `Starting a run against the fixed scenario.` (7) **(rewritten by
  `10` D45; the shipped string at `state.ts:249` reads `Admitting a run against
  the fixed scenario.`)**
  * `Admitting` was the same admission control verb promoted to a 36px headline,
    which makes it the focal point of the screen. `Starting` loses nothing a
    reader can perceive and is what the button they just pressed said.
* **Causal progress** all five `Pending`
* **Incident or result** none
* **Action** `Run live recovery demo`, disabled
* **Topology** the delegation line
* **Evidence** none

This is the only state whose motion is bound to a promise rather than a state
change, per `04-state-model.md` rule 2. It is typically visible for well under a
second, which is why it gets no copy of its own beyond the verb.

### 3.4 `awaiting_agent`

The screen a judge spends the middle of the demo on. Every string here is doing
work.

* **Status word** `Awaiting agent`
* **Headline** `Your turn`
* **Outcome** `FleetScope admitted the run and holds no model credential, so the
  next call is yours.` (15)
* **Body, two lines, both verbatim** **[C]** (`qa-live.ts:213-214`,
  `state.ts:119-122`):
  * `Your Gemini/Antigravity agent is ready to call FleetScope.`
  * `FleetScope is governing the tool and recovery policy.`
* **Primary action** a copyable monospace line, with the button labelled
  `Copy prompt`:

  ```text
  Use the fleetscope tool read_repository_metadata on google/adk-python
  ```

  Written as a prompt, not as a shell command with parentheses and quotes.
  There is no CLI syntax for this: MCP tools are invoked by the agent, not typed
  by the developer, so a command shaped string would be a fabricated fact of
  exactly the kind `01-prototype-autopsy.md` finding 8 catalogues. The three
  identifiers in it are real: server name `fleetscope` (`mcp_server.py:349`),
  tool name `read_repository_metadata` (`tools.py:89`), target
  `google/adk-python` (`scenario.py:48`).
* **Secondary action** none. There is no cancel endpoint, and a button that
  looks like one would misrepresent what happens to the run.
* **The dead end, stated in words** `If your agent never calls, this run stays
  open and a new one will be refused.` (16) Rendered as a quiet note, not an
  error. It is true (`admission.ts:29` refuses on `run_already_active`), the
  reader has no in page escape, and hiding that would be the page lying by
  omission.
* **Causal progress** all five `Pending`, including `Start`. `run_start` is
  emitted by the agent's call (`mcp_server.py:158-171`), not by admission, so
  claiming `Start` here would be a hopeful default.
* **Truth chip** **none.** This contradicts `04-state-model.md:417-418`, which
  assigns `Live`. See section 7.5: with zero events there is nothing to derive
  a label from, and the same document's own provenance rule returns `unknown`
  for an empty event list.
* **Evidence** the run id only, because a reader may need it to correlate with
  their own terminal.

### 3.5 `running`

* **Status word** `Live`
* **Headline** `Reading`
* **Outcome** two forms, chosen by whether a `tool_result` exists (both
  shipped, `state.ts:331-333`):
  * `The agent called the governed read.` (6)
  * `The governed read returned; the run is still under way.` (10)
* **Causal progress** `Start` done, `Governed read` done or active
* **Incident or result** none
* **Action** `Run live recovery demo`, disabled
* **Topology** the delegation line
* **Evidence** none

### 3.6 `controlled_fault`

* **Status word** `Controlled Fault`
* **Headline** `Failed on purpose`
* **Outcome** `The first read failed by design, so the recovery path is
  exercised rather than hoped for.` (16)
* **Incident line** the payload reason, verbatim:
  `Controlled Fault: injected transient tool unavailability (first 1
  attempt(s))` (9) **[C]** (`qa-live.ts:253` asserts it contains
  `Controlled Fault`)
* **Causal progress** `Start` and `Governed read` done, `Controlled Fault` done
  and labelled `Controlled Fault` **[C]** (`qa-live.ts:243` asserts the beat
  status text is exactly that string)
* **Action** `Run live recovery demo`, disabled
* **Topology** the delegation line
* **Evidence** none in Story Mode. The full explanation lives in section 4 and
  is reachable behind one disclosure, not printed inline.

### 3.7 `incident`

The uncontrolled sibling of 3.6. It exists so that a real failure can never be
dressed as a scripted one.

* **Status word** `Live`
* **Headline** `Read failed`
* **Outcome** `The read failed and FleetScope did not cause it.` (9)
* **Incident line** the payload reason verbatim, for example
  `upstream returned HTTP 503` (4) (`tools.py:133`)
* **Causal progress** `Controlled Fault` beat is **not** marked done. The beat
  is named for a specific kind of failure and this is not that kind. It stays
  `Pending` and the incident is reported in its own line.
* **Action** `Run live recovery demo`, disabled
* **Topology** the delegation line
* **Evidence** none

### 3.8 `warden_authorized`

* **Status word** `Warden authorized`
* **Headline** `Retry authorized`
* **Outcome** `The Warden allowed exactly one retry, because this read changes
  nothing and can be repeated safely.` (16)
* **Rationale line** **Story renders a plain sentence; the verbatim payload stays
  in Expert. Split by `10` D45.** Story: `This read can be repeated without
  changing anything, so one retry was within policy.` (14) Expert Decision
  Evidence renders the payload rationale verbatim (`recovery.py:72-75`),
  `idempotent_read is repeatable; one retry is within policy` **[C]**, into
  `#live-policy`, which `qa-live.ts:248-250` asserts is non empty and not the
  literal `none`. That node moves to Expert under D16 and keeps its raw value, so
  the check is untouched and the Story screen stops rendering a snake_case
  identifier as prose.
* **Causal progress** `Warden retry` done
* **Action** `Run live recovery demo`, disabled
* **Topology** the delegation line
* **Evidence** none

**The three refusal rationales.** `RecoveryPolicy.decide` has four outcomes and
three of them refuse. When `payload.outcome` starts with `refuse_`, the screen
does not advance to `warden_authorized`; it stays put and gains the refusal
line. All three strings are rendered verbatim, because each names the exact
governance property that blocked the retry:

* `'<class>' may change state; a retry is not safe` (`recovery.py:58-61`)
* `<tool> reported a permanent failure` (`recovery.py:63-66`)
* `already used 1 of 1 permitted retry(ies)` (`recovery.py:67-71`)

**Where each of the three renders. Amended by `10` D45.** All three stay verbatim
in Expert Decision Evidence, which is what "rendered verbatim" was defending. In
Story the `failed` sentence is written out, because the third string carries the
machine plural `retry(ies)` and `05` section 3.4 already removed
`(first 1 attempt(s))` from the incident line for being a machine detail. The
Story sentences, chosen by `payload.outcome`:

* `refuse_not_idempotent` -> `The Warden refused the retry, because this
  operation could change something and could not safely be repeated.` (18)
* `refuse_not_retryable` -> `The Warden refused the retry, because the tool
  reported a failure that trying again cannot fix.` (17)
* `refuse_budget_exhausted` -> `The Warden refused the retry, because this run
  had already used its one permitted retry.` (16)

Headline in all three cases: `Retry refused`. Outcome sentence:
`The Warden refused the retry, and the refusal is the evidence.` (11) That
sentence is not decoration. A refusal on non idempotent grounds is the best
governance evidence this system produces, and the shipped derivation currently
narrates all three as an authorised retry (`state.ts:308`), which
`04-state-model.md:85-118` treats as a defect.

### 3.9 `recovering`

* **Status word** `Retry executing`
* **Headline** `Retrying`
* **Outcome** `The retry is the same operation, not a second one, so the record
  counts it once.` (15) **Rewritten by `10` D45.**
  * `idempotency key` is the mechanism, not the meaning. The meaning is that
    nothing is being done twice, and that is what a judge needs in the two
    seconds this screen is on the MCP path. The key itself is a field on the
    intervention payload and renders in Expert Decision Evidence, where a reader
    who wants the mechanism will look.
* **Causal progress** `Warden retry` done, `Result` pending
* **Action** `Run live recovery demo`, disabled
* **Topology** the delegation line
* **Evidence** none

### 3.10 `completed`

* **Status word** `Completed`
* **Headline** `Recovered`
* **Outcome**, one of **three**, chosen first by which events exist and then by
  whether runtime confirmation is entitled per section 1.6. **The third branch
  was added by `10` D43 and it is the important one.**

  * **A recovery happened**, meaning an `incident` event exists, the latest
    `intervention` carries `payload.outcome === 'retry_once'`, and a `tool_call`
    follows it at a higher sequence:
    `The governed read failed once by design, the Warden authorized one
    idempotent retry, and the retry returned the result.` (19)
  * **A recovery happened and runtime confirmation is entitled**, which is no
    deployment today: the same sentence with `the authoritative result`. (20)
  * **No recovery happened**, meaning the run succeeded with no `incident`
    event: `The governed read returned on its first attempt. No fault occurred
    and the Warden was not called.` (17)

  The first two differ by one word, `authoritative`, and that word is the entire
  claim; dropping it costs the sentence nothing a reader will notice. **The
  third branch is a different kind of correction.** `04` section 3.10 gives
  `completed` one entry condition, `finished && terminalResult === 'succeeded'`,
  which requires neither an `incident` nor an `intervention`. The first two
  sentences assert both. That is the same defect `04` section 1.1 rejects the
  shipped `incident` sentence for and `04` section 1.2 rejects the shipped
  `recovering` sentence for, in a stronger form: those two mislabel an event that
  exists, this one asserts two events that may not exist at all.

  **The path is reachable, not theoretical.** `tools.py:119` reserves the attempt
  before the request, and `mcp_server.py:335-339` swallows a publish failure in a
  bare `except Exception` so the agent still gets an answer. With
  `FLEETSCOPE_ATTEMPT_LEDGER` set to a `FileAttemptStore`, wired at
  `worker.ts:92` and read at `mcp_server.py:309`, a first tool call whose publish
  fails leaves attempt 1 consumed on disk. The agent calls again, `reserve`
  returns 2, `ControlledFault.applies_to(2)` is false because `fault_attempts=1`
  (`scenario.py:52`), and the run emits only
  `run_start, tool_call, tool_result[ok], run_end[succeeded]`. `deriveLive`
  returns `completed`, and the unconditional sentence prints a twenty word claim
  that the read failed by design and the Warden authorized a retry, while
  `deriveBeats` correctly renders the Controlled Fault and Warden retry beats as
  `pending` on the same screen. The page contradicts itself, and the half a
  reader trusts is the sentence, not the pending dot.

  Nothing in the gate caught it: `12` H10 checks only for the word
  `authoritative`, and void condition 2 was neutralised because the pack had
  explicitly blessed the string as verbatim. `12` H16 is the check that catches
  it now.
* **Result line** `succeeded` (1) **[C]** (`qa-live.ts:257` asserts the trimmed
  text is exactly that)
* **Causal progress** all five done. This is the only state where the causal
  path stops being a progress indicator and becomes the evidence summary.
* **Primary action** `Replay evidence`. Promoted above the start button,
  because the run has just asserted something and the next question a sceptical
  reader has is prove it, not do it again.
* **Secondary action** `Run live recovery demo`, enabled, demoted to secondary
  weight
* **Topology** the delegation line, which now reads as a deliberate limit rather
  than a missing feature, because everything around it is complete
* **Evidence** none in Story Mode. The six field list the shipped page renders
  by default (`live.astro:51-58`) moves to Expert Mode.

### 3.11 `failed`

* **Status word** `Ended without recovery` (proposed; see section 1.7)
* **Headline** `Not recovered`
* **Outcome**, derived in this order of preference, so the most specific
  available cause wins:
  1. the policy rationale, when an `intervention` exists
  2. the incident reason, when an `incident` exists
  3. `The run ended as failed.` (5) (shipped shape, `state.ts:286`)
* **Result line** `failed` (1)
* **Causal progress** whatever is genuinely done. Beats not reached stay
  `Pending`, per `state.ts:159-161`: a finished run that never reached a beat
  did not reach it, and saying so is the same as saying it never happened.
* **Primary action** `Replay evidence`
* **Secondary action** `Run live recovery demo`
* **Topology** the delegation line
* **Evidence** none

### 3.12 `historical_replay`

* **Status word** `Historical`
* **Provenance line** `Recorded evidence` or `Live`, per section 1.8. This is
  the one screen where the distinction between the two is load bearing, because
  a replay of a live run is a historical view of live records and a reader has
  to be able to tell that from a replay of a fixture.
* **Headline** `Replaying`
* **Outcome** `Historical replay of <runId>.` followed by
  `Replay performs zero model, tool and Warden calls.` (8) **[C]**
  (`qa-live.ts:284-286` asserts the substring `zero model, tool and Warden
  calls`; `state.ts:124`)
* **Causal progress** exactly as it was when the run ended. Replay adds no
  events, and `qa-live.ts:288-293` asserts the cursor does not move.
* **Primary action** `Back to the run`, targeting the new `#live-replay-back`
  handle from `04-state-model.md` section 8.3. Without it, replay is a one way
  door: `client.ts:239` never clears the flag, so the CTA is lost until reload.
* **Secondary action** `Run live recovery demo`
* **Topology** the delegation line, or, when the replayed run is a scripted one
  that emitted a `delegation` event, `Delegation: observed at event <n>`
  (`state.ts:226`)
* **Evidence** none

---

## 4. The Controlled Fault explanation

The hard part of this piece of copy is that it has two jobs which pull against
each other. It has to say the failure was deliberate, or the demo is dishonest.
And it has to not let the reader conclude that the recovery was therefore also
staged, which is the natural inference and would make the whole product look
like a puppet show.

The resolution is a distinction the source already draws and the copy has not
been using: **the fault is scripted, the decision is not.** The fault is a
constant in server source (`scenario.py:52`, `fault_attempts=1`). The decision
is a pure function evaluated at runtime over metadata the tool declares about
itself (`recovery.py:56-75`), and the same function refuses three ways. A reader
who understands that the policy would have said no to a different tool
understands that it said yes to this one for a reason.

### 4.1 The three lengths

**Chip, 2 words.** `Controlled Fault`. Nothing else fits and nothing else is
needed beside a labelled beat.

**Inline, 9 words.** The payload string, verbatim:
`Controlled Fault: injected transient tool unavailability (first 1 attempt(s))`

**Disclosure, 112 words.** One reveal, closed by default, on the
`controlled_fault` and `completed` screens:

> The first read fails because FleetScope makes it fail. A recovery demo that
> waits for a real outage is not a demo anyone can record, so the failure is
> injected, bounded to the first attempt, and labelled Controlled Fault on every
> record it produces.
>
> What happens next is not scripted. The Warden reads the side effect class the
> tool declares about itself, finds an idempotent read, and permits exactly one
> retry under the original idempotency key. The same policy refuses a tool that
> writes, refuses a permanent failure, and refuses a second retry. The failure is
> staged so that the decision can be watched. The decision is the part that is
> real.

### 4.2 What this copy deliberately does not do

* It does not apologise for the fault or hedge it with "simulated" or "for
  demonstration purposes". `faults.py:10-13` states the rule the system already
  follows: a controlled fault is never anonymous. Copy that sounds embarrassed
  about it undermines a design decision that was correct.
* It does not describe the retry as easy, automatic or instant. Three of the
  four policy outcomes are refusals; describing the one that succeeds as
  automatic misrepresents a three quarters chance of no.
* It does not name a percentage, a latency, or a number of retries beyond the
  one the scenario fixes. Every number in that sentence would have to come from
  a field, and only `max_retries` exists.
* It never uses the word "recovered" before `run_end`. See section 1.5.

---

## 5. The default incident explanation, in four sentences

The review asked for four sentences answering four questions. Each sentence
below names the field that entitles it, so a future edit cannot quietly add a
claim.

This block is the default expansion of the incident, shown on `completed` behind
one disclosure and on `controlled_fault` inline. It replaces the six field
definition list at `live.astro:51-58`, which is the thing the review called an
inspector in the default view.

### 5.1 The four sentences

**1. What failed.** (10)

> The governed read failed on its first attempt against `google/adk-python`.

Entitled by: a `tool_result` with `payload.status === 'failed'`, and
`payload.attempt` on the preceding `tool_call`. The target comes from
`payload.target`, not from a constant in the web app, so a scenario change
cannot make this sentence stale.

**2. Why FleetScope was allowed to act.** (18)

> The tool declares itself an idempotent read, and the Warden's policy permits
> exactly one retry for that class.

Entitled by: `incident.payload.sideEffectClass === 'idempotent_read'` and
`RETRYABLE_SIDE_EFFECTS` containing it (`recovery.py:23`). Note the phrasing:
the tool *declares*, the policy *permits*. Neither verb belongs to the model,
and the sentence would be false in both directions if it did.

**3. What it did.** (20, exactly at the outcome cap, though it never occupies
the outcome slot)

> FleetScope retried once under the original idempotency key, so the retry
> continued one logical operation instead of starting a second.

Entitled by: the `intervention` payload's `idempotencyKey` matching the one on
the first `tool_call` (`mcp_server.py:206` and `:259`). This is the sentence
that distinguishes a governed retry from a duplicate request, and the matching
key is the only evidence for it, so the sentence must not be written unless the
two are compared.

**4. What the runtime confirmed.** Two forms, and the choice is not cosmetic.

*When runtime confirmation is entitled per section 1.6:* (16)

> The upstream returned the repository facts on the second attempt, and the run
> ended as succeeded.

*When it is not, which is every deployment today:* (18)

> The second attempt returned the repository facts from this deployment's
> recorded fixture, and the run ended as succeeded.

Entitled by: a `tool_result` with `payload.status === 'ok'` at a sequence above
the intervention, plus the capability flag that section 1.6 says does not exist
yet. Until that flag exists, the second form is the only one that may be
rendered, because the first would be false in the offline configuration the
repository's own QA harness uses.

### 5.2 Why four sentences and not a list

The rejected prototype rendered evidence as a five column log line
(`01-prototype-autopsy.md`, crit 3) and the review called the result a SOC
dashboard. A list of key value pairs invites the reader to scan for the
interesting one, which is the correct behaviour for a monitoring tool and the
wrong one for an argument. Four sentences in causal order can only be read in
causal order, and the causal order is the product's claim.

The four also map exactly onto the four questions a sceptical reviewer asks in
sequence, which is why the review specified them: what broke, who said you could
touch it, what did you do, and did it actually work.

---

## 6. Accessibility strings

### 6.1 The rule, and why it is stricter than "do not use colour alone"

`client.ts:77` already carries the right instinct in a comment: *never colour
alone: the status word is always present as text.* This section makes it a
rule with two halves, because the shipped page satisfies the first half and
fails the second.

1. Every state carried by colour also has a word on screen.
2. That word is in the element's **accessible name**, in a form that is
   unambiguous when read out of context.

Half two matters because a screen reader user hears `Controlled Fault` with no
indication of what kind of thing that is. A sighted reader gets the answer from
position and colour. The fix is a short visually hidden prefix, not a longer
visible label, so the visual density budget in `03-information-hierarchy.md` is
untouched.

The mechanism is `.fs-visually-hidden` (`global.css:850-867`), which is already
in the stylesheet and already documents why it needs a positioned ancestor.

### 6.2 The one live region

Exactly one, and this is a constraint rather than a preference.

* **The region** `#live-sentence`, `role="status"`, `aria-live="polite"`, plus
  `aria-atomic="true"` which the shipped page lacks. `setText` replaces
  `textContent` wholesale (`client.ts:55-58`), so without `aria-atomic` some
  assistive technologies announce only the changed text node and a reader hears
  a fragment of a sentence.
* **`#live-beats` must never be a live region.** `client.ts:63` clears the list
  with `innerHTML = ''` and rebuilds all five items, and `client.ts:248` runs
  that every 400ms for the life of the page. A live region there would announce
  five beats two and a half times a second, forever, including on a finished
  run. This is the accessibility face of the same defect that
  `04-state-model.md` addresses for motion: the client repaints continuously, so
  anything keyed to a render fires continuously.
* **`#live-blocked` should not be a second live region.** Section 3.2 puts the
  blocked string in the outcome slot, replacing the sentence rather than sitting
  beside it, so there is nothing for a second region to announce. Its shipped
  `role="status"` should be removed when that change lands, or a blocked
  deployment double announces.
* **State changes are announced through the sentence and nothing else.** Twelve
  states, one voice. A reader who hears `The Warden allowed exactly one retry,
  because this read changes nothing and can be repeated safely.` has been told
  the state, the reason and the outcome in one utterance.

### 6.3 The strings, by signal

| Signal | Carried visually by | Element | Accessible text |
|---|---|---|---|
| Run truth or provenance | tinted chip, no cyan | `#live-provenance` | `Source: live` or `Source: recorded` (`10` D42). Absent entirely while `events.length === 0`, except `unavailable` (`10` C1, D40) |
| Beat truth, live | **nothing visible** | `.live-beat__status`, visually hidden | `Live` |
| Beat truth, controlled fault | **orange on the step label only**, never on the marker | `.live-beat__status`, visually hidden | `Controlled Fault` |
| Beat truth, recorded | nothing visible | `.live-beat__status`, visually hidden | `Recorded` |
| Beat truth, unknown | nothing visible | `.live-beat__status`, visually hidden | `Unknown` |
| Beat done | marker `●` | second visually hidden span; `data-status` | `done` |
| Beat pending | marker `○` | second visually hidden span; `data-status` | `pending` |
| Beat decided, not performed | marker `◇` | second visually hidden span; `data-status` | `refused` |
| Beat not observable | marker `○`, no fill | second visually hidden span; `data-status` | `not observable in this runtime` |
| Warden authorship | violet | the rationale block | `Warden decision: ` before the rationale |
| CTA available | blue border | `#live-start` | native `disabled` state, plus `aria-describedby` |
| Position in the run | ordinal chip | `.live-beat__seq` | `event 3` (already text, `client.ts:91`) |

**Corrected by `10` C4, C5, C31 and `11` phase 2. Four things changed in that
table and each was a rule this document proposed and another document overruled.**
There is no `.live-beat__truth`: C4 keeps the shipped `.live-beat__status`
carrying the truth word, because `qa-live.ts:240-245` asserts that element trims
to exactly `Controlled Fault` and it is the only external check on the most
important word on the page. There are no visible per beat truth chips: C5 makes
those an Expert Mode surface, and D14 renders Story's path as labels and shape
markers. Orange applies only to the element whose text is the words
`Controlled Fault`, not to the marker, because an `aria-hidden` glyph has an
empty accessible name and would fail `12` V3 (C31). And the status word lives in
a second visually hidden span, so a done beat announces `done` and not only
`Live`, which is what `12` A3 requires.

Two notes on that table.

**The truth word and the status word are two different slots, and the shipped
page has one.** `client.ts:78-85` puts the truth label into `.live-beat__status`,
so a finished beat announces `Live` and never announces `done`. This section
proposed adding a `.live-beat__truth` sibling and moving the real status into the
existing class. **`10` C4 rejected that** and ruled the other way: the shipped
element keeps the truth word, and a second visually hidden span carries the
status word. The reason is `qa-live.ts:240-245`, which asserts that
`[data-beat="fault"] .live-beat__status` trims to exactly `Controlled Fault`.
That assertion is shipped, correct about what the element contains today, and the
only external check on the most important word on the page; this section's
version is semantically cleaner, buys nothing a reader or a screen reader can
perceive, and costs an edit to that one check. The class name is wrong and it
stays wrong, recorded as known rather than renamed.

**Orange is reserved.** `02-reference-matrix.md` assigns orange to Controlled
Fault only. In forced colors mode the hue is discarded entirely, which is
exactly why the word must be present rather than implied. The stylesheet has no
`forced-colors` block today; the rejected prototype did, and
`01-prototype-autopsy.md` lists it as carry forward.

### 6.4 Composed accessible names, written out

Beat item, using visually hidden spans rather than `aria-label`, because
`aria-label` on the `li` replaces the whole subtree name and would silently drop
the sequence text the moment someone adds a field:

**Corrected to `10` C4's resolution.** The version this section first drew used a
`.live-beat__truth` sibling, which C4 rejected; this is the markup to build.

```html
<li class="live-beat" data-beat="fault" data-status="done">
  <!-- visible: the label. orange rides here, and only here (10 C31) -->
  <span class="live-beat__label">Controlled Fault</span>
  <!-- visible: the marker. aria-hidden, neutral ink, never orange -->
  <span class="live-beat__marker" aria-hidden="true">●</span>
  <!-- hidden: the status word. the second span 11 phase 2 specifies -->
  <span class="fs-visually-hidden">, done, produced by </span>
  <!-- hidden: the shipped element, still carrying the truth word.
       qa-live.ts:240-245 reads exactly this node. do not rename it. -->
  <span class="live-beat__status fs-visually-hidden">Controlled Fault</span>
  <span class="fs-visually-hidden">, at </span>
  <span class="live-beat__seq">event 3</span>
</li>
```

Read aloud: *Controlled Fault, done, produced by Controlled Fault, at event 3.*
The repetition is not elegant and it is correct: the beat is named for the kind
of failure, and the record was produced by that kind of failure. A reader who
hears it twice learns that the label and the truth agree, which is precisely the
thing that would be false if a real outage had been mislabelled.

List container:

```html
<ol id="live-beats" class="live__beats" aria-label="Causal path">
```

Changed from the shipped `Story beats`. Nothing asserts the shipped value, and
`Causal path` is the term `03-information-hierarchy.md` uses for reading order
item 3, so the same thing stops having two names.

Delegation line, unchanged in text, because it is contractual, but given a
prefix for context:

```html
<p id="live-delegation" data-observed="false">
  <span class="fs-visually-hidden">Agent topology. </span>
  Delegation: Unknown / not observable in this runtime
</p>
```

Disabled CTA, so the reason is announced with the button rather than left to the
reader to find:

```html
<button id="live-start" disabled aria-describedby="live-sentence">
  Run live recovery demo
</button>
```

`aria-describedby` points at the single live region, which in every disabled
state already contains the reason: `Admitting a run against the fixed scenario.`,
`LIVE_MODE is off, ...`, `The retry is running ...`. No new string is needed for
any of the nine states where the CTA is disabled, which is the argument for
having one voice.

Copy button on `awaiting_agent`, where the accessible name must say what will be
copied, because `Copy prompt` alone is meaningless without seeing the mono line:

```html
<button id="live-copy-prompt">
  Copy prompt
  <span class="fs-visually-hidden">
    : Use the fleetscope tool read_repository_metadata on google/adk-python
  </span>
</button>
<p id="live-copy-status" role="status" aria-live="polite" class="fs-visually-hidden"></p>
```

On success `#live-copy-status` receives `Prompt copied.` and is cleared after
the announcement. It is the one permitted second live region, because it
announces a user initiated result rather than a state change, and it is empty
at every other moment so it can never compete with the sentence.

### 6.5 Absent values

`components/UnknownOr.astro` already encodes the rule and its default
`unknownLabel` is `Not recorded`. Story Mode uses it for every absent value and
never renders `0`, `-`, `none` or an empty cell. The component's own comment
states the reason: an agent with no recorded usage has not used zero tokens, it
has an unmeasured cost.

The shipped `/live` page violates this in four places with the literals `not yet
observed`, `none`, `none` and `not yet` (`live.astro:52-55`). Those fields move
to Expert Mode under section 3, so the violation is resolved by relocation
rather than by rewording.

### 6.6 What must not be added

* No `aria-live="assertive"` anywhere. Nothing on this page is an emergency, and
  the Controlled Fault is the state most likely to tempt someone into using it.
* No `role="alert"` on the incident. The incident is expected.
* No `aria-busy` on `awaiting_agent`. FleetScope is not busy; a human is.
* No decorative `aria-label` on the graph in Expert Mode that summarises the run
  in prose. The graph shows the same events the causal path shows, and a
  second, differently worded summary is a second source of truth.

---

## 7. Findings that this vocabulary forces into the open

These are not proposals. They are places where the shipped product already says
something the events do not support, found while looking for the field that
entitles each word. Each one is recorded with its fix and its blast radius so
the phase owner can schedule rather than rediscover.

### 7.1 The success result is labelled `Live` even when it came from a fixture

`RecordedReadOnlyHttp.get` returns `status=200` from a module constant and
performs no network call (`transport.py:53-57`). `mcp_server.py:275-280` then
emits the success `tool_result` with `truth="live"`, unconditionally. Nothing
downstream can tell the difference, because `GET /runs/capability` does not
publish the offline flag (`apps/api/src/routes/runs.ts:111-114`) even though the
API reads it (`apps/api/src/runs/worker.ts:89`).

The sharp edge: `scripts/qa-live.ts:91` sets `FLEETSCOPE_WORKER_OFFLINE: 'true'`
and its own header says the read is answered from a recorded fixture. So the run
this repository points at as its 58 check proof is the exact run in which a
`Live` chip sits on a fixture answer.

**Fix, smallest first.**

1. Publish the flag on the capability payload.
2. Gate the word `authoritative` in the `completed` sentence on it
   (section 3.10). No browser check asserts `#live-sentence`, verified across
   `qa-live.ts:178-297`, so this is a free change today and will not be free
   once someone adds one.
3. Longer term, stop hardcoding `truth="live"` on the success path and derive it
   from the transport, which is the same discipline `ToolFailure` already
   applies on the failure path.

Until step 1 lands, `Runtime confirmed` may not be displayed at all.

### 7.2 The beat status slot contains a truth label, not a status

`client.ts:78-85` writes `TRUTH_LABEL[beat.truth]` into `.live-beat__status`, so
a done beat reads `Live` and the word `Done` is unreachable. Reading order items
1 and 3 from `03-information-hierarchy.md`, truth and causal progress, are
collapsed into one slot.

`qa-live.ts:240-245` asserts the fault beat's `.live-beat__status` text is
exactly `Controlled Fault`, so the conflation is currently contractual.

**Fix.** Add a `.live-beat__truth` sibling for the truth label, leave
`.live-beat__status` carrying the real status word, and update the assertion at
`qa-live.ts:240` to read the new class in the same commit. Never rename the
existing class; the browser suite is the only thing standing between this page
and a hopeful default.

### 7.3 The product spells `authorised` two ways

Seven sites use the `s` spelling; the rest of the repository uses `z` by 116 to
14. Four of the seven are user visible or agent visible:

| Site | Visible to |
|---|---|
| `apps/web/src/features/live/state.ts:285` | the `completed` sentence, the product's whole argument |
| `apps/web/src/features/live/state.ts:313` | the `recovering` sentence |
| `apps/web/src/pages/live.astro:22` | the page lede |
| `apps/adk-worker/src/fleetscope_worker/mcp_server.py:359` | the MCP tool description the agent reads |

The remaining three are a test name and two code comments
(`live-state.test.ts:130`, `dependencies.ts:56`, `runs.ts:62`).

**Resolution: `z` everywhere.** Three reasons, in order of weight. The state
identifier phase 4 introduces is `warden_authorized`, and an identifier that
disagrees with the string it renders is a bug waiting to be typed. The repository
is already 89 percent `z`. And `scripts/browser-qa.ts:1128` spells the claim word
`authorized`, so the honesty guard and the copy would otherwise disagree about
what word to look for.

Note that `04-state-model.md:515` gives the `warden_authorized` headline as
`Retry authorised`. Section 3.8 of this document supersedes it with
`Retry authorized`.

No browser check asserts either spelling; verified by grep across
`scripts/qa-live.ts` and `scripts/browser-qa.ts`.

### 7.4 A failed start writes a message nothing displays

`client.ts:229` sets `session.unavailableReason` when the POST throws, but
`deriveLive` reads that field only on the `capability === null` branch
(`state.ts:204-214`). After a failed start the capability is populated, because
it was fetched successfully a moment earlier, so the branch is not taken and the
string is never rendered. The reader sees the page return to `ready` with no
explanation.

The string itself is fine and section 3.1 keeps it verbatim. It needs a slot:
`04-state-model.md` section 8.3 already proposes `#live-start-error`.

### 7.5 `awaiting_agent` is assigned a truth label it cannot derive

`04-state-model.md:417-418` gives that screen `Truth label: Live`, reasoning that
the run is admitted in a live ledger. The same document's provenance rule at
`:784-790` returns `unknown` for an empty event list, and `awaiting_agent` is
defined by `events.length === 0`.

Section 3.4 resolves this by showing **no truth chip at all** on that screen.
The status word `Awaiting agent` already tells the reader everything the state
supports, and a truth label with no record to label is the same class of error
as the hardcoded `data-state="ready"` at `live.astro:25` that
`00-current-state-audit.md` found: a hopeful default that the page's own doc
comment forbids.

Flagged for the phase 4 owner to accept or overrule, since it is their document.

---

## 8. Contract impact and open questions

### 8.1 What changes, and what it costs

| Change | Files | Test impact |
|---|---|---|
| Drop the leading `Ready.` from the ready sentence | `state.ts:261` | none; no check asserts `#live-sentence` |
| `authorised` becomes `authorized` at four visible sites | `state.ts:285,313`, `live.astro:22`, `mcp_server.py:359` | none; verified by grep |
| `completed` sentence drops `authoritative` until the capability flag exists | `state.ts:285` | none |
| Add `.live-beat__truth`, keep `.live-beat__status` | `client.ts:75-86` | one edit at `qa-live.ts:240` in the same commit |
| `aria-label` becomes `Causal path` | `live.astro:45` | none |
| `aria-atomic="true"` on the sentence | `live.astro:37` | none |
| Remove `role="status"` from `#live-blocked` | `live.astro:35` | none |
| Six field list moves to Expert Mode | `live.astro:51-58` | none; `textContent()` reads detached nodes |
| New live surface honesty guard | `scripts/qa-live.ts` | adds one check per viewport, 58 becomes 60 |
| `TRUTH_LABEL` | unchanged | `live-state.test.ts:228-235` unchanged |

Exactly one row edits an existing assertion, and one row adds new ones. The
other eight cost nothing. That is not luck; it is the consequence of the browser
suite asserting behaviour and identifiers rather than prose, which is worth
preserving as copy continues to move.

### 8.2 Open questions for the phase owner

1. **`failed` has no approved status word.** Section 1.7 proposes
   `Ended without recovery`. The supplied vocabulary has no entry, and inventing
   one silently is exactly the habit this document exists to stop.
2. **Does `Runtime confirmed` ship in this phase or wait for the capability
   flag?** Section 1.6 says wait. If the flag is out of scope, the term should be
   struck from the approved list rather than shipped unentitled, because an
   approved term that nothing can display will eventually be displayed anyway.
3. **Section 7.5 contradicts `04-state-model.md` section 3.4.** One of the two
   documents has to move.
4. **Expert Mode copy is not written here.** This document covers Story Mode, the
   Controlled Fault explanation and the accessibility layer. Expert Mode's
   terminal evidence, canonical timeline and graph labels need the same
   entitlement treatment, and the vocabulary in section 1 is the input to it, not
   a substitute for it.
5. **Is the `awaiting_agent` prompt line the right artifact to copy?** Section
   3.4 chose a natural language prompt over a fabricated command syntax. If the
   team would rather copy the run id, or an MCP client configuration snippet, the
   reasoning transfers: copy something that exists, never something shaped like a
   command that no one can type.
