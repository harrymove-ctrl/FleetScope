# Current state audit: what the FleetScope UI actually is today

Audited at `cfdcca7` on branch `feat/agent-viewer-cli`, with the worktree dirty.
Everything below was read from source, not from memory of an earlier plan.

> **Every `global.css` line number in this document is a dirty worktree
> coordinate, not a HEAD coordinate.** Recorded by `10` C39. The in flight
> "Workstation synthesis" work inserts 327 lines at `global.css:107` and a
> further 19 across three hunks between HEAD lines 965 and 1003, so a citation
> at or above HEAD line 107 is off by **+327** and one below HEAD line 1003 is
> off by **+344**. There is no single offset. `11` tells the implementer to
> confirm whether that work "has landed or been reverted" before starting, and
> `global.css` is on the forbidden edit list, so these citations are read-only
> navigation done with coordinates that resolve to the wrong rules in the
> reverted case. **Navigate by selector.** The selectors this pack relies on, at
> HEAD: `.fs-status` 334, `.fs-mode` 386, `.fs-button:hover` 606,
> `.fs-button[data-variant='primary']` 615, `.fs-cockpit-layout` 1092,
> `.story__card-state[data-state='evidenced']` 1684,
> `html[data-cockpit-mode='story'] [data-expert-surface]` 1764. The `:root`
> block is byte identical in both, at lines 12 to 66.

## 0. Read this first: two versions of the UI exist right now

The worktree contains uncommitted work from other agents, and some of it is
directly relevant to this redesign. The audit therefore distinguishes what is
**shipped** (present at `HEAD`) from what is **in flight** (present only in the
dirty worktree). A redesign that treats the in-flight state as the baseline
will inherit decisions the review already rejected.

| Fact | At `HEAD` | In the worktree |
| --- | --- | --- |
| `apps/web/src/styles/global.css` | 1888 lines | 2232 lines |
| `apps/web/src/pages/dashboard.astro` | does not exist | 540 lines, untracked |
| `apps/web/src/pages/index.astro` | does not exist | 3 lines, redirects to `/dashboard` |
| `apps/web/src/pages/viewer.astro` | 263 lines | 1348 lines (`+1085`) |
| Nav entry point | `/cases` | `/dashboard` |

The 344 new lines of `global.css` are almost entirely one block,
`global.css:110-436`, headed "Workstation synthesis". That block introduces a
cream panel surface, pastel agent avatars, macOS traffic-light dots and an
entrance animation. Those are five of the six items on the "never" list of the
locked direction. Section 2.3 details it. Nothing in this audit edits it.

## 1. Every existing route and what it is for

Astro file-based routing, `apps/web/src/pages/`. Ten route files today, eight
at `HEAD`.

| Route | File | Purpose | Layout width |
| --- | --- | --- | --- |
| `/` | `pages/index.astro:2` | Server redirect to `/dashboard`. Untracked. | n/a |
| `/dashboard` | `pages/dashboard.astro` | Local developer entry point: onboarding checklist, a copyable `fleetscope` command, a sessions list and a Cmd-K command menu. Untracked. | measured |
| `/live` | `pages/live.astro` | **The Story surface.** One outcome sentence, five beats, one CTA, six facts. The only route that talks to the live API. | measured |
| `/viewer` | `pages/viewer.astro` | Agent Viewer over a local session file the visitor picks. Story card on top, then a three-column shell (agent rail, wasm canvas, inspector) plus an expert-only timeline and summary. Nothing is uploaded. | `wide` |
| `/cockpit/[caseId]` | `pages/cockpit/[caseId].astro` | The expert operations surface for a recorded Case. `StoryPanel` on top, then topology, the Zoetrope renderer and the Decision Evidence rail. | `wide` |
| `/cases` | `pages/cases/index.astro` | Case queue, ordered by who is blocked rather than by id. | measured |
| `/cases/[caseId]` | `pages/cases/[caseId].astro` | Case Workspace, the business-facing read of the same projected state. | measured |
| `/audit/[caseId]` | `pages/audit/[caseId].astro` | Audit view: canonical payload one expandable click from every row. | measured |
| `/catalog` | `pages/catalog.astro` | Governed agent discovery from recorded registry metadata. | measured |
| `/approvals` | `pages/approvals.astro` | Approval inbox, keeping approval, authorization, execution and success as four separate facts. | measured |

Two structural facts matter for the redesign:

1. **`/live` is not in the navigation.** `components/Nav.astro:15-23` lists
   Dashboard, Agent Viewer, Cases, Agent Catalog, Approvals, Case Graph and
   Audit. It does not list `/live`, at `HEAD` or in the worktree. The shipped
   Story page is reachable only by typing the URL. Any redesign that leaves
   this alone ships a default surface nobody arrives at.
2. **There are already three Story-shaped surfaces**, and they do not share
   an implementation: `/live` (`features/live/state.ts`, derived from the run
   API), `/viewer` (`features/story/story.ts`, derived from a local file) and
   `/cockpit` (`features/story/enterprise.ts`, derived from recorded canonical
   events). They share a CSS class vocabulary (`.story__*`) and a rough shape,
   Outcome then cards then chapters, but nothing else. This is the duplication
   the review saw as "Story and Expert not separated enough": the separation
   exists per route, so it is inconsistent across routes.

## 2. The token system in `global.css`

### 2.1 What is defined

All tokens live on one `:root` block, `global.css:12-63`. The naming is
uniformly `--fs-*`, which makes them easy to grep and easy to keep.

* **Surfaces**, `global.css:16-21`. `--fs-bg` `#0d1014`, `--fs-surface`
  `#14181e`, `--fs-surface-raised` `#1a1f26`, `--fs-surface-sunken` `#101418`,
  `--fs-border` `#262d36`, `--fs-border-strong` `#333c47`. The comment states
  the intent: depth moves one step at a time, because a panel two steps above
  its parent reads as a different product.
* **Text**, `global.css:29-31`. Three weights only, `--fs-text`,
  `--fs-text-muted`, `--fs-text-faint`, chosen so that all three clear WCAG AA
  against the lightest surface. The stated reason is that a caption an auditor
  cannot read is not a disclosure.
* **Semantic colour**, `global.css:33-38`. `--fs-ok` green, `--fs-warn` amber,
  `--fs-deny` red, `--fs-info` blue `#6b9ce0`, `--fs-unknown` grey,
  `--fs-accent` aliased to the same blue as `--fs-info`.
* **Chip backdrops**, `global.css:42-46`. The same five hues at `1f`/`14` alpha.
* **Spacing**, `global.css:48-53`. A six-step 4px scale.
* **Radius and shadow**, `global.css:55-57`. `--fs-radius` 6px,
  `--fs-radius-sm` 4px, one drawer shadow.
* **Type**, `global.css:59-60`. `--fs-font` system sans, `--fs-mono` system mono.
* **Layout**, `global.css:63`. `--fs-nav-height` 48px, so every route's content
  starts on the same line.

The file is organised into 24 commented sections (`global.css:110`, `437`,
`538`, `570`, `655`, `742`, `793`, `875`, `912`, `1007`, `1031`, `1081`,
`1142`, `1233`, `1282`, `1361`, `1434`, `1564`, `1608`, `1715`, `1822`,
`1866`, `1898`, `2153`), from Shell down to the Guided Evidence Tour.

### 2.2 Where it agrees with the locked direction

* **Near-black surface**: yes, `--fs-bg` `#0d1014` is already the ground.
* **Blue for selection and CTA**: yes. `--fs-accent` drives
  `.fs-nav__link[aria-current]` (`global.css:502-506`), `:focus-visible`
  (`global.css:94-98`), `.fs-button:hover` (`global.css:933-936`) and
  `.story__step[aria-current]` (`global.css:1989-1992`). One accent, used
  consistently for selection. This is reusable as-is.
* **Sans for product copy, mono for evidence**: yes, and enforced at the call
  sites. `.fs-kv dd`, `.fs-mode`, `.story__source`, `.story__tour-event` and
  `.live__facts dd` are all mono; body copy is `--fs-font`.
* **Never colour alone**: the strongest existing rule. `.fs-status`
  (`global.css:661-711`) always renders glyph, word and tone together, and
  `components/StatusBadge.astro:62-63` makes the glyph `aria-hidden` and the
  word real text. `features/live/client.ts:77-85` does the same on `/live`.
  Keep this.

### 2.3 Where it conflicts

* **No cyan, no violet, no orange.** The palette has one blue that is both
  `--fs-info` and `--fs-accent`, plus ok/warn/deny/unknown. The locked spectrum
  needs cyan for live, violet for Warden and orange reserved for Controlled
  Fault. Today a Controlled Fault would land on `--fs-warn` amber
  (`--fs-warn: #d5a03c`), which is also the tone for "attention", "synthetic"
  and "unknown-ish" states, so the one label that must be unmistakable shares a
  colour with three others.
* **Green is load-bearing.** `--fs-ok` marks `.story__step-dot[data-state=reached]`
  (`global.css:1975-1979`), `.story__card-state[data-state=evidenced]`
  (`global.css:2028-2030`) and `.story__tour-status` (`global.css:2187-2189`). The locked
  direction forbids green-filled nodes in the graph but does not forbid green
  as a status word; the redesign should decide this explicitly rather than
  discover it.
* **Cream workstation, in flight, `global.css:114-122`.** `.fs-card.fs-workstation`
  sets `background: #f2f0e9; color: #151515`, a light panel on the dark shell,
  and `global.css:123-132` adds a dotted radial-gradient overlay with a
  linear-gradient mask. `components/StoryPanel.astro:45` now applies this class
  to the Cockpit's Story card.
* **Traffic-light dots, in flight, `global.css:150-168`.** `.story__window-dots i`
  and `.fs-terminal-window__dots i` render three circles coloured `#e17b70`,
  `#e4bc58`, `#79b889`. Emitted by `components/TerminalWindow.astro:11` and
  `components/StoryPanel.astro:47`.
* **Pastel agent cards, in flight, `global.css:310-333`.** Six
  `--fs-agent-bg`/`--fs-agent-fg` pairs (mint, lilac, lime, salmon, periwinkle,
  butter) for `components/AgentIdentity.astro`, which draws a face with two eyes
  and a mouth.
* **Entrance animation, in flight, `global.css:235-268`.** `fs-story-enter`
  staggers the outcome, summary, path, cards and tour by 35/50/70/90/130/160ms.
  It is correctly disabled under `prefers-reduced-motion` (`global.css:426-435`),
  but it is decoration on the surface that is supposed to be restraint.
* **`/viewer` runs a second, light theme.** `pages/viewer.astro:168-199` defines
  `--viewer-ink` `#172033`, `--viewer-paper` `#f6f7fb`, `--viewer-blue`
  `#4285f4`, `--viewer-violet` `#8b5cf6`, sets a paper background with a dotted
  radial gradient, restyles `h1` and `h2` to Georgia serif at up to 58px, gives
  the primary button a `linear-gradient(135deg, #4285f4, #7657e8)` fill, and at
  `viewer.astro:189` draws a `conic-gradient` six-colour orb. This is a
  different product's visual language living inside the same shell.
* **`/live` uses tokens that do not exist.** `pages/live.astro:88,89,94,109,129,133`
  reference `var(--border, #263247)`, `var(--surface-raised, #182131)` and
  `var(--accent, #4c8dff)`. There is no `--border`, `--surface-raised` or
  `--accent` in `global.css`; the real names carry the `--fs-` prefix. Every one
  of those declarations therefore resolves to its hardcoded fallback. The Story
  page is currently painted by six literals, not by the design system, and
  changing `--fs-accent` would not move it. This is the cheapest single fix in
  the whole audit and it is a prerequisite for any spectral retheme.

## 3. What the shipped `/live` does well, and must not be regressed

These are load-bearing properties, not stylistic preferences. Each one exists
because the alternative would let the page claim something the run did not do.

1. **Everything is derived, nothing is narrated.** `deriveLive`
   (`features/live/state.ts:178-337`) is a pure function of
   `(capability, run, page)`. There is no `setState('running')` anywhere in
   `client.ts`. `render` (`client.ts:98-141`) only writes what `deriveLive`
   returned. Keep the shape: a redesign that adds a local animation clock or an
   optimistic beat breaks the invariant the whole page exists to hold.
2. **A beat is `done` only because an event of that kind exists.**
   `deriveBeats` (`state.ts:150-176`) maps five fixed definitions
   (`state.ts:126-132`) onto `firstOf(events, kind)`. A beat that was never
   reached stays `pending`, including on a finished run, and the comment at
   `state.ts:159-161` explains why that is the honest answer.
3. **Delegation is never faked.** `DELEGATION_UNKNOWN` (`state.ts:117`) is the
   default, `state.ts:223-227` flips to observed only when a `delegation` event
   is actually present, and `live.astro:47-49` ships the unknown text in the
   static HTML so it is true before any script runs.
4. **The five truth labels are words, not colours.** `TRUTH_LABEL`
   (`state.ts:34-40`) and `client.ts:77-85` mean the fault beat literally reads
   "Controlled Fault" as text.
5. **A blocked deployment says why.** `state.ts:217-221` produces one of two
   specific sentences, LIVE_MODE off or ledger not durable, and disables the CTA
   rather than letting a click fail. `client.ts:122-136` is the only place the
   CTA's enabled state is set.
6. **Replay is honestly described as free.** `REPLAY_NOTE` (`state.ts:124`)
   states zero model, tool and Warden calls, and `client.ts:237-245` implements
   replay as nothing but a re-read.
7. **The `?api=` override is loopback-only.** `resolveApiBase`
   (`client.ts:32-51`) parses the URL and checks `hostname`, not the string, so
   a link cannot repoint the page's POST at a third party.
8. **One request body field.** `client.ts:224` posts `{"scenarioId": ...}` and
   the comment states no prompt, target, budget or model can be sent.
9. **The cursor and budget are on screen.** `live.astro:56-57` exposes the
   canonical event cursor and the model-call budget so a reader can check the
   claim independently.
10. **It survives 480px.** `qa-live.ts:33` runs the whole suite at 480x900 and
    `qa-live.ts:300-303` asserts zero horizontal body overflow.

## 4. Where `/live` is already too dense or unclear

The page is 171 lines and still has more competing regions than the locked
direction allows. Reading `live.astro:25-61` top to bottom, a first-time viewer
meets, in order: two buttons, a blocked banner, the outcome sentence, an
awaiting-agent box, five beat chips, a delegation line, six labelled facts and a
replay note. That is nine regions before the fold on a page whose whole premise
is one outcome and one action.

Specific problems:

1. **The action comes before the reason for it.** `live.astro:26-33` puts the
   CTA above `#live-sentence` at `live.astro:37`. The reader is asked to press
   something before being told what state the system is in. The locked direction
   is one outcome then one action.
2. **Two buttons are always in the DOM.** `#live-replay` (`live.astro:30`) is
   `hidden` until a run finishes, but it sits in the same flex row as the primary
   CTA, so "one obvious action" is structurally two.
3. **The six-fact `<dl>` is an inspector in the default view.**
   `live.astro:51-58` shows Agent, Incident reason, Policy rationale, Result,
   Event cursor and Budget as a `repeat(auto-fit, minmax(14rem, 1fr))` grid
   (`live.astro:152`) of monospace values. "Event cursor: 8" and
   "Budget: 0 / 25 model calls" are verification instruments, not story. This is
   exactly the "inspector too technical for the default view" finding.
4. **The beats are five equal chips, so the story has no shape.**
   `live.astro:115-122` lays them out as `flex-wrap` with `flex: 1 1 9rem`, and
   the only state signal is `border-color` on `[data-status='done']`
   (`live.astro:132-134`). Start, Governed read, Controlled Fault, Warden retry
   and Result are not five equivalent things: the fault and the retry are the
   point of the demo, and nothing in the layout says so.
5. **Beat status text repeats the truth label instead of the status.**
   `client.ts:78-85` prints the truth label ("Live", "Controlled Fault") in the
   slot named `.live-beat__status`. A done beat therefore never says "done", and
   two different beats can both read "Live" with no visible difference in
   progress.
6. **`data-state="ready"` is hardcoded in the static HTML.**
   `live.astro:25` ships `data-state="ready"` before any capability check has
   run, which contradicts the file's own doc comment at `live.astro:7-14`
   ("nothing claims a state until the API has answered"). It also means
   `qa-live.ts:185-189` can pass its "reaches ready" check off the static
   attribute. The honest initial value is `unavailable`, or no attribute at all.
7. **Delegation is a bare sentence with no hierarchy.** `live.astro:47-49`
   renders the most conceptually subtle fact on the page, that this runtime
   cannot observe delegation, as a 0.9rem paragraph between the beats and the
   facts, with no visual signal that it is a limitation rather than a result.
8. **No visual identity at all.** The page uses zero `fs-*` classes. It is
   plain text on `--fs-bg` with four hardcoded borders. Whatever the review
   meant by "not Antigravity-like", `/live` is currently not styled at all,
   which is a different and easier problem than the Cockpit's.

## 5. Component inventory

### 5.1 Reusable as-is

| Component | File | Why |
| --- | --- | --- |
| `BaseLayout` | `layouts/BaseLayout.astro:1-50` | Shell, nav, footer, `wide` flag. Already the right amount of chrome. |
| `PageHeader` | `components/PageHeader.astro:15-24` | Title, lede, `badges` and `actions` slots on one line. Deliberately compact, and `/live` already uses it. |
| `StatusBadge` | `components/StatusBadge.astro` | Glyph, word and tone in one chip, resolved through `lib/status.ts` so a state has one word product-wide. |
| `UnknownOr` | `components/UnknownOr.astro:31-46` | The zero-versus-unknown distinction, already correct. |
| `Metric` | `components/Metric.astro` | `UnknownOr` with a label. |
| `EmptyState` | `components/EmptyState.astro` | Distinguishes "nothing happened" from "could not be read". |
| `CopyableDigest` | `components/CopyableDigest.astro` | Evidence affordance. |
| `deriveLive` / `deriveBeats` | `features/live/state.ts` | The state machine is correct. The redesign is a presentation change over it. |
| `.fs-status`, `.fs-mode`, `.fs-button`, `.fs-card`, `.fs-kv` | `global.css:655-1030` | The token-driven primitives. |

### 5.2 Needs a variant

| Thing | File | What the variant must do |
| --- | --- | --- |
| Beat chips | `live.astro:123-145`, `client.ts:60-96` | Story Mode needs a beat rail with hierarchy, not five equal pills. Emphasise fault and retry; keep `data-beat` and `data-status` unchanged (section 6). |
| `.fs-button[data-variant='primary']` | `global.css:942-952` | Today it is a tinted-blue text button. Story Mode's single CTA needs a filled, unambiguous primary. `/live` does not use `.fs-button` at all yet and should. |
| `StoryPanel` | `components/StoryPanel.astro` | Carries the Cockpit's Story, the Proof Path, the Guided Evidence Tour and the mode switch in one 557-line component. Story Mode wants the outcome and path; the tour and mode switch belong to the shell. Split before reuse. |
| `ModeBadge` / `.fs-mode` | `components/ModeBadge.astro`, `global.css:713-741` | Has `info`/`warn`/`unknown` tones. Needs a cyan `live` tone and an orange `controlled_fault` tone that no other state can borrow. |
| `TerminalWindow` | `components/TerminalWindow.astro:9-16` | Correct primitive for Expert Mode terminal evidence, but its header emits three traffic-light dots at line 11. Remove the dots, keep the frame. |
| `.fs-cockpit-layout` | `global.css:1436-1457` | The three-column expert grid. Expert Mode can reuse it; Story Mode must not inherit it. |

### 5.3 Missing

1. **A mode switch that is part of the shell.** The only one that exists is
   `.story__modes` inside `StoryPanel.astro:210-213`, driven by
   `html[data-cockpit-mode='story'] [data-expert-surface] { display: none }`
   (`global.css:2108-2110`). It is Cockpit-specific and lives inside the Story
   card it is meant to switch away from. `/live` has no mode concept at all.
2. **A nav entry for `/live`.** `Nav.astro:15-23`.
3. **Cyan, violet and orange tokens**, and a rule that orange is reserved for
   Controlled Fault. Section 2.3.
4. **An "unobservable" presentation.** The product has `UnknownOr` for a missing
   measurement, but nothing for "this runtime cannot report this", which is what
   delegation is. `live.astro:47` renders it as ordinary prose.
5. **A canonical timeline component.** `/viewer` has one at
   `viewer.astro:142-153` (`data-timeline`), the Cockpit has the Evidence Rail,
   `/live` has neither. Expert Mode needs one that reads the nine canonical
   kinds.
6. **A terminal evidence pane.** `TerminalWindow` is a frame with no content
   contract; nothing renders MCP transcript lines.
7. **A shared Story contract.** Three adapters produce three different shapes
   (`live/state.ts:100-115`, `story/story.ts:71-90`, `story/enterprise.ts:100`).
   Story Mode across routes needs one view type.

## 6. What a careless redesign would break

Two independent browser suites and one unit suite guard this UI. They assert on
DOM contracts, so markup changes are behaviour changes.

### 6.1 `pnpm qa:live` (`scripts/qa-live.ts`), the 58 checks

29 checks at each of two viewports, 1440x900 and 480x900 (`qa-live.ts:31-34`).
It boots the real API with `FLEETSCOPE_RUN_DRIVER=mcp`, no Gemini credential,
drives a real governed MCP tool call, and asserts against `/live`. **Every
selector below is a hard contract.**

| Selector or attribute | Asserted at | What is checked |
| --- | --- | --- |
| `#live-root` `data-state` | `qa-live.ts:103-116` | Must reach `ready`, `awaiting_agent`, `completed`, `historical_replay` by name. Renaming any state breaks 8 checks. |
| `#live-start` | `qa-live.ts:190-195` | Text must equal exactly `Run live recovery demo`; must be enabled at ready. |
| `#live-delegation` | `qa-live.ts:196-201`, `265-268` | Text must contain `Unknown / not observable in this runtime`; `data-observed` must be `"false"`. |
| `#live-awaiting` | `qa-live.ts:210-215` | Must contain both `AWAITING_AGENT_LINES` verbatim. |
| `[data-beat="<id>"]` `data-status` | `qa-live.ts:118-119`, `216-220`, `237-238` | Ids `start`, `read`, `fault`, `retry`, `result`. Status values `pending` and `done`. |
| `[data-beat="fault"] .live-beat__status` | `qa-live.ts:240-245` | Trimmed text must equal `Controlled Fault`. Both the class name and the text are asserted. |
| `#live-policy` | `qa-live.ts:246-250` | Non-empty and not `none`. |
| `#live-incident` | `qa-live.ts:251-254` | Must contain `Controlled Fault`. |
| `#live-result` | `qa-live.ts:255-258` | Trimmed text must equal `succeeded`. |
| `#live-cursor` | `qa-live.ts:259-260`, `288-293` | Numeric, `>= 8`, and unchanged by replay. |
| `#live-budget` | `qa-live.ts:261-264` | Must contain `model calls`. |
| `#live-replay` | `qa-live.ts:276` | Must be clickable after completion. |
| `#live-replay-note` | `qa-live.ts:282-287` | Must contain `zero model, tool and Warden calls`. |
| body overflow | `qa-live.ts:300-303` | `scrollWidth - clientWidth <= 0`, including at 480px. **This check cannot fail. See below.** |
| console | `qa-live.ts:304-308` | Zero console errors. |
| network | `qa-live.ts:309` | Zero 404 responses. |

**The shipped overflow check is a no op, and it was measured rather than
reasoned.** Recorded by `10` C28. `global.css:70-74` sets `html { overflow-x:
hidden }` and `:76-78` sets it on `body` as well, at HEAD and in the worktree.
The root element's overflow propagates to the viewport, which stops the viewport
reporting scrollable width, so `document.documentElement.scrollWidth` is clamped
to `clientWidth` no matter what the layout does. Probed in Chromium at 480x900
against a 1200px child:

```
no overflow-x hidden          scrollWidth 1208  clientWidth 480  -> check FAILS  (correct)
body { overflow-x: hidden }   scrollWidth 1200  clientWidth 480  -> check FAILS  (correct)
html + body, as shipped       scrollWidth  480  clientWidth 480  -> check PASSES (wrong)
```

The `html` rule is the one that does it; `body` alone leaves the check working.
So `12` P5 and R4, `11` phase 9's "done when", and `09` section 4.3's claim that
"the QA overflow assertion is absolute" all rest on a check that passes on a page
with 720px of hidden overflow. Every design constraint derived from it, that wide
content scrolls in its own container, that the causal path stacks at 390, that
the graph host is not fixed width, is currently unenforced. `global.css` is on
`11`'s forbidden edit list, so the propagation cannot be fixed from inside this
programme; the measurement is replaced instead, by `10` D47. In the same probe,
`Math.max(...rects.map(r => r.right))` returned 1200 against an `innerWidth` of
480 in all three cases, so the replacement detects what the shipped check misses
and needs no stylesheet change.

Practical consequences:

* The six `#live-*` ids are an API. Moving a fact into a drawer is fine;
  deleting its id is not. If Story Mode hides the cursor and the budget behind
  an Expert affordance, the elements must still exist in the DOM.
* `qa-live.ts:240` couples to the class `.live-beat__status`, so renaming the
  beat CSS breaks a check even if the id and status survive.
* Zero 404s means every asset a new design adds must actually ship. A webfont
  reference that misses is a QA failure, not a cosmetic one.
* Zero horizontal overflow at 480px means a fixed-width graph or terminal must
  scroll inside its own `overflow-x` container, the rule already stated at
  `global.css:577-581`.

### 6.2 `pnpm qa:browser` (`scripts/browser-qa.ts`)

1670 lines, and it does **not** visit `/live` (route list at
`browser-qa.ts:930-937`: dashboard, viewer, catalog, cases, workspace,
approvals, cockpit, audit). It guards the surfaces a redesign will touch
anyway:

* `.fs-shell` must be visible on every route at every viewport
  (`browser-qa.ts:955-959`). Changing `BaseLayout` breaks all of them at once.
* `[data-expert-surface]`, `[data-expert-toggle]`, `[data-mode-story]`,
  `[data-mode-expert]` are the Story/Expert contract on `/cockpit` and
  `/viewer`.
* `[data-path-step]` with `data-state="reached"` (`browser-qa.ts:475-478` expects
  exactly 6) and `.story__card[data-state="evidenced"]` (`browser-qa.ts:467-470`,
  `1119` expect exactly 4). These counts are asserted, so removing or merging a
  proof card fails QA.
* The Guided Evidence Tour: `[data-tour-start]`, `[data-tour-next]`,
  `[data-tour-back]`, `[data-tour-evidence]`, `[data-tour-expert]`,
  `[data-tour-close]`, `[data-tour-active]`, `[data-tour-title]`.
* Renderer hosts by id: `#fleetscope-cockpit-canvas canvas`
  (`browser-qa.ts:945-947`) and `#agent-viewer-canvas canvas`
  (`browser-qa.ts:950-952`). Renaming either id blanks the graph.
* `[data-agent-rail] .fs-agent-identity` is asserted, so the pastel avatar is
  now inside a browser check even though it is on the "never" list. Removing it
  requires updating `browser-qa.ts` in the same change.
* URL state is asserted: `?mode=story|expert`, `?event=<sequence>`, `?tour=<step>`
  (`browser-qa.ts:596-610`, `798-809`). Any new mode switch must keep these
  query parameters and their invalid-value fallbacks.

### 6.3 `pnpm test` (vitest)

* `apps/web/tests/live-state.test.ts` covers all ten `LiveState` values by name
  (`:84-178`), the five beat labels in order (`:217-226`), every truth label
  (`:227-236`), both blocked reasons (`:250-266`) and the loopback rule
  (`:280-297`). Renaming a state, a beat label or a truth label breaks it.
* `apps/web/tests/presentation.test.ts` binds `lib/status.ts` vocabulary,
  evidence records, incident views, case summaries and demo phases. Changing a
  status word anywhere means changing it in `lib/status.ts`, which is the
  correct single point.
* `story-enterprise.test.ts` deletes events and corrupts correlation ids to
  prove each proof chain actually breaks. Do not weaken the adapters to make a
  new layout easier.

### 6.4 Non-test breakage a careless redesign would cause

1. **Restyling `global.css` tokens will not restyle `/live`.** Section 2.3.
   Fix the token names in `live.astro:88-133` first, or the Story page silently
   keeps its old colours while every other route changes.
2. **`--fs-accent` and `--fs-info` are the same value.** Splitting blue into a
   selection accent and a live cyan means auditing every `--fs-info` call site,
   including `.fs-status[data-tone='info']` (`global.css:694-698`) and
   `.fs-mode[data-tone='info']` (`global.css:729-732`), which today includes the
   nav's own "Live proof enabled" chip (`Nav.astro:46-50`).
3. **The renderer measures its host exactly once.** `CockpitMount.astro:146-180`
   documents that ratzilla sizes the terminal grid from `parent.client_width()`
   at construction and never re-derives it. A layout that mounts the graph
   inside a `display: none` panel, a zero-width column or a collapsed accordion
   produces a permanently blank canvas while every other signal looks correct.
   This is why `global.css:2104-2110` reveals the expert surface before mounting.
   Any new Story/Expert switch must preserve that ordering.
4. **`prefers-reduced-motion` is honoured globally** (`global.css:100-107`) and
   again per feature (`global.css:426-435`, `1558-1562`, `1859-1862`,
   `2128-2131`). New motion must add its own guard.
5. **Removing `AgentIdentity` or `TerminalWindow` touches other agents' files.**
   `AgentIdentity` is asserted by `browser-qa.ts` and by
   `apps/web/tests/agent-identity.test.ts`; `TerminalWindow` is used by
   `dashboard.astro:44`. Both are untracked in-flight work at the time of this
   audit. Coordinate rather than delete.
6. **`/live` polls every 400ms forever** (`client.ts:22`, `client.ts:248`) and
   refetches the whole event page from cursor 0 each tick
   (`client.ts:204`). Any transition or entrance animation keyed to a render
   will re-fire 2.5 times a second. Story Mode motion must key off a state
   change, not a paint.

## 7. Summary judgement

The state machine, the derivation discipline and the token system are sound and
should survive the redesign untouched. What is missing is presentation:
`/live` has no visual identity, no hierarchy among its beats, no single obvious
action, and an inspector-grade fact list in its default view. Meanwhile the
in-flight worktree is adding the exact motifs the review rejected, in
`global.css:110-436`, and two of them are already load-bearing in browser
checks. The redesign's first concrete acts are to give `/live` real token names,
put it in the navigation, and decide the cyan/violet/orange additions before any
markup moves.
