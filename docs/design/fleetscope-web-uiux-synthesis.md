# FleetScope Web UI/UX Synthesis

> **Deprecated scope:** the enterprise Case/Cockpit portions are historical.
> The current UI contract is the [Session Observer](session-observer.md).

Status: legacy Story/Cockpit reference (not the current cross-route source of truth)

Last updated: 2026-08-30

> **Precedence note:** the canonical
> [frontend experience design](fleetscope-frontend-experience.md) now owns the
> public `/` launchpad, preloader, Dashboard composition, carousel, and
> React/OriginKit decision gates. This synthesis remains the reference for
> historical evidence-first interaction ideas only. For `/live`, the
> [Agent Workspace pack](agent-workspace/README.md) is normative and overrides
> the older visual examples below.

> **Scope and supersession (2026-08-30):** The sections below preserve a prior
> visual synthesis for the `/cockpit` Story/Expert surface. The private
> CASE-1042 cloud run is the primary hackathon presentation when its evidence
> gate is verified; the recorded fixture is the fallback. These sections are not
> normative for `/` or `/dashboard` (use the canonical frontend experience),
> `/viewer` (use the Zoetrope/local-observer contract), or `/live` (use the
> Agent Workspace pack). Any `live`, `normative`, warm paper/cream, or
> whole-web `caseSequence` wording below is historical/deferred design language,
> not evidence that a runtime or deployment exists.

Historical implementation note: a prior local worktree described a warm Story
workstation, terminal command framing, deterministic agent identities, and
responsive shell hardening. Those observations are not a current readiness or
live-execution claim. React Bits roles were recreated with Astro/CSS because
the project had no React runtime and no premium license was verified. Graph,
timeline, cursor, evidence, and selection truth remain the intended contracts.

## 1. Design intent

FleetScope web should feel like an **evidence workstation** for observing and
understanding an agent system.

Three references, layered rather than blended:

- [Zoetrope](https://zoetrope.furkankly.dev/app) — the operational language:
  graph, timeline, replay, transport state, event cursor.
- [Blobatar](https://blobatar.dev/components) — the identity language: which
  agent, which actor, which state, what it is waiting on.
- [term-v0](https://www.term-v0.app/) — the product language: terminal and
  workstation frame, command-like controls, restrained technical personality.

```text
term-v0  = shell
Blobatar = identity
Zoetrope = operation
FleetScope = evidence truth
```

Not a goal: copying any of those interfaces.

## 2. Product principles

### 2.1 Evidence before decoration

Every visual treatment must help answer one of:

- What happened?
- Which agent or service did it?
- What decision was made?
- What evidence proves it?
- What is still unknown?
- Is this live or recorded?

If a styling or motion choice answers none of them, it does not ship.

### 2.2 Plain language before graph language

A first-time reader does not need renderer entry, session sequence, Ratzilla,
policy projector, agent hash, or event fold. They need:

```text
Input blocked
Retry applied
Approval required
Activation succeeded
```

The technical vocabulary stays available in Expert Mode and Decision Evidence.

### 2.3 One cursor for the CASE-1042 Cockpit Story/Expert surface

The deferred `/cockpit` Story/Expert surface uses one canonical Event Cursor,
`caseSequence`. It drives Story cards, the Proof Path, the Guided Tour, agent
topology, the graph, the timeline, the Evidence Rail, the Evidence Drawer and
URL state. This is not a whole-web contract: `/viewer` uses its local
session/renderer mapping, while `/live` follows the Agent Workspace state
contract.

Never a separate cursor for animation, and never a second one for the graph.

### 2.4 Stable identity

An agent has the same identity everywhere: `agent-orchestrator-1`,
`agent-logistics-1`, `agent-runtime`, `model-armor`, `operator@acme.example`.

Identity never depends on DOM index, renderer position, array order, viewport,
or a colour re-rolled on refresh.

### 2.5 Historical truth must look historical

Never for a recording: `online`, `thinking`, `live now`, `active`.

Instead: `recorded`, `completed`, `failed`, `waiting`, `blocked`, `approved`,
`not reached`, `unknown`.

## 3. Information architecture

```text
FleetScope
├── Dashboard          first-run setup, workspace, recent sessions, readiness
├── Agent Viewer       local session observer: rail, graph, timeline, inspector
├── Cases              Case Workspace → open Fleet Cockpit
├── Fleet Cockpit      Story Mode / Expert Mode
├── Approvals
└── Audit
```

| Route | Primary user | Primary question |
|---|---|---|
| `/` | Developer | How do I start observing a session? |
| `/viewer` | Developer, operator | What happened in this local session? |
| `/cockpit/CASE-1042` | Reviewer, operator | What happened in this Case and what proves it? |
| `/audit/CASE-1042` | Security reviewer | Can I inspect the complete evidence record? |

Dashboard and Story Mode use the most approachable visual language. Agent Viewer
and Expert Mode use the most technical.

The Dashboard/recent-session and Cockpit entries in this historical map are
illustrative only. Current launchpad and Dashboard state, including what the
browser may discover, is owned by the canonical frontend experience; a browser
must not infer a live or recent local session that the user has not selected.

## 4. Global application shell (deferred visual reference)

term-v0 is the shell reference: warm paper background, restrained CRT texture,
terminal-window framing, small window controls, monospaced utility labels,
compact command controls, clear copy buttons, generous space.

This warm paper/terminal treatment is retained for the deferred Story/launchpad
discussion only. It does not apply to `/live` (the near-black Agent Workspace
contract), `/viewer`'s operational graph, or any Decision Evidence surface;
the canonical frontend experience owns the public shell tokens.

Do not apply CRT effects over dense evidence content.

```text
┌──────────────────────────────────────────────────────────────┐
│ FleetScope      Dashboard  Viewer  Cases  Cockpit  Audit     │
│ workspace: acme-procurement                 RECORDED         │
└──────────────────────────────────────────────────────────────┘
```

The header always shows product identity, current workspace or Case, current
mode, current execution state, navigation, and a focus-visible active item.

Every page with recorded content shows exactly one execution state:

```text
Recorded · at latest event
Historical · recorded evidence, nothing is executing
Playing · recorded evidence
Unavailable · evidence could not be loaded
```

Never `SYSTEM READY` while a readiness check is still running.

## 5. Colour and theme (historical/deferred palette)

Two layers.

The palette below is a prior composition reference, not a global requirement.
Use the canonical frontend experience for `/` and `/dashboard`, and the Agent
Workspace pack for `/live`; do not introduce a cream/paper outer layer into the
local `/viewer` graph or evidence surfaces.

**Outer application layer** — Dashboard, Story Mode, navigation, forms, command
cards, empty states:

```text
paper       #f2f0e9
paper-dark  #e7e3da
ink         #151515
muted       #74736d
line        rgba(21, 21, 21, .14)
accent      #d7b735
```

**Operational terminal layer** — Expert graph, timeline, renderer, dense event
inspector, low-level replay controls:

```text
terminal       #0c0d0c
terminal-2     #161716
terminal-line  rgba(255, 255, 255, .14)
terminal-text  #eee9db
terminal-muted #8c8a80
```

**Semantic states:**

```text
success  #5fbd79
warning  #e3a72f
danger   #de655f
info     #72a7d8
unknown  #8b8b84
```

Every state carries text, an icon or shape, colour, and an accessible name.
Colour alone is never sufficient.

## 6. Typography

Three roles only.

- **Display** — a restrained serif for page title, Story outcome, major empty
  state.
- **Body** — readable sans-serif for explanations, labels, instructions,
  narrative.
- **Technical** — monospace for event IDs, agent IDs, Case IDs, timestamps,
  commands, keyboard shortcuts, policy versions, evidence values.

Never a serif for dense operational content.

## 7. Dashboard

A calm entry point, not an operations wall. The wireframe is a historical,
deferred composition example; it does not authorize recent/live session claims.

```text
┌──────────────────────────────────────────────────────────────┐
│ FleetScope / Dashboard                         workspace     │
├──────────────────────────────────────────────────────────────┤
│ Observe your agent work                                      │
│ Local sessions stay local. FleetScope does not start runs.   │
│ [Choose workspace]   [Check adapter]                         │
├──────────────────────────────┬───────────────────────────────┤
│ Setup status                 │ Recent sessions               │
│ ✓ Workspace selected         │ ● CASE-1042 / recorded        │
│ ✓ Adapter available          │ ● session-2026-08-29          │
│ ○ First session              │                               │
├──────────────────────────────┴───────────────────────────────┤
│ Observe · Playback · Safety controls                         │
└──────────────────────────────────────────────────────────────┘
```

term-v0 contributes the terminal-card frame, command-style setup actions, a
copyable CLI command, subtle texture, a concise headline.

A first-time user must learn what to click first, whether FleetScope controls
the run, which adapter is active, why a session is unavailable, and how to get
back to a recent session. In the current product, only a bundled recording or a
user-selected local session may be shown; capability/live cards require a fresh
verified response as specified by the canonical frontend experience.

## 8. Agent Viewer (local observer; current route contract)

The technical observer.

**From Zoetrope:** dark dotted canvas, agent node cards, visible edges, minimap,
bottom timeline, transport state, replay controls, keyboard shortcuts, centered
session/file modal.

**From Blobatar:** identity in the DOM rail. The avatar supports scanning and
never replaces the readable agent name.

```text
[identity] hotel_search
           failed · 8 events · 1 failed call
           last action: search_hotels
```

`/viewer` is a local-session observer: no governance claims, no Warden claim, no
Model Armor claim, no vendor activation claim, no live execution language. The
local-session limitation is stated once.

## 9. Fleet Cockpit — Story Mode (deferred enterprise reference)

> This section is a recorded/private-proof storyboard retained for future
> `/cockpit` work. It is not the current `/viewer` surface and does not define
> `/live`; the Agent Workspace pack takes precedence there.

The business-readable surface. The graph is never the first visual element.

```text
Case header
Recorded label
Outcome
Summary
Proof Path
Four evidence cards
Guided Tour
Problem / Action / Result
Open Expert Mode
```

```text
┌──────────────────────────────────────────────────────────────┐
│ CASE-1042 / Northwind Components GmbH                        │
│ ● Recorded CASE-1042 evidence — nothing is executing         │
├──────────────────────────────────────────────────────────────┤
│ Case completed                                               │
│ 4 of 4 governance controls are evidenced in 60 events.       │
├──────────────────────────────────────────────────────────────┤
│ Delegate → Remember → Screen → Recover → Approve → Activate  │
├──────────────────────────────────────────────────────────────┤
│ [Screened] [Recovered] [Runtime applied] [Activated]         │
├──────────────────────────────────────────────────────────────┤
│ Guided Evidence Tour                          [Start tour]   │
├──────────────────────────────────────────────────────────────┤
│ What happened · What FleetScope observed · Result            │
│ [Open Expert Mode]                                           │
└──────────────────────────────────────────────────────────────┘
```

### Proof Path

Canonical chronology, always:

```text
Delegate → Remember → Screen → Recover → Approve → Activate
```

It is drawn as a connected sequence, and a connector reads as "this happened,
then this" — so the display order is itself a claim about time and must be the
real order. A test asserts the anchors are strictly increasing.

Each step is a native button with a visible state and an event reference, seeks
the canonical cursor, highlights the related card, does not open the drawer, and
preserves keyboard focus.

### Evidence cards

One state each: `evidenced`, `absent`, `unavailable`, `unsupported`. An
evidenced card replaces its absence card; the two never coexist.

```text
┌ ● ● ● INPUT SCREENING ─────────── Event 16 ┐
│ Input screened before it reached the agent  │
│ Model Armor blocked input-101.              │
│ No tool request or memory write followed.   │
│ [View evidence] [Show in Expert Mode]       │
└─────────────────────────────────────────────┘
```

## 10. Guided Evidence Tour (deferred Cockpit interaction)

The main creative interaction: term-v0's window, Blobatar's actor identity,
Zoetrope's event seeking.

```text
┌ ● ● ● GUIDED EVIDENCE TOUR ───────── 3 / 6 ┐
│ [Model Armor identity]                      │
│ Unsafe vendor input was stopped before use  │
│                                             │
│ What happened                               │
│ A prompt injection over vendor email was    │
│ blocked.                                    │
│ Why it matters                              │
│ The input never became memory and triggered │
│ no tool request.                            │
│                                             │
│ Event 16 · evt-0016                         │
│ [Back] [Next] [View evidence] [Expert Mode] │
└─────────────────────────────────────────────┘
```

Rules: never autoplays; the reader controls Next and Back; every step seeks a
real event; the current step follows the Event Cursor; identity is
deterministic; Expert Mode opens at the same event; the URL restores the step;
reduced motion disables transitions; the tour never claims evidence the adapter
did not produce.

```text
/cockpit/CASE-1042?mode=story&event=15&tour=screen
```

`mode=story|expert`, `event=<caseSequence>`, `tour=<tour-step>`. This URL
contract is deferred to `/cockpit` only; it is not a `/viewer` or `/live`
contract. No renderer entry index and no renderer hash belongs in that URL.

## 11. Fleet Cockpit — Expert Mode (deferred Cockpit interaction)

A technical inspection surface, not a second product.

```text
┌──────────────────────────────────────────────────────────────┐
│ ● ● ● CASE-1042 EXPERT       Historical · Event 36 of 60      │
├──────────────┬───────────────────────────┬───────────────────┤
│ Agent rail   │ Graph / topology          │ Decision Evidence │
│ identities   │ Zoetrope renderer         │ IDs / policy      │
├──────────────┴───────────────────────────┴───────────────────┤
│ Canonical timeline / markers / playback controls             │
└──────────────────────────────────────────────────────────────┘
```

**Story → Expert:** preserve `caseSequence`; reveal and measure the canvas
before the WASM mount; keep the tour step; focus the Expert heading or current
evidence; never jump to the latest event; never show a blank canvas caused by
hidden layout.

**Expert → Story:** preserve cursor, selected actor if still valid, and URL;
return focus to the Story mode control.

## 12. Blobatar integration rules

Use the visual ideas, not necessarily the package.

Do: one Astro-native `AgentIdentity` component; deterministic SVG/DOM output;
stable seed from the canonical agent ID; no React dependency for avatars alone;
a readable label beside every avatar; service glyphs for Armor, Runtime, Gateway
and Memory Bank; a human glyph for operator approvals.

Do not: random avatars per render; avatar-only rows; avatar colour as the only
state; `online` for a recorded agent; playful animation on a security failure or
an approval denial.

## 13. term-v0 integration rules

Use for: the application shell, window headers, command blocks, copy
affordances, subtle paper texture, concise serif headings, terminal-style
controls, examples and empty states.

Do not use for: every small badge; dense evidence values; error text that needs
maximum contrast; graph labels; screen-reader-only information.

## 14. Motion

Motion communicates state change.

| Interaction | Motion |
|---|---|
| Proof Path selection | 160ms highlight movement |
| Tour step change | 160–200ms content transition |
| Story → Expert | 220ms panel reveal |
| Drawer open | 180ms slide |
| Agent selection | subtle identity highlight |
| Failure transition | one short emphasis |
| Historical playback | renderer-controlled |
| Reduced motion | immediate state change |

Never: endless CRT flicker, continuous avatar blinking, particles, parallax,
animated noise behind text, or motion that makes recorded data look live.

## 15. Accessibility

```text
Tab       move through controls
Enter     activate focused button
Space     activate focused button
Escape    close drawer / clear selection
← / →     move Guided Tour step
?         show keyboard help
```

Native buttons and links; visible focus ring; `aria-current` for active
Story/Expert mode; `aria-pressed` for a selected agent; one polite live region
for cursor and tour announcements; drawer focus trap and restoration; no state
by colour alone; meaningful accessible labels on avatars; hidden Expert Mode
removed from the accessibility tree; reduced motion tested separately.

## 16. Responsive

| Width | Story | Expert |
|---|---|---|
| 1440×900 | four card columns, full Proof Path | rail / graph / evidence rail |
| 1280×720 | two card columns | evidence may collapse into a drawer; graph primary |
| 1180×800 | two card columns, Proof Path scrolls horizontally | rails stack or become drawers |
| Mobile | one card per row, Proof Path scroll/snap | secondary |

No horizontal body overflow at any width. Labels never wrap into unusable
heights. Evidence fields stack vertically on mobile.

## 17. Component inventory

```text
Shell     AppShell, TopNavigation, ExecutionModeBadge, TerminalWindow,
          CommandCopy, StatusBadge, EmptyState, FocusRing
Story     StoryPanel, StoryOutcome, ProofPath, ProofCard,
          GuidedEvidenceTour, StoryNarrative, ModeSwitch
Identity  AgentIdentity, AgentStatus, AgentRailRow, ServiceIdentity,
          HumanIdentity
Expert    CockpitMount, AgentTopology, GraphCanvas, Timeline, EvidenceRail,
          EvidenceDrawer, TransportControls, Minimap
```

Every component must distinguish: `loading`, `checking`, `ready`, `recorded`,
`historical`, `failed`, `unavailable`, `unsupported`, `empty`.

## 18. Implementation boundaries

**Rust/WASM owns** graph topology, renderer state, playback, renderer selection,
the deterministic fold, manifest translation, canonical-to-renderer mapping.

**TypeScript/Astro owns** page layout, Story presentation, route state,
card and chapter controls, URL synchronisation, accessibility, the responsive
shell, evidence drawer presentation.

**The adapter owns** canonical evidence predicates, capability facts, card
state, event IDs, `caseSequence` destinations, and narrative copy derived from
evidence.

No UI component may infer a governance result from configuration, service
presence, graph position, timestamps alone, DOM order, renderer array index, or
missing data treated as zero.

## 19. Acceptance criteria (CASE-1042 Cockpit reference)

These checks apply when the `/cockpit` Story/Expert surface is used. They are not
a substitute for the mandatory Gemini 3.5+/Google
framework/Google Cloud proof gate or for the local `/viewer` QA contract.

**Visual** — Story Mode readable without opening Expert Mode; Expert Mode
recognisable as the operational Zoetrope surface; agent identity stable across
Story, rail and drawer; term-v0 styling coherent rather than scattered; readable
contrast on important copy.

**Interaction** — a Story card seeks the correct canonical event; the Proof Path
follows canonical chronology; Guided Tour Next/Back work by mouse and keyboard;
Expert Mode preserves the cursor; the drawer opens the claimed event; agent
selection never shows foreign evidence; reload restores mode and event; Escape
and focus restoration work.

**Responsive** — no body overflow at 1440×900, 1280×720, 1180×800; the Proof
Path never wraps into unusable rows; the canvas has positive dimensions when
Expert Mode is visible; hidden Expert Mode never mounts against a zero-width
host.

**Honesty** — recorded never reads as live; absent is not presented as failure;
unavailable is not presented as absent; unsupported is not presented as
satisfied; no chain-of-thought or raw secrets; no enterprise claim on `/viewer`.

## 20. Deliberate non-goals

Demo video, pitch deck, presentation script, and live provider implementation
remain out of scope for this legacy visual reference (the private live proof is
still mandatory for hackathon submission and is specified in the canonical
[frontend experience design](fleetscope-frontend-experience.md), section 13).
React migration of the evidence surfaces, React Bits installation, direct canvas
hit-testing without a deterministic ABI, new governance capabilities, simulated
user research, and invented visual evidence also remain out of scope here.
Public landing copy and carousel decisions live in the canonical frontend
experience design.

## Links

- [Canonical frontend experience](fleetscope-frontend-experience.md)

- [Agent Workspace normative pack](agent-workspace/README.md)

```text
term-v0 makes it memorable.
Blobatar makes agents recognizable.
Zoetrope makes operations inspectable.
Canonical evidence makes it trustworthy.
```
