# Reference matrix

Status: normative for the agent workspace redesign

Phase: 0, prerequisite for the Story Mode and Expert Mode specifications

Last updated: 2026-08-29

## Why this document exists

An earlier prototype was rejected for six reasons, and five of them are about
restraint rather than about which references were chosen. The references were
never the problem. The problem was that they were read at the level of surface
treatment, so what got copied was a look instead of a rule, and the result was a
SOC dashboard wearing different paint.

This document fixes what each reference is allowed to contribute, states the
principle underneath it rather than the treatment on top of it, and assigns
every borrowed pattern to exactly one FleetScope surface. Anything not assigned
here does not enter the design.

The load-bearing claim is in section 3: the Antigravity feeling is a set of
countable properties, and changing colours cannot produce it. That section gives
the counts.

## How the references were read, and where the reading is thin

Two of the four references cannot be measured from a public URL, and the
document says so rather than inventing detail.

1. **Zoetrope** at `zoetrope.furkankly.dev/app` is a WASM application. Fetching
   it returns the loader shell and a "Built for a bigger screen" notice, not the
   interface. The higher fidelity source is the renderer vendored into this
   repository and the findings already recorded in
   `docs/plans/zoetrope-audit-and-implementation-plan.md`. That audit is treated
   as the authority here.
2. **Antigravity** publishes a marketing site at `antigravity.google`, and the
   IDE is a downloadable application. The marketing page is light, sectioned and
   sells a product. It is not the product surface and it is not design guidance.
   The IDE surface was not measurable in this pass. So "Antigravity restraint" is
   used in the locked direction as a **name for a set of restraint properties**,
   not as a request to match a screenshot nobody in this pass has measured.
   Section 3 therefore defines those properties as FleetScope budgets with
   numbers, chosen so they are measurably different from the rejected artifact.
3. **Blobatar** and **term-v0** were read from their public pages on 2026-08-29.
   Where that reading contradicts an earlier FleetScope document, section 6
   records the contradiction instead of hiding it.

Nothing below borrows a logo, a brand asset, a colour value or a layout.

## 1. The matrix

| Reference | What FleetScope takes | What FleetScope explicitly rejects | Why |
|---|---|---|---|
| **Antigravity** (agent IDE) | Restraint as a measurable budget: one focal object per screen, one obvious action, wide type scale, near-zero grouping borders, colour as an exception. See section 3 for the numbers. | The marketing page's light sectioned layout; treating "Antigravity-like" as a palette; any attempt to reproduce a surface this pass did not measure. | The review rejected the prototype for treating this reference as a colour swap. The feeling comes from what is *absent*, and absence is countable. A palette change leaves every count unchanged. |
| **Zoetrope** (session viewer) | Content time separated from presentation time; transport state (`Live`, `Playing`, `Paused`, `History`, `Idle`) **derived** from playhead versus live edge rather than stored as a mode flag; one playhead as the sole authority; replay and live folding into the same projection. | Its Claude specific transcript parser as the domain model; the minimap; the always-visible dotted canvas; the graph as a default surface. | The derived transport rule is already how `apps/web/src/features/live/state.ts` works, so taking it costs nothing and keeps the UI incapable of claiming a state no event produced. The parser was rejected in the Phase 1 audit because adopting it would make the Claude transcript format the domain model. The graph is the strongest Expert signal, so leaving it in the default view is what collapsed Story into Expert last time. |
| **Blobatar** (identity components) | Identity derived deterministically from the agent's canonical name, because agents are spawned rather than registered so there is no upload step and no per agent design pass. A readable label always sits beside the mark. | Presence semantics (`online`, `thinking`); "every state blinks and breathes"; notification counts; the avatar carrying state on its own; an agent rail sized for a spawned fleet. | FleetScope's runs are recorded or already finished far more often than they are live, and a breathing avatar on a completed or failed run is a claim about liveness that no event supports. The real MCP transcript has one agent plus one Warden intervention, so a fleet rail is scaffolding for agents that do not exist. |
| **term-v0** (terminal product page) | The terminal register carried by **typography and command syntax**, not by a picture of a terminal: a monospace command alone on its own line, CLI shaped navigation, no window chrome at all. | The full-bleed gradient background; the window frame, title bar and control dots that earlier FleetScope documents attributed to this reference. | The page as fetched has no window frame and no control dots. It sets one mono command on a line and stops. That is the correct and cheaper lesson: mono plus command syntax already says "terminal", so drawing a fake window adds chrome without adding meaning. The gradient is refused because motion or wash behind evidence makes a recorded run read as live. |

## 2. Principle, not treatment, for each reference

### 2.1 Zoetrope: the playhead is the only authority

The surface treatment is a dark dotted canvas with node cards, edges, a minimap
and a bottom timeline. The principle underneath is narrower and more valuable:
**state is derived, never set.** Transport state is a function of where the
playhead sits relative to the live edge. Nothing stores "we are live now".

FleetScope already holds this rule twice: once in the renderer, and once in
`state.ts`, whose header explains that there is no "set the state to running"
anywhere and that a beat is `done` only because an event of that kind exists.
The reference is therefore confirmation, not new information, and the only
Zoetrope work left is deciding which of its surfaces appear and where.

Everything visual from Zoetrope belongs to Expert Mode. None of it belongs to
Story Mode.

### 2.2 Blobatar: identity must survive having no design pass

The stated premise is that agents are spawned rather than registered, so the
name is all there is. That premise is exactly FleetScope's: the canonical agent
field arrives on an event, and no one uploads anything.

The principle taken is therefore **determinism from a stable key**, which is
already settled in the synthesis document as identity keyed by canonical agent
ID rather than DOM index, array order or viewport.

The treatments are refused because they encode presence, and FleetScope's honest
vocabulary has no presence in it. `recorded`, `completed`, `failed`, `waiting`,
`blocked`, `unknown` are states of a record. `online` and `thinking` are states
of a person.

### 2.3 term-v0: the terminal is a register, not a picture

Observed on the public page: a gradient background, a sans wordmark and
navigation shaped like paths (`/examples`, `/guide`), and the install line
`npm install -g term-v0` set in monospace with no surrounding frame, no title
bar and no control dots.

The principle is that **the mono typeface plus command syntax is sufficient**.
Once the reader sees a monospace command, the terminal register is established,
and a drawn window frame adds pixels, borders and a control affordance that
cannot control anything.

This matters for FleetScope beyond taste. Mono is FleetScope's evidence signal:
it marks the things that came from a canonical event. If mono is spent on
decoration, or if product prose is set in mono, the reader loses the only
typographic cue that separates a claim from its proof.

### 2.4 Antigravity: the feeling is what is absent

Treated in full below, because this is the reference the review says was
misread.

## 3. Antigravity: what actually creates it, and what a colour swap cannot do

The rejected artifact is at
`/Users/harryphan/Documents/ChatGPT/all things for agent/docs/design/assets/fleetscope-agent-terminal.css`
and its prototype at `prototypes/fleetscope-agent-terminal.html`. Both were
measured for this document. The shipped Story page at
`/Users/harryphan/Documents/dev/FleetScope/apps/web/src/pages/live.astro` was
measured the same way, because it is the only surface that already passes review.

### 3.1 What was measured

| Property | Rejected artifact | Shipped Story page | Budget adopted |
|---|---|---|---|
| Concurrent regions in one viewport | 8 (topbar, rail, outcome header, three agent node cards, console, inspector, timeline) | 5 (action, sentence, beats, delegation line, facts list) | Story: **3**. Expert: 5. |
| Distinct hex colours | 23, across 36 colour tokens | 3 | Story: **4 hues maximum**, one of which is neutral. |
| Border and outline declarations | 31 | 8 | Story: **6**, none of which exist only to group. |
| Type steps | 9 (9, 10, 11, 12, 13, 14, 15, 21, 29 px) | 4 (0.78, 0.8, 0.9, 1.05 rem) | **5**, with the ratios in 3.3. |
| Smallest adjacent type ratio | 1.08 | 1.02 | **1.25 minimum between sans steps.** |
| Top to body type ratio | 2.07 in theory, and the 29px step appears once | 1.35 across the whole section | **2.4 minimum.** |
| `max-width` measure caps in the stylesheet | 1, in 1219 lines | not applicable, single column | Every prose block capped. |
| Animation and `@keyframes` declarations | 7 | 0 | **0 in Story.** |
| Classed elements in one screen | 156 | fewer than 30 | Story: **under 40.** |

The layout root of the rejected artifact is
`grid-template-rows: 44px minmax(0, 1fr) 124px` with `min-height: min(900px, 100vh)`
and a border, so it assigns the entire viewport to bordered regions. With one
measure cap in the whole stylesheet, essentially no content is allowed to stop
short of its container. That is the mechanical reason it has no negative space:
nothing was ever permitted to end early.

### 3.2 The five properties, and why each one matters here

1. **Negative space ratio.** The target is that at least 45% of the Story
   viewport at 1440x900 stays unpainted background, achieved by capping the
   content column near 720px on a 1440px viewport and letting the rest be
   nothing. Negative space is not decoration. It is how a reader knows the page
   has finished making its point. A viewport that is fully assigned reads as a
   monitoring wall, and a monitoring wall implies there is more to watch, which
   is false: this run has eight events.
2. **Focal object count.** Story Mode gets exactly one focal object, the
   outcome, and exactly one action. The review's first complaint was eight
   regions competing, and eight regions is what was measured. When every region
   is equally weighted the reader has to choose where to look, and the page has
   handed its most important job to the reader.
3. **Border density.** A border is a claim that the things on either side of it
   are different kinds of thing. Thirty-one of them means the claim is worthless.
   Grouping should be carried by space and by one background step, and a visible
   border should be reserved for a genuine boundary, such as the edge of the
   evidence surface where mono content begins.
4. **Type scale.** This is where the rejected artifact failed hardest and least
   visibly. Its own specification asked for a 24 to 30px outcome heading, and
   the implementation does contain a 29px step, but six of its nine steps sit
   between 9px and 15px with adjacent ratios near 1.08. A 1.08 size difference
   does not read as a level. So the artifact tried to carry six levels of
   hierarchy with size alone inside a 6px band, where size cannot carry it, and
   the single large step could not rescue a page whose remaining content was
   uniformly small. The shipped Story page has the opposite failure: its scale
   is honest but flat, 1.35 from top to bottom, so nothing inside the section is
   primary either.
5. **Colour frequency.** The rejected artifact makes eight semantic hues
   available at once, blue, cyan, green, yellow, orange, violet, red and slate,
   plus a six stop rainbow hairline. FleetScope has exactly four coloured
   meanings. Any hue beyond those four invites the reader to look for a meaning
   that does not exist.

### 3.3 The type ladder

Five steps, with hierarchy below body carried by **typeface and case rather than
size**, because a size difference under about 1.2 is not perceived as a level.

```text
outcome        36px  sans  600        36 / 21 = 1.71
section lead   21px  sans  500        21 / 15 = 1.40
body           15px  sans  400        36 / 15 = 2.40
evidence       12.5px mono 400
label          11px  mono  500  uppercase, tracked
```

The two mono steps sit close in size on purpose. They are not two levels of the
same voice, they are one voice at two jobs, and the reader separates them by
case and tracking rather than by measuring them.

### 3.4 Why a colour swap cannot reproduce it

Take the rejected artifact and replace all 23 hex values with the locked
palette. What remains is: 8 competing regions, 31 borders, a type band where six
of nine steps differ by less than 10%, 7 animations, 156 classed elements in one
screen, one measure cap in 1219 lines of CSS, and a grid that assigns every
pixel of the viewport. Every property that produced the review's complaints is
untouched. The result is the same dashboard in different paint, which is
precisely the finding the review already returned.

What would reproduce it, stated as deltas from the measured artifact:

1. remove 5 of 8 regions from the default view,
2. remove 25 of 31 borders,
3. remove 4 of 8 hues and the rainbow hairline,
4. open the top of the type scale from a 1.08 adjacent ratio to 1.71, and the
   top-to-body ratio to 2.40,
5. remove all 7 animations from Story,
6. add a measure cap to every prose block so content is allowed to end before
   its container does.

Only item 3 involves colour, and it is a subtraction rather than a substitution.

## 4. Patterns rejected, and why each is wrong for FleetScope

The general reason for most of these is that FleetScope's entire product claim
is that it does not fabricate. A decoration that implies an unobserved fact is
not a small cost here, it is a contradiction of the product.

1. **Mac traffic light dots on panel headers.** A window control that closes
   nothing is the cheapest available lie on a page whose subject is not lying.
   They also occupy the top left of every panel, which is where the panel's name
   belongs.
2. **Cream or paper workstation surface.** The renderer and the shipped Story
   page are both dark. A light outer shell wrapped around a dark canvas reads as
   two products stitched together, and it forces every semantic colour to be
   defined twice. This supersedes the `paper #f2f0e9` outer layer in the
   synthesis document.
3. **Pastel agent cards.** Colour is reserved for four meanings. Spending a hue
   on agent identity buys nothing, because the agent name in mono already
   identifies the agent unambiguously, and it costs the reader one of only four
   colour meanings.
4. **Rainbow or spectral borders.** A six stop hairline reads as a legend, and a
   reader will reasonably ask what the green stop means. FleetScope has no green
   meaning. A brand mark that provokes a question the product cannot answer is a
   defect, not a flourish.
5. **Full screen animated gradients.** Motion behind evidence makes a recorded
   run look live, and the honesty rule that recorded must never read as live is
   already settled and already tested.
6. **Monospace for all product copy.** Mono is the evidence signal. If the
   explanation is mono too, the reader loses the only typographic cue separating
   a claim from its proof.
7. **Green filled nodes.** The locked palette has no green. Beyond that, this
   run's defining moment is a controlled fault, and a field of green nodes tells
   the wrong story before a single word is read.
8. **Yellow selection.** Selection is blue. Yellow reads as a warning, and
   FleetScope does not use a warning level, so a yellow selection would create a
   severity the event model does not have.
9. **Fake typing or streamed tokens.** FleetScope holds no model credential and
   the model runs in the developer's own Gemini or Antigravity CLI. Animating
   tokens FleetScope never received is fabrication in the most literal sense.
10. **Fake delegation, or any spawn tree.** Delegation is not observable on the
    MCP path because Gemini CLI has no sub-agents. This is already encoded:
    `BeatStatus` includes `unknown` as a first class status and
    `DELEGATION_UNKNOWN` is a constant. Every reference pattern that implies a
    tree of agents must be refused at the pattern level, not softened at the
    copy level.
11. **The graph in the default view.** The review said Story and Expert are not
    separated enough. The graph is the single strongest Expert signal, so
    leaving it in Story guarantees the two modes read as one.
12. **A sidebar and a graph that both list agents.** Named directly by the
    review as duplication. With one observable agent and one Warden
    intervention, two lists of one item each are pure chrome.
13. **A raw event inspector in the default view.** Also named by the review. This
    is a live defect rather than a hypothetical: the shipped Story page still
    carries a six field definition list of Agent, Incident reason, Policy
    rationale, Result, Event cursor and Budget in its default view. Event cursor
    and Budget in particular are operator facts, not outcome facts.
14. **An eight region grid.** Measured, and the first complaint in the review.

## 5. Translation rule: which surface each borrowed pattern belongs to

Every borrowed pattern gets exactly one home. A pattern with two homes is how
Story and Expert collapsed into each other last time.

| Borrowed pattern | Source | Home | Rule |
|---|---|---|---|
| One focal object, one obvious action | Antigravity | **Story Mode** | The outcome sentence is the focal object. The run action is the only element allowed to compete with it. |
| Wide type scale, 2.4 top to body | Antigravity | **Shared identity** | Both modes use the ladder in 3.3. Expert may use the two mono steps far more often; it may not add a sixth step. |
| Near zero grouping borders, space instead | Antigravity | **Shared identity** | Expert's higher information density is bought with background steps and alignment, not with more borders. |
| Colour as an exception, four meanings | Antigravity | **Shared identity** | Blue for selection and the call to action, cyan for live, violet for Warden, orange for Controlled Fault only. |
| Measure caps so content ends before its container | Antigravity | **Shared identity** | Applies to every prose block in both modes. Evidence lines are exempt because truncating them would hide evidence. |
| Derived transport state from the playhead | Zoetrope | **Shared identity** | Already the rule in `state.ts`. Neither mode may store a liveness flag. |
| One cursor for every surface | Zoetrope | **Shared identity** | Settled. Story beats, Expert graph, timeline and evidence all read the same cursor. |
| Graph, edges, node cards | Zoetrope | **Expert Mode** | Opt in only. Story Mode never renders the canvas. |
| Canonical timeline and scrubbing | Zoetrope | **Expert Mode** | Story's beat list is a summary of the same events and is not a scrubber. |
| Terminal evidence surface | Zoetrope, term-v0 | **Expert Mode** | The only place raw canonical events appear. |
| Deterministic identity from the canonical name | Blobatar | **Shared identity** | Same mark and same label in both modes, keyed by canonical agent ID. |
| A readable label beside every mark | Blobatar | **Shared identity** | The mark never appears alone, in either mode. |
| Mono command lines with no window chrome | term-v0 | **Shared identity** | Used for the CLI instruction on the awaiting agent state and anywhere a command is quoted. No frame, no title bar, no dots. |
| CLI shaped navigation and labels | term-v0 | **Expert Mode** | Story Mode uses plain product language. |

Patterns from the references that appear in **neither** column are not adopted:
minimap, presence indicators, notification counts, breathing or blinking marks,
gradient backgrounds, window frames and control dots.

## 6. Where this supersedes an earlier FleetScope decision

These are recorded rather than silently overwritten, because a later reader will
otherwise find two live documents that disagree.

1. `docs/design/fleetscope-web-uiux-synthesis.md` section 5 defines a warm paper
   outer layer at `#f2f0e9` with a separate terminal layer. **Superseded.** One
   near black surface for both modes. The reason is in item 2 of section 4.
2. The same document, section 4, attributes "terminal-window framing, small
   window controls" to term-v0. **Superseded on two grounds**: the observed page
   has neither, and the locked direction forbids control dots outright.
3. The same document, section 6, reserves a serif for display type. **Superseded.**
   The locked direction is sans for product copy and mono for evidence, which
   leaves no serif role.
4. `docs/product/ui-ux-plan.md` "Visual system" defines amber as the action
   colour, green as healthy, and violet as historical. **Superseded** by blue,
   cyan, violet for Warden, and orange for Controlled Fault. Note that violet
   changes meaning, from historical to Warden, so any surface still using violet
   for a replay state has to move.

Settled decisions that this document does **not** touch, and that the next phase
must continue to honour: one canonical cursor; deterministic identity keyed by
canonical agent ID; recorded never reading as live; the four card states
`evidenced`, `absent`, `unavailable`, `unsupported`; colour never being the only
carrier of state; reduced motion producing immediate state change; and no
chain-of-thought claim anywhere.

## 7. What this document deliberately does not decide

1. Exact hex values for the four hues. This document constrains how many hues
   there may be and where they may appear, not what they are.
2. The Story Mode layout. Section 3 sets budgets that the layout has to meet.
3. Whether the shipped six field definition list in `live.astro` is moved to
   Expert Mode or reduced in place. It is recorded here as a defect against the
   review, and the fix belongs to the Story Mode specification.
4. Anything about Expert Mode beyond which patterns it owns.
