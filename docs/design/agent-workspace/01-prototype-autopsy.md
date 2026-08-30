# Prototype autopsy: the rejected agent terminal workspace

Status: reference, closed
Scope: post mortem of the rejected `fs-agent-terminal` prototype
Last updated: 2026-08-29

## Why this document exists

The review that rejected the agent terminal prototype gave six reasons. Six
reasons stated as impressions are hard to design against, because the next
attempt can satisfy the words while repeating the mistake. This document turns
each impression into a line number and a count, so that the replacement can be
checked rather than argued about.

Everything below is measured against three files:

1. `/Users/harryphan/Documents/ChatGPT/all things for agent/docs/design/agent-terminal-workspace.md` (389 lines), cited as `md:N`
2. `/Users/harryphan/Documents/ChatGPT/all things for agent/docs/design/assets/fleetscope-agent-terminal.css` (1219 lines), cited as `css:N`
3. `/Users/harryphan/Documents/ChatGPT/all things for agent/docs/design/prototypes/fleetscope-agent-terminal.html` (353 lines), cited as `html:N`

The comparison baseline is the shipped Story page, `apps/web/src/pages/live.astro`,
whose state comes from `apps/web/src/features/live/state.ts`.

## 1. Inventory: what is on screen at once

The prototype has one and only one rendering. `html:85` sets
`data-mode="live" data-state="running"`, and nothing in the layout is conditional
on run state. At viewports of 1280px and above, every region below is present
simultaneously.

### Top level panes: 8

`.fs-at-shell` is a three row grid of `44px / 1fr / 124px` (`css:95`) and
`.fs-at-workspace` is a three column grid of `224px / 1fr / 344px` (`css:168`).
Neither has a state driven collapse. The only rules that remove a pane are
viewport queries (`css:1087`, `css:1109`, `css:1150`).

| # | Pane | Source | Fixed size |
|---|---|---|---|
| 1 | Spectral rule | `html:86`, `css:73` | 2px full bleed |
| 2 | Command bar | `html:89`, `css:101` | 44px |
| 3 | Left rail | `html:104`, `css:181` | 224px |
| 4 | Outcome strip | `html:163`, `css:323` | auto |
| 5 | Stage / graph canvas | `html:181`, `css:540` | remainder |
| 6 | Console feed overlay | `html:243`, `css:744` | 148px, absolutely positioned over pane 5 |
| 7 | Inspector | `html:278`, `css:185` | 344px |
| 8 | Canonical event rail | `html:316`, `css:910` | 124px |

### Independently framed content blocks: 13

Panes 3 and 5 each contain several separately titled or separately framed
blocks, which is why the surface reads as denser than an eight pane count
suggests. Counting what a reader has to parse as its own thing:

1. Spectral rule
2. Command bar
3. Rail block: `Causal path 4 / 5` (`html:105` to `html:116`), 5 step buttons
4. Rail block: `Agents 3` (`html:118` to `html:152`), 3 agent rows
5. Rail block: `Runtime truth` (`html:154` to `html:159`), 3 truth pills
6. Outcome strip (`html:163` to `html:179`)
7. Stage mode chips `FOLLOW ON` / `EVENT TIME` (`html:182` to `html:185`)
8. Graph edges and 2 SVG edge labels (`html:187` to `html:192`)
9. Graph nodes, 3 (`html:194` to `html:241`)
10. Console feed overlay, 4 rows (`html:243` to `html:274`)
11. Inspector explanation: truth pill, summary, paragraph, incident block, warden block (`html:281` to `html:298`)
12. Inspector evidence: 5 row definition list and a `pre` block (`html:300` to `html:311`)
13. Event rail: bar plus 13 event dots (`html:316` to `html:347`)

Four of these blocks carry a `.fs-at-panel-head` (`html:105`, `html:118`,
`html:154`, `html:279`), so four elements compete for the role of "this is a
section title" in one viewport.

## 2. The six criticisms, with the lines that cause them

### 2.1 Too much information at once

The layout cannot show less. `css:95` and `css:168` fix five of the eight panes
at literal pixel sizes, and no rule anywhere keys pane presence to run state.
The console (pane 6) makes this worse: `css:744` gives it
`position: absolute; right: 12px; bottom: 12px; left: 12px`, so it is layered
over the graph it is meant to explain rather than replacing anything. At
`css:750` it takes `max-height: 148px` out of a stage with `min-height: 360px`,
which is 41% of the canvas occluded by a second surface.

The prototype also never withholds. Counted from the default DOM:

* 25 focusable controls (`<button>` at `html:100, 109, 110, 112, 114, 115, 123, 133, 143, 176, 177, 321, 327 to 344`)
* 14 pill shaped labels: 2 `.fs-at-chip`, 6 `.fs-at-truth`, 6 `.fs-at-tool`
* 6 `.fs-at-status-dot` instances
* 115 distinct text nodes carrying 272 words
* 7 semantic hues visible at once: blue, cyan, violet, orange, green, slate, and yellow inside the spectral rule

Two of those hues carry no meaning in the locked palette. Green appears on
completed step dots (`css:426`), on the event 13 marker (`css:1004`) and on a
code value (`css:869`). Yellow appears only inside the spectral gradient
(`css:83`) and in the awaiting grid tint (`css:1057`). The loudest element on
the page, the 2px full bleed rule at `css:73`, is the one carrying the least
information.

### 2.2 SOC or devtools dashboard rather than an agent-native workspace

The typography decides this before the layout does. The stylesheet resolves a
font family 26 times. 23 of those resolve to `--at-mono` and 3 resolve to
`--at-sans`, at `css:57` (root default), `css:350` (the outcome heading) and
`css:815` (the inspector summary). Every control, every navigation row, every
label and every panel title is monospace. A monospace navigation rail is a log
viewer affordance, not a product affordance, and `md:209` forbids exactly this
("Do not use monospace for paragraphs explaining the product") while the
stylesheet does it everywhere except two headings.

Size confirms it. There are 7 distinct font sizes and 4 of them (9, 10, 11,
12px) are below the 13px the document sets as its own body minimum (`md:205`).
22 of the 25 sized declarations are 12px or smaller. The 9px tier is
`.fs-at-node__role` (`css:686`), `.fs-at-tool` (`css:721`),
`.fs-at-edge-label` (`css:612`) and `.fs-at-event` (`css:974`).

Three further devtools tells:

1. `.fs-at-feed-row` is a five column log line, `40px 110px 100px 1fr auto` for seq, actor, kind, detail, time (`css:761`). That is the grammar of a log tail.
2. `.fs-at-code` (`css:853` to `css:871`) puts a syntax highlighted key/value block in the default right pane.
3. The command bar's only stateful verb is `Stop` (`html:100`). A workspace whose single always visible action is Stop is a monitoring console, not a place where work begins.

### 2.3 Story and Expert not separated enough

They are not separated at all. The stylesheet has exactly one `data-mode` axis
and its only values are `historical` and `recorded` (`css:1034`, `css:1041`,
`css:1046`). There is no `story` value and no `expert` value anywhere in 1219
lines. `html:85` sets `data-mode="live"`, which matches no rule in the file.

So Story content and Expert content are not two modes. They are siblings in one
grid. The outcome strip (`css:323`) and the event rail (`css:910`) are rows 1
and 3 of the same `.fs-at-shell` template, and both are always rendered.

The source document admits the question was never answered. `md:371` to
`md:374` list as an open point "Whether the technical canvas is the default
center pane after the first live event, or stays behind `Open technical
evidence` until the incident." The prototype resolved an open question by
shipping both branches at once.

### 2.4 Sidebar and graph duplicating each other

They carry the same three actors, with the same status component, and in one
case the identical string.

| Fact | Rail | Graph | Feed |
|---|---|---|---|
| external agent's current tool | `html:137` `read_repository_metadata` | `html:220` `read_repository_metadata` | `html:249` `read_repository_metadata attempt 1` |
| FleetScope API's activity | `html:127` `accepted run events` | `html:201` `accepting canonical events` | implied by `html:247` actor column |
| Warden's action | `html:147` `retry authorized · 1 / 1` | `html:235` to `html:238` `retry_idempotent_read` + `authorized` + `attempt 1 / 1` | `html:263` `retry_idempotent_read authorized` |

Both surfaces render status through the same component with the same values:
`.fs-at-status-dot` at `html:129, 139, 149` in the rail and at
`html:196, 215, 230` in the node heads. Each actor's identity and current action
therefore appears three times simultaneously, and 224px of permanent column
width (`css:168`) is spent on the restatement.

Truth labels duplicate the same way. `.fs-at-truth` appears 6 times: `html:99`,
`html:156`, `html:157`, `html:158`, `html:166`, `html:281`. `Controlled Fault`
is stated twice (`html:157`, `html:166`) and a live family truth three times
(`html:99`, `html:156`, `html:281`). The rail's `Runtime truth` block
(`html:154` to `html:159`) is a legend, and a legend restates the meaning of
badges that are already attached to the things they describe.

Progress duplicates worst of all. Position in the run is stated four times in
two incompatible numbering systems: `4 / 5` (`html:106`), `8 / 13`
(`html:167`), `8` (`html:301`) and `8 / 13` (`html:319`). A reader cannot
reconcile "step 4 of 5" with "event 8 of 13" without being told the two count
different things, and nothing on screen tells them.

### 2.5 Inspector too technical for the default view

The 344px inspector (`css:168`) contains seven blocks in reading order. Four of
them are evidence rather than explanation:

1. truth pill (`html:281`)
2. 15px sans summary (`html:282`, `css:812`)
3. 12px sans paragraph (`html:283`, `css:818`)
4. orange incident block (`html:288`, `css:873`)
5. violet warden block (`html:293`, `css:895`)
6. five row definition list, 10px mono, 104px label column (`html:300`, `css:833`)
7. `pre` key/value block (`html:308`, `css:853`)

Blocks 6 and 7 put `warden-policy@1.2.0` (`html:302`), `idempotent_read`
(`html:304`) and a four line code listing into the default pane of a page whose
stated acceptance criterion is that a first-time user identifies state and next
action in fifteen seconds (`md:357`).

Two of these are worse than merely technical:

* `css:865` colours `.fs-at-code__key` with `--at-blue`. Blue is reserved for selection, focus and CTA (`md:176`, `md:185`). Spending it on syntax highlighting means the selection colour is present in a place nothing is selected.
* `css:869` colours `.fs-at-code__value` with `--at-green`, and `html:310` uses it for `result awaiting runtime`. Green on a value that has not arrived is precisely the failure mode `state.ts` was written to make impossible, where a surface claims an outcome the run has not produced.

### 2.6 Antigravity treated as a colour swap

The design system is 78% colour by token count. Of 36 declared tokens
(`css:13` to `css:49`), 28 hold a colour value. The other 8 are one shadow, two
font stacks, three radii and two fixed pixel heights (`--at-topbar: 44px`,
`--at-timeline: 124px`).

There is no spacing token, no type scale token and no elevation scale. The
consequences are measurable in the same file:

* 18 distinct literal `padding` values and 11 distinct literal `gap` values, 29 spacing literals in total. The gap series runs 1, 2, 5, 6, 7, 8, 9, 10, 12, 14, 18px, which is not a scale.
* 8 distinct `border-radius` values (1px, 3px, 4px, 5px, 7px, 8px, 50%, 999px), and `--at-radius-lg` is declared at `css:47` and used zero times.
* `--at-red` and `--at-red-soft` are declared at `css:35` and `css:36` and used zero times, so the "denied/blocked red terminated line" contract at `md:265` and the `failed` row of the status vocabulary table at `md:303` have no implementation at all.

The source document allocates its attention the same way. The Visual system
section runs `md:155` to `md:222`, 68 lines, of which 51 are colour tables,
gradient definitions and the spectral accent. Hierarchy, negative space and
chrome restraint get 6 lines, `md:137` to `md:142`. The document spends roughly
eight times more space on hue than on hierarchy, and the artifact inherits that
ratio: restraint is asserted at `md:9` to `md:13` and then contradicted by 84
drawn edges, 14 pills and 7 hues.

### 2.7 A seventh failure the review did not name: invented evidence

This one matters most, because the project's entire claim is that it never
shows what it did not observe.

| Shown | Ground truth |
|---|---|
| `--event-count: 13` (`html:326`) and `Canonical event 8 / 13` (`html:167`) | The MCP transcript is 8 events: `run_start, tool_call, tool_result, incident, intervention, tool_call, tool_result, run_end` |
| Sequences `0005`, `0006`, `0008`, `0009` (`html:246, 253, 261, 267`) | An 8 event run has sequences 1 to 8 |
| Latencies `+124ms`, `+2ms`, `+8ms` (`html:250, 257, 264`) | No latency field is carried on `CanonicalEvent` in `state.ts:42` |
| `run-019` (`html:96`) | The string appears nowhere in the repository |
| `warden-policy@1.2.0` (`html:302`) under an inspector whose header pill is `data-truth="live"` (`html:281`) | The string exists only in `packages/fixtures/cases/CASE-1042/source-events.jsonl`, a recorded case fixture. A recorded value is displayed on a live labelled surface |
| `.fs-at-truth[data-truth="historical"]` (`css:310`) | The canonical truth labels are `live`, `controlled_fault`, `recorded`, `unknown`. `historical_replay` is a run state (`state.ts:29`), not a truth. The stylesheet invents a fifth truth |

There is also an internal naming split: the same condition is spelled
`data-state="fault"` on status dots (`css:521`) and `data-state="controlled_fault"`
on nodes (`css:644`), inside one file. Four parallel state vocabularies exist
with four non overlapping value sets: dots take
`{live, waiting, fault, warden, complete}`, nodes take
`{live, controlled_fault, warden, complete}`, truth pills take
`{live, controlled_fault, recorded, historical, unknown}`, steps take
`{current, complete, controlled_fault}`.

## 3. What the prototype got right

These decisions are correct and the replacement should inherit them rather than
re derive them.

1. **The near black workspace.** `--at-ink-0` through `--at-ink-4` (`css:14` to `css:17`) give a four step surface ramp on a `#050608` floor, and `css:98` puts the shell on `--at-ink-1` so panels sit above the canvas rather than beside it. There is no cream card and no light surface anywhere in 1219 lines.
2. **Blue, cyan and violet as separated energies.** `md:185` fixes blue to interaction, cyan to live movement and violet to Warden, and the stylesheet actually holds the line in the places that matter: selection is blue and only blue at `css:658` (node), `css:774` (feed row), `css:1012` (event dot) and `css:1020` (cursor). No yellow selection exists.
3. **Orange fault and violet Warden kept apart.** The incident block (`css:873`) and the Warden block (`css:895`) are structurally identical and differ only in hue and label, which makes "something broke" and "policy acted" read as two different kinds of event rather than two severities of the same event. `css:790` and `css:794` carry the same separation into the feed's `__kind` column.
4. **The event rail is indexed by sequence, not wall clock.** `css:958` lays the track out as `repeat(var(--event-count), minmax(36px, 1fr))`, and `html:320` says so in words: "indexed by event, not wall clock". Shape carries meaning alongside colour: incident is a rotated square (`css:991`), intervention is a larger rounded square (`css:997`), result is a circle (`css:1004`).
5. **One consistent visual language across node, edge, feed and inspector.** `data-state` and `data-truth` drive the node rail (`css:640` to `css:656`), the edge stroke (`css:589` to `css:608`), the feed kind colour (`css:786` to `css:796`) and the truth pill (`css:292` to `css:319`) from the same vocabulary. When a value changes, four surfaces change together.
6. **Nodes are never filled with a status colour.** `css:632` puts state on a 3px left rail via `--node-rail` and leaves the body neutral, which is the rule at `md:256`. No green filled node exists.
7. **Delegation is not faked.** `html:158` shows a dashed `Delegation unknown` truth pill and `html:305` reads `Delegation / Unknown · not observable`. This matches `DELEGATION_UNKNOWN` in `state.ts:117` exactly. The prototype invented latencies and event counts but did not invent a delegation, and that instinct is the right one.
8. **Motion is already restrained.** There are exactly 2 keyframe animations in the file (`css:1064`, `css:1070`): an edge dash and a 180ms row enter. There is no ambient pulse, no gradient rotation and no simulated typing. `css:1190` and `css:1206` provide reduced motion and forced colours fallbacks.
9. **Word plus shape, never colour alone.** Every truth pill carries text (`html:99, 156, 157, 158, 166, 281`) and `css:284` gives it a shape marker that changes form for `controlled_fault` (`css:304`).

## 4. Density comparison, measured

Prototype in its only state, at 1280px and above, against `/live` in `ready`
state. "Whole surface" means the prototype's `<main class="fs-agent-terminal">`
subtree, which contains its own top bar and footer, against the shipped page
including nav and footer. "Page body" excludes both shells so the two content
areas are compared directly.

| Measure | Rejected prototype | Shipped `/live` | Ratio |
|---|---:|---:|---:|
| Top level panes | 8 | 3 (nav, page, footer) | 2.7x |
| Independently framed content blocks | 13 | 4 | 3.3x |
| Focusable controls, whole surface | 25 | 9 | 2.8x |
| Focusable controls, page body | 25 | 1 | 25x |
| Pill or chip labels | 14 | 1 in nav, 0 in the page body | 14x |
| Status dots | 6 | 0 | n/a |
| Drawn border and rule edges | 84 | 8 | 10.5x |
| Text nodes, whole surface | 115 | 40 | 2.9x |
| Text nodes, page body | 115 | 27 | 4.3x |
| Words of visible copy, whole surface | 272 | 114 | 2.4x |
| Words of visible copy, page body | 272 | 72 | 3.8x |
| Semantic hues on screen | 7 | 1 accent | 7x |
| Distinct font sizes | 7 | 5 | 1.4x |
| Sizes below 13px | 4 of 7 | 2 of 5 | |
| Distinct spacing literals | 29 | 10 | 2.9x |
| Distinct border radius values | 8 | 1 | 8x |

Notes on how the counts were taken:

* Prototype controls are the 25 `<button>` elements in `html:85` to `html:350`. Shipped controls are the nav brand link, 7 nav links and the `#live-start` CTA. `#live-replay` is `hidden` until a run exists (`live.astro:30`), so it is not counted.
* Text nodes and words were taken by the same method for both: strip `script`, `style` and comments, split on tags, keep runs containing an alphanumeric character. The shipped page is counted in `ready` state, so `#live-replay`, `#live-blocked`, `#live-awaiting` and `#live-replay-note` are excluded because they carry `hidden`, and the five beats are counted as `deriveBeats([])` renders them: label plus the word `Pending`.
* Prototype border count enumerates every rule that draws an edge on an element present in the default DOM, multiplied by instance count: shell, topbar, rail, inspector, 4 panel heads, steps container, 1 visible step outline, 5 step markers, 1 visible agent row outline, 3 agent marks, 6 status dots, 3 visible button borders, 8 chip and pill borders, 6 pill shape markers, outcome rule, 3 node borders, 3 node head rules, 6 tool chips, console border, 3 feed row rules, facts border, 4 fact separators, code border, incident border, warden border, timeline rule, timeline bar rule, track line, 13 event dot rings and the cursor. Total 84.
* Shipped border count is 1 CTA border (`live.astro:88`), 5 beat borders (`live.astro:128`), the nav bottom rule and the footer top rule.
* Shipped spacing literals are the 10 distinct `gap`, `padding` and `margin` values in `live.astro:72` to `live.astro:171`. Shipped radius is a single value, `0.4rem`, used three times.

The headline number is the page body control count: 25 against 1. The shipped
page asks the reader to make one decision. The prototype offers twenty five
places to click before it has said what happened.

## 5. Verdict per region

`KEEP-STORY` means it belongs in the default, restrained surface.
`KEEP-EXPERT` means it belongs behind the opt in.
`REJECT` means it does not survive in either mode in its current form.

| # | Region | Verdict | Reason |
|---|---|---|---|
| 1 | Spectral rule (`html:86`) | REJECT | It is the highest contrast element on the page and it encodes nothing. Two of its six hues, green and yellow, have no assigned role in the locked palette, so the rule teaches a colour language the rest of the page does not speak. |
| 2 | Command bar (`html:89`) | KEEP-STORY, reduced | The frame is right: a 44px hairline bar rather than a floating navbar. It carries five items plus `Stop`. Story needs run identity, truth and one action. Breadcrumb (`html:96`) and budget (`html:98`) move to Expert. |
| 3 | Rail: Causal path (`html:105`) | KEEP-STORY, relocated | These are the five beats `state.ts:126` already derives. They are the spine of the story, so they belong in the main column at readable size, not at 11px mono in a 224px sidebar. |
| 4 | Rail: Agents (`html:118`) | KEEP-EXPERT | As a persistent rail it is pure duplication of the graph nodes, including one identical string (`html:137` and `html:220`). It has one real job, being the accessible, keyboard reachable mirror of graph selection (`md:242`). That job only exists once a graph exists, so it belongs with the graph. |
| 5 | Rail: Runtime truth (`html:154`) | REJECT | A legend restating badges that are already attached to what they describe. It contributes 3 of the 14 pills and 0 new facts. |
| 6 | Outcome strip (`html:163`) | KEEP-STORY | The single best region in the prototype and the closest thing to the locked direction. It is the only place with sans type at a readable size (`css:350`), one sentence and a primary action. Reduce two buttons (`html:176`, `html:177`) to one. |
| 7 | Stage mode chips (`html:182`) | KEEP-EXPERT | `FOLLOW ON` and `EVENT TIME` are graph camera controls. They are meaningless without a graph. |
| 8 | Graph edges and labels (`html:187`) | KEEP-EXPERT | The cyan live dash and violet Warden dash are the clearest expression of "who acted" in the whole artifact. Keep the semantics at `css:589` to `css:601`; the 9px uppercase edge labels (`css:612`) need a larger size. |
| 9 | Graph nodes (`html:194`) | KEEP-EXPERT | The 3px state rail on a neutral body (`css:632`) is the correct node treatment and should be carried over unchanged. Drop `backdrop-filter: blur(10px)` (`css:629`); a blur behind an opaque canvas costs a compositor layer for no visible effect. |
| 10 | Console feed overlay (`html:243`) | KEEP-EXPERT, docked | The row grammar is worth keeping. Floating it is not: `css:744` absolutely positions it over the graph and `css:750` occludes 41% of a 360px stage. Dock it beside the graph so the two do not compete for the same pixels. |
| 11 | Inspector explanation (`html:281`) | KEEP-STORY | The summary, the incident block and the Warden block are plain language and correctly separated by hue. This content is what a first-time reader needs, and it is currently buried under a truth pill in a 344px column. |
| 12 | Inspector evidence (`html:300`) | KEEP-EXPERT | Correct values at the wrong altitude for a default view. Also fix two colour errors on the way: `--at-blue` on code keys (`css:865`) steals the selection colour, and `--at-green` on `awaiting runtime` (`css:869`, `html:310`) shows success for a value that has not arrived. |
| 13 | Event rail (`html:316`) | KEEP-EXPERT | Sequence indexing and shape coded markers are right and should survive. The count must come from the run: 13 is fabricated, the real MCP transcript is 8. Delete the second progress system (`4 / 5` at `html:106`) so one number describes position. |

## 6. What the replacement has to prove

Derived from the counts above, and checkable:

1. The Story surface presents one outcome sentence and one action. Page body control count is 1 before a run and at most 2 during one.
2. Story shows no graph, no console feed and no raw event inspector. Regions 7 through 10, 12 and 13 render only under Expert.
3. `data-mode` has real `story` and `expert` values, and the two modes render different DOM rather than the same DOM with different emphasis.
4. No fact is rendered in more than one place at a time. In particular there is exactly one progress number.
5. Every number on screen traces to a canonical event. An 8 event MCP run shows 8 events, not 13, and no latency is displayed until the event carries one.
6. The design system declares spacing and type scales, not only colour. Fewer than 60% of tokens hold colour values, and no token is declared unused.
7. Product copy is sans. Monospace is reserved for evidence: identifiers, sequences, payload keys and values.
8. `Delegation: Unknown / not observable in this runtime` survives verbatim, in both modes.

## Links

* Shipped Story page: `apps/web/src/pages/live.astro`
* Shipped state machine: `apps/web/src/features/live/state.ts`
* Rejected specification: `/Users/harryphan/Documents/ChatGPT/all things for agent/docs/design/agent-terminal-workspace.md`
* Rejected stylesheet: `/Users/harryphan/Documents/ChatGPT/all things for agent/docs/design/assets/fleetscope-agent-terminal.css`
* Rejected prototype: `/Users/harryphan/Documents/ChatGPT/all things for agent/docs/design/prototypes/fleetscope-agent-terminal.html`
