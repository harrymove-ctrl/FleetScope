# CASE-1042 Guided Evidence Tour — plan and delivery

Status: delivered, except the five-person comprehension test

Last updated: 2026-08-29

Route: `/cockpit/CASE-1042`. `/viewer` is untouched.

## Why

The Golden Path works: four cards, six path steps, each seeking a canonical
event. But a menu is not a narrative. A first-time reader still has to guess
where to start, and a judge with ninety seconds does not have guessing time.

The tour answers "what happened here" in the order it happened, one stop at a
time, and hands over the exact evidence on request.

## Information architecture corrections shipped first

### The Proof Path now tells the truth about time

It was ordered by narrative appeal — screening first, because it is the most
striking control:

```text
Screen → Remember → Delegate → Recover → Approve → Activate
```

The recording runs:

```text
Delegate (3) → Remember (10) → Screen (15) → Recover (35) → Approve (44) → Activate (52)
```

The path is drawn as a connected left-to-right sequence, and a connector reads
as "this happened, then this". The display order now matches the recording, and
a test asserts the anchors are strictly increasing so it cannot drift back.

The active-step rule stays chronological — greatest anchor at or before the
cursor — even though display and chronology now agree. That rule is what keeps
them from silently diverging if anyone re-orders for storytelling again.

### Expert-only panels moved behind Expert Mode

`Incidents` and `Warden interventions` rendered in Story Mode. They made the
first impression long and technical, blurred the Story/Expert boundary, and left
"Open Expert Mode" with nothing to reveal. Both now sit behind
`[data-expert-surface]`.

### The recorded-mode label

`● Recorded CASE-1042 evidence — nothing is executing`, first thing in the Story
card. A screenshot of this page must not be mistakable for a live system, so the
label states both what it is and what it is not.

## The tour

Six stops, built FROM the Proof Path so the two cannot disagree about where a
step lives. A step with no anchor is dropped rather than given a plausible
neighbour: walking a reader to the wrong event under a confident heading is
worse than a shorter tour.

| Step | Heading | Event |
|---|---|---|
| Delegate | A logistics specialist joined the case | 3 · `evt-0004` |
| Remember | The negotiated terms survived the session boundary | 10 · `evt-0011` |
| Screen | Unsafe vendor input was stopped before use | 15 · `evt-0016` |
| Recover | A bounded retry recovered the logistics check | 35 · `evt-0036` |
| Approve | The externally visible action waited for a person | 44 · `evt-0045` |
| Activate | The vendor was activated under that approval | 52 · `evt-0053` |

Each stop carries what happened, why it matters, a status word paired with an
icon (never colour alone), the canonical event number, and controls: Back, Next,
View evidence, Open in Expert Mode, Close tour.

**It never autoplays.** The reader presses Next.

## State

One cursor. The tour drives the same canonical Case Cursor as the cards and the
path; a second playhead would be a second answer to "where are we".

```text
/cockpit/CASE-1042?mode=story&event=35&tour=recover
```

- `tour` names the active step. An unrecognised value starts no tour — guessing
  would drop a reader mid-narrative from a link that meant nothing.
- Starting seeks the first step. Next and Back seek the destination's canonical
  sequence and **push** history, so browser Back walks the tour backwards.
- Opening Expert Mode preserves both `event` and `tour`.
- Closing ends the narration and does **not** move the cursor: the reader
  stopped reading, they did not ask to go somewhere else.
- Reload restores the same step.

## Accessibility

Native buttons throughout. Focus moves to the step heading on each change, not
to the button pressed — Next and Back become disabled at the ends, and focus on
a disabled control is lost to the document. One polite live region announces
`Step N of 6: <heading>. Event N of 60.` Reduced motion switches state
immediately.

## Tests

57 adapter tests, 490 browser checks at 1440×900, 1280×720, 1180×800 and under
`prefers-reduced-motion: reduce`.

### The six intentional breaks, each observed failing

| Break | Named failure |
|---|---|
| Screen before Delegate again | `the Proof Path is displayed in chronological order` — `15 → 10 → 3 → 35 → 44 → 52` |
| Next advances by DOM order, not anchors | `Next reaches remember at canonical sequence 10` — landed on event 4 |
| Open the first evidence id, not the step's event | `View evidence opens the event this step claims` — drawer showed `evt-0001` |
| Reset the cursor when Expert Mode opens | `Expert Mode preserves the cursor and the tour step` — event became 59 |
| Collapse `event=0` and a missing `event` | `a missing event parameter is not read as sequence 0` — opened on `event=0` |
| Remove reduced-motion behaviour | `step transitions are switched off` — `0.4s` |

Break 3 initially did **not** fail. The assertion searched the whole page for
the event id, and the tour step prints that id itself, so it passed no matter
what the drawer opened. Both drawer assertions are now scoped to
`[data-evidence-drawer]`.

## Limitations

- Canonical `agentInstanceId` to renderer-node mapping is still not started, so
  a tour step does not select a graph node. Deliberately deferred.
- The tour's copy is hand-written for CASE-1042. A second Case would need its
  own copy or a generic fallback; nothing generalises yet.
- Five-person comprehension testing has NOT been run. Until it does, the claim
  is that the page is accurate, not that it is understood.
