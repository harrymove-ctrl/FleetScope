# Phase 8: the visual token system

## Why this document exists

Phases 2, 3 and 4 settled how many hues may coexist, how many regions the reader
gets, what the type ladder must be, and which twelve states exist. None of them
named a hex value, a pixel size or a duration. Phase 2 section 3.3 fixed the type
ladder and phase 3 section 7 item 3 explicitly deferred every colour value here.
This document supplies those values and nothing else.

It is a translation layer, not a design phase. Where an earlier document set a
budget, that budget is quoted and used. Where an earlier document set a number,
this document does not move it. Everything new here is either a measurement of
something that already exists in the repository, or a value derived from one.

The review that commissioned this work rejected the previous attempt for treating
"Antigravity-like" as a colour swap. Phase 2 section 3.4 proved arithmetically why
a swap cannot work: replace all 23 hex values in the rejected artifact and its 8
regions, 31 borders, 1.08 adjacent type ratio and 7 animations are all still
there. So a token file is not the fix and this document does not claim to be one.
It is the part of the fix that has to be exact, and being exact about colour is
worth doing precisely because colour is not where the problem was.

**What this document may not do.** It may not introduce a region, a control, a
label or a state. If a token here implies a piece of structure that phases 3 and 4
did not settle, the token is wrong.

## 0. Reconciliation with the shipped stylesheet

### 0.1 What is already there

`apps/web/src/styles/global.css` declares 32 custom properties on `:root`, plus
12 more inside the pastel agent avatar rules that phase 0 finding 2 identified as
in-flight rejected work. The 32 are the real inheritance. Measured at HEAD and in
the dirty worktree, the `:root` block is byte identical, so there is one baseline
to reconcile against and it is not in dispute.

What it contains, and what it does not:

| Category | Tokens | Count |
|---|---|---|
| Surfaces | `--fs-bg`, `--fs-surface`, `--fs-surface-raised`, `--fs-surface-sunken` | 4 |
| Borders | `--fs-border`, `--fs-border-strong` | 2 |
| Ink | `--fs-text`, `--fs-text-muted`, `--fs-text-faint` | 3 |
| Status hues | `--fs-ok`, `--fs-warn`, `--fs-deny`, `--fs-info`, `--fs-unknown`, `--fs-accent` | 6 |
| Status tints | `--fs-ok-bg`, `--fs-warn-bg`, `--fs-deny-bg`, `--fs-info-bg`, `--fs-neutral-bg` | 5 |
| Spacing | `--fs-space-1` through `--fs-space-6` (4, 8, 12, 16, 24, 32) | 6 |
| Radius | `--fs-radius` 6px, `--fs-radius-sm` 4px | 2 |
| Shadow | `--fs-shadow-drawer` | 1 |
| Families | `--fs-font`, `--fs-mono` | 2 |
| Layout | `--fs-nav-height` 48px | 1 |

**There is no type scale token and no line height token.** The stylesheet issues
75 `font-size` declarations across 15 distinct values, six of which sit between
9.5px and 12.5px. Six `font-weight` values are in use: 450, 550, 600, 620, 650 and
700. That is the same failure phase 2 section 3.2 item 4 diagnosed in the rejected
prototype, present in the shipped stylesheet as well, and it is why typography is
the one category where the workspace layer has to declare rather than reuse.

**There is no cyan, no violet and no orange.** `--fs-accent` and `--fs-info` hold
the same value, `#6b9ce0`. The only warm hue is `--fs-warn` `#d5a03c`, an amber
that already carries three unrelated meanings across the app.

### 0.2 Tokens that already exist under a different name

The required reconciliation. For each thing the workspace needs, whether the
repository already has it, under what name, and what to do.

| Workspace need | Already exists as | Verdict | Why |
|---|---|---|---|
| Near black workspace ground | `--fs-bg` `#0d1014` | **Reuse the existing name** | Already near black. A second near black would be a third theme in an app that already has two, which is phase 0 finding 6. |
| Raised surface | `--fs-surface` `#14181e` | **Reuse the existing name** | One step up, which is the depth rule the stylesheet header already states. |
| Evidence surface | `--fs-surface-sunken` `#101418` | **Reuse the existing name** | Evidence is recessed, not raised. It is the thing the reader looks into, and sunken is the existing token that says so. |
| Hairline border | `--fs-border` `#262d36` | **Reuse the existing name** | See section 5.2 for the measured limit on what it can carry. |
| Boundary border | `--fs-border-strong` `#333c47` | **Reuse the existing name** | |
| Ink, three levels | `--fs-text`, `--fs-text-muted`, `--fs-text-faint` | **Reuse the existing names** | All three clear AA on all four surfaces. Measured in section 2.2. |
| Blue, selection and CTA | `--fs-accent` `#6b9ce0` | **Reuse the existing name** | `--fs-accent` is already bound to exactly this meaning: `a { color }` and `:focus-visible { outline }` both use it and nothing else does. |
| Sans family | `--fs-font` | **Reuse the existing name** | |
| Mono family | `--fs-mono` | **Reuse the existing name** | |
| Spacing 4 to 32 | `--fs-space-1` to `--fs-space-6` | **Reuse the existing names** | |
| Radius | `--fs-radius`, `--fs-radius-sm` | **Reuse the existing names** | |
| Cyan, live | nothing | **New token** | |
| Violet, Warden | nothing | **New token** | |
| Orange, Controlled Fault | `--fs-warn` `#d5a03c` is the nearest | **New token, do not reuse** | Amber already means warn, historical transport and fallback in three unrelated places. Binding a fourth meaning to it would make the one hue whose meaning is a single specific event kind the one hue with four meanings. |
| Spacing 48 and 64 | nothing | **New tokens** | The scale stops at 32px, which cannot separate a 36px headline from anything. |
| Type scale, five steps | nothing | **New tokens** | |
| Prose measure cap | nothing | **New tokens** | The whole stylesheet has no measure token. |
| Motion duration | nothing | **New tokens** | Four hardcoded durations exist: 420ms, 160ms, 700ms and 1.6s. |

### 0.3 The rename that is refused, and why

The tempting move is to alias everything: `--aw-bg: var(--fs-bg)`, and so on
down the list, so the workspace reads in one consistent vocabulary. That is
refused.

Aliasing creates two live names for one value. The next person to change the
ground colour has to know that `--aw-bg` exists, is not authoritative, and must
not be edited. Worse, an alias is where a fork begins: the moment someone gives
`--aw-bg` its own literal to solve a local problem, the workspace has silently
become a third theme, which is the exact mistake `viewer.astro` already made when
it declared `--viewer-blue: #4285f4` and `--viewer-violet: #8b5cf6` beside a
global palette that has neither.

So the policy is narrow and greppable:

> **The workspace layer declares a token only when no existing token holds that
> value. Everything else is consumed under its existing `--fs-` name. The
> workspace may read any `--fs-` token and may never write one.**

The last clause is the one that matters. A shared component rendered inside the
workspace subtree, `StatusBadge` for example, resolves `--fs-accent` at its own
call site. If the workspace redefined `--fs-accent` locally, that component would
silently render a different colour inside the workspace than outside it, and no
selector in either file would show why. Forbidding the write closes that hole.
The check is one grep, and the pattern has to be anchored and include digits or
it passes on a file that writes `--fs-space-1:`:
`^\s*--fs-[a-z0-9-]*\s*:`. `11` and `12` G6.6 use this form; an earlier draft
of this sentence used `--fs-[a-z-]*:`, which matches no numbered token and would
have let the whole spacing scale through.

Net result: **13 new tokens**, of which 6 hold colour: 3 hues and their 3 chip
tints. That is 46 percent colour by count, against the rejected artifact's 78
percent measured in phase 1 finding 7 and the 60 percent ceiling that phase 1
section 6 set. Counting the tints as colour is the honest count even though they
are derived from the hues, because they are three more values that can drift.

### 0.4 Two naming collisions found

* **`.story__` is taken.** `global.css`, `StoryPanel.astro` and `viewer.astro`
  all own `.story__` selectors, and they belong to the dashboard story panel, not
  to Story Mode. The workspace must not use that prefix. `.aw-` is free: no match
  for `.aw-`, `aw__` or `--aw-` exists anywhere in `apps/web/src` or `scripts`.
* **`data-mode` is taken, and that is fine.** `StoryPanel.astro:45` already sets
  `data-mode="story"` and `CockpitMount.astro:202` reads `data-mode="expert"`.
  The workspace uses the same attribute with the same two values on a different
  element. Reusing the vocabulary is correct; inventing `data-view` beside it
  would give the codebase two words for one idea, which is what phase 1 finding 9
  found four times over in the rejected artifact.

### 0.5 The route that will not inherit anything

`live.astro` styles reference `var(--border, #263247)`, `var(--surface-raised,
#182131)` and `var(--accent, #4c8dff)`. None of those three names is declared
anywhere, so all three resolve to their fallback literals, and all three
literals differ from the real values: `#263247` against `--fs-border` `#262d36`,
`#182131` against `--fs-surface-raised` `#1a1f26`, `#4c8dff` against
`--fs-accent` `#6b9ce0`. The page is therefore already running a fourth palette
by accident.

This is stated here because it changes the cost estimate. Retheming does not
require rewriting `live.astro`'s styles; it requires correcting six `var()`
references across three undeclared names, at lines 88, 89, 94, 109, 129 and 133,
after which the page inherits everything in this document for free. It is the
cheapest item in the whole programme and it is a prerequisite for every other
item.

## 1. Scoping mechanism

### 1.1 Requirement

The new layer must not be able to change any existing route. The worktree is
carrying live work on `/dashboard`, `/viewer`, `/` and `global.css` from other
agents, and the browser QA counts elements on `/dashboard` by selector. A token
layer that leaks would fail checks that have nothing to do with it.

### 1.2 The mechanism, in two layers

**Layer one, file scope.** The tokens live in
`apps/web/src/styles/workspace.css`, imported by the workspace route only, never
by `BaseLayout.astro`. Astro's static build emits it into that route's bundle, so
no other page downloads it.

**Layer two, selector scope.** Every declaration in that file sits under the
single class selector `.aw`. **Amended by `10` D46: `.aw` goes on a wrapper that
contains both the command bar and `#live-root`, not on `#live-root` itself.**
The reason is a collision the first draft did not see. `12` G1.1 and P7 cap the
direct children of `#live-root` that render a box at three, and those three are
regions A, B and C, so the command bar cannot be inside `#live-root`. `09`
section 4.1 makes that bar the only chrome in Story Mode and `05` section 2 draws
it above the story body. Putting `.aw` on `#live-root` therefore leaves the mode
switch outside the token scope, unable to resolve `--aw-space-7`,
`--aw-measure-body`, `--aw-motion-*` or any of the three new hues, while `11`
phase 6 still requires it to write `data-mode` on `#live-root`. The wrapper
resolves it: the token scope and the region container become two different
elements, each named explicitly wherever it is counted. Custom properties
inherit, so every descendant of the wrapper resolves them, and nothing outside
the subtree can see them.

```css
/* apps/web/src/styles/workspace.css */
.aw {
  --aw-cyan: #5cc8d8;
  /* ... */
}
```

```html
<!-- the two elements, and which check reads which -->
<div class="aw">                 <!-- token scope. G6.6 greps this file      -->
  <div class="aw__bar">…</div>   <!-- RunCommandBar: mode switch, run id     -->
  <section id="live-root"        <!-- region container. G1.1 and P7 count    -->
           data-mode="story"     <!-- its direct children. G3.1 reads this.  -->
           data-state="unavailable">
    …A, B, C…
  </section>
</div>
```

### 1.3 Why both layers, when either would nearly do

File scope alone is one line from failing. Adding an import to `BaseLayout.astro`
is a plausible and easy mistake, and if the file declared its tokens on `:root`
the mistake would reach every route silently, because a token override produces
no error and no visual warning at the point of the change.

Selector scope alone works but ships bytes to routes that will never use them,
and it leaves the tokens resolvable from a devtools inspector on any page, which
invites exactly the future misuse the policy is trying to prevent.

Together they fail safe in both directions: a stray global import changes
nothing because no existing element matches `.aw`, and a stray `.aw` class on
another page changes nothing because the file is not loaded there.

**The corollary `11` phase 7 has to obey.** Because the file is not loaded on
`/viewer`, `--aw-violet` does not resolve there and a declaration using it is
dropped by the cascade. `10` D50 rules that `/viewer` does not import
`workspace.css` and does not carry `.aw`; the Warden hue on that route comes from
an `--fs-` token or the route does not paint one. Writing
`var(--aw-violet, #a78bfa)` instead would reintroduce the literal beside a token
that section 0.3 rejects `viewer.astro:173-174` for.

### 1.4 Three rules the file must obey, each checkable by grep

1. **No `:root` and no `html` or `body` selector.** These are the only selectors
   that can escape the subtree. Check: the file contains no `:root`.
2. **No element selectors.** No bare `h1`, `p`, `button`, `ol`. A descendant
   element rule inside `.aw` is safe, but a bare one is a habit that produces an
   unsafe one later. Every rule begins with `.aw`.
3. **No `--fs-` declaration.** Section 0.3. Check: no line matches
   `^\s*--fs-[a-z0-9-]*\s*:`.

### 1.5 Why not Astro's own scoping

Astro 5.18 scopes a component's `<style>` block by stamping `data-astro-cid-*` on
that component's own elements. That is real scoping and `live.astro` already
benefits from it. It is not sufficient here for two reasons.

First, custom properties are not selector scoped. A `<style>` block that declares
`--aw-cyan` on `.live` still leaks that property to every descendant including
child components, which is exactly what we want, but Astro's cid attribute is not
what produces that behaviour and cannot constrain it. The `.aw` selector is doing
the work either way, so making it explicit is honest about the mechanism.

Second, the tokens have to be readable by more than one component. Expert Mode's
graph host, evidence surface and event rail are separate components under
phases 5 to 7. A per component `<style>` block would need the token set copied
into each one, and the first copy to drift is the first bug nobody can see.

## 2. Surfaces

### 2.1 The four surfaces

All four already exist. No new value.

| Token | Hex | Role in the workspace |
|---|---|---|
| `--fs-bg` | `#0d1014` | The workspace ground. Story Mode paints almost nothing else. |
| `--fs-surface` | `#14181e` | The one raised step. Expert Mode panels. |
| `--fs-surface-sunken` | `#101418` | Evidence. Mono content sits here, recessed. |
| `--fs-surface-raised` | `#1a1f26` | Not used by the workspace. |

`--fs-surface-raised` is deliberately excluded. The stylesheet's own header
comment states the rule: "a panel two steps above its parent reads as a different
product". The workspace has one ground and one step, which means depth carries
exactly one distinction and cannot be misread. Excluding a token is a decision,
so it is recorded rather than left implicit.

### 2.2 Contrast, measured

Every ink against every surface, computed with the WCAG 2.x relative luminance
formula. AA is 4.5:1 for body text and 3:1 for text at 18.66px bold or 24px
regular and above.

| Ink | on `#0d1014` | on `#14181e` | on `#101418` | on `#1a1f26` | AA body |
|---|---|---|---|---|---|
| `--fs-text` `#e7ebf1` | 15.94 | 14.88 | 15.46 | 13.84 | pass |
| `--fs-text-muted` `#98a3b2` | 7.46 | 6.97 | 7.24 | 6.48 | pass |
| `--fs-text-faint` `#858fa0` | 5.84 | 5.46 | 5.67 | 5.07 | pass |

The stylesheet header claims all three clear AA on every surface including the
lightest. The claim is accurate. The worst case in the table is 5.07:1, which
still leaves 0.57 of headroom, so the ink ramp is not a constraint on anything
here.

Worth stating because it changes a design decision: since the faint ink clears AA
at 5.07:1, **the workspace has no reason to lower opacity on any text.** Opacity
is how a designer usually makes something secondary, and it is how the shipped
`/live` page does it: `.live-beat__status` uses `opacity: 0.8` and
`.live__facts dt` uses `opacity: 0.75`, both of which move a measured, passing
contrast to an unmeasured one. Use the ink ramp instead. It is three verified
levels and it is free.

### 2.3 Borders, and what they cannot do

| Token | Hex | vs `#0d1014` | vs `#14181e` |
|---|---|---|---|
| `--fs-border` | `#262d36` | 1.37 | 1.28 |
| `--fs-border-strong` | `#333c47` | 1.71 | 1.59 |

Neither reaches 3:1, the WCAG 1.4.11 threshold for a non text boundary that
identifies a control. Reaching it on this ground needs roughly `#5b6a7e`, which
measures 3.46:1 and is visibly a light grey line on near black.

This is a measurement, not an opinion, and it settles the border policy on its
own. There are two ways to have a border that identifies a control, and both are
worse than the third option:

1. Keep the quiet border and let it fail 1.4.11. The control's boundary is then
   not perceivable to a low vision reader, and the review's "one obvious action"
   is obvious only to some readers.
2. Raise the border to `#5b6a7e`. It now passes, and it is loud. Multiply by the
   number of bordered things and the surface is a grid of light grey boxes, which
   is the SOC dashboard the review rejected.
3. **Give the one control a solid fill instead of a border, and give everything
   else no border at all.** A filled control passes 1.4.11 on its own fill
   contrast, and the surface has no grey boxes because it has no boxes.

Option 3 is what section 5.2 specifies. The point is that "very few borders" is
not only a taste position inherited from the review. On this ground colour, a
border quiet enough to be tasteful is too quiet to be accessible, so the honest
choices are a loud border or almost none.

## 3. Typography

### 3.1 The ladder

Fixed by phase 2 section 3.3. Reproduced with the line heights, weights and
tracking this document adds.

| Step | Size | Family | Weight | Line height | Tracking | Case |
|---|---|---|---|---|---|---|
| Outcome | 36px | `--fs-font` | 600 | 1.15 | -0.01em | sentence |
| Section lead | 21px | `--fs-font` | 500 | 1.30 | 0 | sentence |
| Body | 15px | `--fs-font` | 400 | 1.55 | 0 | sentence |
| Evidence | 12.5px | `--fs-mono` | 400 | 1.60 | 0 | as written |
| Label | 11px | `--fs-mono` | 500 | 1.40 | 0.08em | uppercase |

Ratios, all computed: 36 / 21 = 1.71, 21 / 15 = 1.40, 36 / 15 = 2.40, 15 / 12.5 =
1.20, 12.5 / 11 = 1.14.

The two gates phase 2 set are 1.25 minimum between sans steps and 2.40 minimum
top to body. Both sans gaps clear the first (1.71 and 1.40) and the third is
exactly 2.40. The two mono steps sit at 1.14, below the gate on purpose: phase 2
section 3.3 states they are one voice at two jobs, separated by case and tracking
rather than by size, so the size gate does not apply to them and neither does the
claim that they are two levels.

### 3.2 Why body is 15px when the app body is 14px

`global.css` sets `body { font-size: 14px }`. The workspace sets 15px inside
`.aw`. That is a deliberate, scoped deviation and it needs a reason better than
preference.

At 14px the body to evidence ratio would be 14 / 12.5 = 1.12. Phase 2 section 3.2
item 4 identified ratios near 1.08 as the rejected artifact's core typographic
failure, because a size difference that small is not perceived as a level at all.
Setting body at 15px moves that gap to 1.20 and, more importantly, keeps the top
to body ratio at exactly the 2.40 that phase 2 locked. At 14px it would be 2.57,
which sounds better and is not: it would mean the headline had grown relative to
everything else rather than the body having room.

The separation between body and evidence is still carried primarily by typeface,
per section 3.3. The 1.20 ratio is there so that typeface is not carrying it
alone.

### 3.3 The rule: sans for product copy, mono for evidence

**Product copy is sans. Evidence is mono. There is no third case.**

Product copy means anything FleetScope wrote: the outcome sentence, the beat
labels, the delegation line, the button, the awaiting agent lines. Evidence means
anything the run produced and FleetScope is quoting: run ids, event sequence
numbers, tool names, the incident reason as returned, the policy rationale as
returned, and the command the developer types into their own CLI.

The rule is load bearing rather than decorative, and the reason is specific to
this product. FleetScope's claim is that it does not fabricate. A reader who can
tell at a glance which strings the product wrote and which strings the run
produced can audit that claim without reading carefully. If product prose is set
in mono the distinction is gone, and phase 1 finding 3 measured exactly that
failure in the rejected artifact: 23 of its 26 font family declarations resolved
to mono, so every string on the page looked like output and none of it could be
checked.

Two consequences worth naming:

* The awaiting agent screen shows a command the developer must type. That command
  is mono because it is a literal string with exact characters that matter. The
  sentence introducing it is sans. Both appear in the same block and the typeface
  is the only thing telling the reader which one they can retype.
* A truth label is product copy. `TRUTH_LABEL` maps to the words `Live`,
  `Controlled Fault`, `Recorded`, `Unknown` and `Unavailable`, which FleetScope
  chose. They are sans. The event that carries the truth is mono.

### 3.4 Weights

Three weights in the whole workspace: 400, 500, 600. The shipped stylesheet uses
six, including 450, 550, 620 and 650, which a variable font would honour and the
system font stack in `--fs-font` will mostly round. Rounding means the intended
distinction sometimes appears and sometimes does not, which is worse than not
attempting it. Three weights that always render are more hierarchy than six that
sometimes do.

### 3.5 Measure

| Token | Value | Applies to |
|---|---|---|
| `--aw-measure-sentence` | `46ch` | The outcome sentence only. **Renamed and re derived by `10` C17**; this row read `--aw-measure-outcome: 34ch` in the first draft, sized by wrapping the 133 character `completed` sentence at 36px, which C17 moved to 21px. |
| `--aw-measure-body` | `62ch` | Every other prose block |

Sized against the real copy rather than a guideline. The longest sentence in
`state.ts` is the `completed` sentence, 20 words and 133 characters: "The
governed read failed once by design, the Warden authorised one idempotent retry,
and the retry returned the authoritative result." At 34ch it wraps to 4 lines,
which is about 166px tall at 36px and 1.15.

**That arithmetic is why the derivation changed.** `10` C17 read the same four
line block as a paragraph rather than a focal point and moved the sentence to
21px, giving the 36px step to a one to three word headline instead. `10` C9 then
drops `authoritative`, leaving 121 characters. At 21px and 46ch the sentence
lands in the three lines `05` drew, and the focal object is the headline above
it. The token is `--aw-measure-sentence: 46ch`.

`ch` rather than `px` because the cap is a character measure. Expressed in pixels
it would have to be recomputed for every step in the ladder and would drift the
moment the font stack resolved differently on another machine.

Every prose block is capped. Phase 2 section 3.1 found exactly one `max-width` in
the rejected artifact's 1219 lines of CSS, and section 3.2 identified that as the
mechanical cause of its missing negative space: nothing was ever permitted to end
before its container did.

## 4. Semantic colour

### 4.1 The four hues

| Token | Hex | HSL | Meaning | Painted only when |
|---|---|---|---|---|
| `--fs-accent` | `#6b9ce0` | h215 s65 l65 | Selection and primary action | The primary action is enabled |
| `--aw-cyan` | `#5cc8d8` | h188 s61 l60 | Live, at run level | **At least one canonical event exists and the run is not finished.** Never while `events.length === 0` (D40) |
| `--aw-violet` | `#a78bfa` | h255 s92 l76 | The Warden acted | An `intervention` event exists |
| `--aw-orange` | `#e8975c` | h25 s75 l64 | Controlled Fault, and nothing else | A `controlled_fault` event exists |

Contrast on the workspace ground, and on the 12.16 percent tint each hue forms
over that ground when used as a chip. The tint alpha is `1f`, the existing
convention `global.css` already uses for its five status chip backdrops, so the
workspace introduces no new alpha value.

| Hue | on `#0d1014` | on `#14181e` | tint over ground | hue on its tint | `--fs-text` on tint |
|---|---|---|---|---|---|
| Blue `#6b9ce0` | 6.77 | 6.32 | `#18212d` | 5.76 | 13.56 |
| Cyan `#5cc8d8` | 9.72 | 9.08 | `#17262c` | 7.93 | 13.00 |
| Violet `#a78bfa` | 7.01 | 6.54 | `#201f30` | 5.94 | 13.50 |
| Orange `#e8975c` | 8.18 | 7.64 | `#28201d` | 6.86 | 13.35 |

Every value clears AA at 4.5:1 for body text, and every hue clears 3:1 as a non
text mark on the ground. The worst case in the table is blue on its own tint at
5.76:1.

### 4.2 Why orange is `#e8975c` and not the amber that exists

`--fs-warn` is `#d5a03c`, h39. The workspace orange is h25. Fourteen degrees is a
narrow gap and it was chosen against two constraints pulling in opposite
directions.

Pulling warmer: orange must not be confusable with amber, because amber already
means warn, historical transport state and live proof fallback in three unrelated
rules, and Controlled Fault means none of those. Pulling cooler: below about h20
the hue starts reading as salmon, and salmon reads as failure. Controlled Fault is
the opposite of failure. It is the run doing exactly what the scenario said it
would do, on purpose, so a hue that implies alarm would state the wrong thing at a
glance, which is the only glance most readers give it.

h25 is the widest separation from amber that is still unambiguously orange rather
than red. The two never appear together in the workspace, since `--fs-warn` is not
in this token set, so the fourteen degree gap is only a risk if a shared component
carrying an amber chip is later placed inside `.aw`. That is worth remembering and
is not worth designing around now.

### 4.3 Completed and failed get no hue

The locked direction names four hues. Completed and failed are not among them, and
this section says what they get instead, because the alternative was considered
and is worse.

**Completed is the absence of cyan plus the return of blue.** Phase 3 section 3.3
established that cyan is painted only while the run is under way and blue only
when the action is enabled, and that `canStart` is false throughout a run. So on
reaching `completed` the cyan run label goes out and the blue CTA comes back, and
those two changes happen together and only here. That transition is the signal.
Adding green would spend a fifth hue to restate something two existing hues
already stated by changing, and green filled nodes are on the never list.

**Failed gets the neutral ink ramp and its words.** No red in Story Mode. The
reason is product specific rather than aesthetic. Phase 4 section 1.2 established
that `recovery.py` defines four Warden outcomes and three of them are refusals, so
the most common route into `failed` is the Warden declining a retry on
non-idempotency or budget grounds. That is governance working correctly and it is
the best evidence the system produces. Painting it red states that something broke
and someone should act, which inverts its meaning. The other route into `failed`
is an infrastructure error, and there the 36px outcome sentence already says so in
the largest type on the page. A hue cannot add anything to a sentence that size.

Red is available to Expert Mode as `--aw-fail`, deliberately not defined here.
Expert has its own budgets under phase 3 section 7 item 4, and an event rail that
must mark a terminal row without the reader parsing its text is a genuine reason
for a fifth token that Story Mode does not have.

### 4.4 The measured reason no status may rely on colour alone

The rule is usually asserted from principle. Here it is derived, and the
derivation names which pair of hues is the problem.

Two independent measurements on the locked palette.

**Greyscale.** Relative luminance: blue 0.3228, violet 0.3358, orange 0.4006, cyan
0.4854. Blue and violet differ by 4 percent, which is nothing. Desaturate the page
and the primary action and the Warden mark are the same shade.

**Colour vision deficiency.** Simulating the four hues under the Viénot transform
and measuring RGB distance between every pair, out of a 441 maximum:

| Pair | Normal | Protanopia | Deuteranopia | Tritanopia |
|---|---|---|---|---|
| blue / violet | 68 | **27** | **27** | 62 |
| blue / cyan | 47 | 54 | 46 | 50 |
| cyan / violet | 102 | 70 | **48** | 87 |
| blue / orange | 182 | 136 | 151 | 151 |
| cyan / orange | 193 | 128 | 133 | 169 |
| violet / orange | 171 | 163 | 171 | 89 |

Blue and violet collapse to a distance of 27 under both protanopia and
deuteranopia. They are the same colour for a substantial fraction of readers, and
unlike blue and cyan they are not mutually exclusive: `completed` shows a blue
enabled CTA and a violet Warden beat at the same time.

Four hues that all clear AA on a near black ground cannot also be separated by
luminance, because clearing AA constrains each of them into a narrow luminance
band. There is no arrangement of four hues that fixes this. So:

> **Every element carrying a hue also carries its word, and the word is
> sufficient on its own.** A monochrome rendering, a forced colours rendering and
> a rendering seen by a reader with deuteranopia all lose nothing.

And a second rule aimed at the specific pair that collides:

> **Blue and violet must differ in fill treatment, not only in hue.** The primary
> action is the only solid filled element in Story Mode. The Warden mark is text
> on a tint. Fill against no fill survives greyscale, deuteranopia and forced
> colours, all three.

### 4.5 The primary action

Solid `--fs-accent` `#6b9ce0` fill with `--fs-bg` `#0d1014` ink.

Measured: dark ink on that fill is 6.77:1, and white ink on the same fill is
2.82:1, which fails AA. So the ink colour is not a choice. The fill against the
page ground is 6.77:1, well past the 3:1 that WCAG 1.4.11 asks of a control
boundary, which is why the button needs no border at all and section 2.3 can
delete borders from the rest of the surface.

Disabled, the fill is removed entirely and the label renders `--fs-text-muted` on
the ground, 7.46:1. Not a dimmed blue: a dimmed blue is still blue, and blue means
the action is available. Phase 4 rule 3 requires the label text
`Run live recovery demo` in every state, so the treatment is the only thing that
can carry availability, and removing the fill removes it unambiguously.

The consequence is worth stating plainly, because it is the whole of the review's
sixth complaint compressed into one sentence: **Story Mode contains exactly one
filled element, and it is the action.**

### 4.6 Unknown is not a failure

Phase 4 section 6.2 requires that the word `Unknown` never render in the same
treatment as a failure. Delegation is unobservable on the MCP path because Gemini
CLI has no sub agents, which is an absence of observation and not an absence of
behaviour, and `deriveBeats` gives it its own `BeatStatus` for that reason.

So: `unknown` renders `--fs-text-muted` on the ground. No hue, no tint, no border.
It looks like a fact the page is stating calmly, which is what it is. Since
`failed` also has no hue by section 4.3, the two would be indistinguishable by
colour, and both are distinguished by their words. That is the rule from 4.4
working as intended rather than a gap in it.

## 5. Spacing, borders and negative space

### 5.1 Spacing scale

| Token | Value | Status |
|---|---|---|
| `--fs-space-1` | 4px | exists |
| `--fs-space-2` | 8px | exists |
| `--fs-space-3` | 12px | exists |
| `--fs-space-4` | 16px | exists |
| `--fs-space-5` | 24px | exists |
| `--fs-space-6` | 32px | exists |
| `--aw-space-7` | 48px | **new** |
| `--aw-space-8` | 64px | **new** |

Two new steps because the existing scale stops at 32px, which is less than the
36px outcome type. A separation smaller than the thing it separates does not
separate. 48px and 64px continue the scale's own roughly 1.5 progression
(16, 24, 32, 48, 64) rather than introducing a new rhythm.

The scale is closed. Phase 1 finding 7 counted 29 spacing literals and zero
spacing tokens in the rejected artifact, which is what happens when a scale is
treated as a suggestion. Eight steps is enough, and a layout that needs a ninth
should change its structure instead.

### 5.2 Border policy

**Story Mode paints zero grouping borders.** Grouping is carried by space and by
the single background step, which is what phase 2 section 3.2 item 3 asked for and
what section 2.3 above shows is also the accessible answer.

Phase 2 budgeted 6 border declarations for Story. The specification uses 2:

1. `:focus-visible`, inherited from `global.css` unchanged, `2px solid
   var(--fs-accent)` with a 2px offset. It is a control boundary and it passes
   1.4.11 at 6.77:1.
2. The secondary action, `Replay evidence`, `1px solid var(--fs-border-strong)`.

Four declarations of headroom remain. Spending any of them requires naming, in
the change that spends it, which genuine boundary the border marks. A border that
exists to group is not a genuine boundary and is what the budget is protecting
against.

**Expert Mode gets one border per evidence surface**, marking the edge where mono
content begins. That is a genuine boundary: it is the line between what FleetScope
wrote and what the run produced, which is the same distinction section 3.3 asks
typeface to carry, stated twice on the one surface where getting it wrong matters
most.

Radius: `--fs-radius` 6px for the action and any evidence surface,
`--fs-radius-sm` 4px for chips. Two values, both existing, no new token. The
rejected artifact used 8.

### 5.3 Negative space ratio

**Contractual floor: at least 45 percent of the Story region is unassigned**,
inherited unchanged from phase 2 section 3.2 item 1.

That is only meaningful with a definition of assigned, since the phrase can be
measured several ways and the rejected artifact would pass some of them. The
definition:

> Measure the `<main>` box. Take the union of the bounding rectangles of every
> element that has a non transparent background, a visible border, or non empty
> text content. Assigned is that union's area as a fraction of the box.

Bounding rectangles rather than painted pixels, because the question phase 2 was
asking is how much of the screen has been handed out to content, not how much ink
is on it. A 720px column of 15px text has assigned its full width whether or not
the last line reaches the end.

Computed for the specified Story surface in `completed` at 1440x900, with a `main`
box of 1440x852 below the 48px nav:

| Region | Box | Area |
|---|---|---|
| A, verdict | 720 x 150 | 108,000 |
| B, progress | 720 x 120 | 86,400 |
| delegation line | 720 x 20 | 14,400 |
| C, action | 208 x 44 | 9,152 |
| **Assigned** | | **217,952** |
| `main` | 1440 x 852 | 1,226,880 |

17.8 percent assigned, so **82.2 percent unassigned**. The rejected artifact
measures near 100 percent assigned by the same method, because
`grid-template-rows: 44px minmax(0, 1fr) 124px` hands out every pixel by
construction. The metric discriminates between the two cases, which is the test of
whether it is the right metric.

The floor is 45 percent and the design sits at 82. That slack is deliberate and it
is where Expert Mode's graph, evidence surface and event rail will go. But it also
means the floor is a weak alarm for Story, so a second threshold: **a Story
surface measuring below 70 percent unassigned has almost certainly grown a fourth
region and should be reviewed against phase 3 exclusion 6**, which forbids a
fourth region no matter how small. 45 percent is the contract. 70 percent is the
smoke alarm.

## 6. Motion

### 6.1 Story Mode has none

Zero animations and zero transitions, inherited from phase 3 exclusion 9. Phase 2
section 3.1 counted 7 in the rejected artifact and 0 on the shipped Story page,
and the shipped page is the one that passes review.

The mechanical reason, which matters more than the aesthetic one:
`client.ts:22` polls every 400ms and `client.ts:204` refetches from cursor 0 on
every tick, then repaints unconditionally. Anything keyed to a render therefore
fires two and a half times a second, forever. Phase 4 rule 2 requires the
implementation to compare the previous state before writing `data-state` so that
motion can be gated on an actual change. Story Mode does not need that gate,
because it has nothing to gate.

### 6.2 What Expert Mode may animate

| Token | Value | Use |
|---|---|---|
| `--aw-motion-fast` | 120ms | A discrete acknowledgement of a user action, such as a selection change |
| `--aw-motion-state` | 200ms | A change of `data-state` or `data-mode` |
| `--aw-ease` | `cubic-bezier(0.2, 0, 0, 1)` | Both |

Permitted properties: `opacity`, and `transform: translateY()` up to 2px. Nothing
else.

**200ms is a derived ceiling, not a preference.** The poll interval is 400ms. An
animation longer than half that interval can still be running when the next
repaint arrives, so it would be interrupted mid flight by a repaint that has no
relationship to it, at an unpredictable point. 200ms guarantees every animation
completes inside one poll window.

### 6.3 What may never animate, and why each

1. **Nothing perpetual.** `global.css` currently contains two infinite
   animations, `fs-pulse 1.6s ease-in-out infinite` on the live transport dot at
   line 1534 and `fs-spin 700ms linear infinite` on the spinner at line 1852. The
   workspace inherits neither. A perpetual animation says work is ongoing. On the
   MCP path, `mcp_server.py:336` publishes all eight events in a single POST, so
   the page is not waiting on incremental progress and has nothing ongoing to
   report. A pulsing dot would be reporting a process that does not exist.
2. **No per event arrival animation.** Same reason, stated at the row level. All
   eight events arrive together. Animating each row's appearance would render a
   burst as a stream, which is a visual claim that the transcript arrived
   progressively. It did not.
3. **No fake typing and no fake streaming.** FleetScope holds no model credential.
   The model runs in the developer's own CLI, in another window. A typing effect
   would be the page animating something it is definitionally not doing.
4. **Nothing that implies recorded evidence is live.** Concretely: `--aw-cyan`
   may not animate under any circumstances, and no motion may play while
   `provenance === 'recorded'`. Phase 4 section 6 derives provenance from event
   truth rather than from capability, so this is checkable at the point of
   rendering.
5. **No animation may change the width of the Expert graph host.** Phase 0
   finding 14: `CockpitMount.astro:152` documents that the renderer sizes its grid
   from `parent.client_width()` once, at construction, so a host that is zero
   width or hidden at that moment stays blank permanently while every other
   signal looks correct. Line 175 is the guard that waits for a measured width,
   and it can only wait for width it can observe. `opacity` and a 2px `translateY` are safe. A width
   transition, a scale transform or an animated `display` swap are not. This is
   the reason the permitted property list in 6.2 is a list of two rather than a
   general guideline.

### 6.4 Reduced motion

The workspace declares nothing. `global.css` already carries a global
`@media (prefers-reduced-motion: reduce)` block that clamps `animation-duration`,
`transition-duration` and `scroll-behavior` with `!important` across `*`, `*::before`
and `*::after`. It applies to the workspace because the workspace is on the same
page, and re declaring it locally would create a second place to maintain one
rule.

Two things to verify rather than assume, since the clamp is a duration clamp and
not a suppression:

* An animation's end state still applies. Every permitted animation ends at
  `opacity: 1` and `translateY(0)`, so the clamped result is the correct final
  appearance rendered immediately, which is what reduced motion should produce.
* Any future animation whose end state differs from its intended resting state
  would break under the clamp. That is a reason to keep the permitted property
  list at two.

## 7. Token to state map

Twelve states from phase 4 section 3. Reachability from phase 4 section 2: **M**
reachable on the MCP driver, which is the live demo, **W** worker driver only,
**R** replay.

Hue counts include the neutral ink ramp, per the phase 2 budget of four hues of
which one is neutral.

| State | Reach | Blue | Cyan | Violet | Orange | Neutral | Hues | Notes |
|---|---|---|---|---|---|---|---|---|
| `unavailable` | M W R | no | no | no | no | yes | 1 | CTA disabled, nothing running. |
| `ready` | M W | **CTA fill** | no | no | no | yes | 2 | The only state where blue is the whole story. |
| `starting` | M W | no | **no (D40)** | no | no | yes | **1** | CTA disabled during the POST. No run record exists yet, so there is no chip to paint and nothing to call live. |
| `awaiting_agent` | M | no | **no (D40)** | no | no | yes | **1** | The prompt block is mono on sunken, no hue. The run is admitted and has produced no event, so a cyan chip would be the static form of the pulsing dot `04` section 3.4 forbids. |
| `running` | W | no | run label | no | no | yes | 2 | |
| `controlled_fault` | W R | no | run label | no | fault beat | yes | 3 | Orange first appears here. |
| `incident` | W R | no | run label | no | fault beat | yes | 3 | |
| `warden_authorized` | W R | no | run label | Warden beat | fault beat | yes | 4 | At budget. |
| `recovering` | W R | no | run label | Warden beat | fault beat | yes | 4 | At budget. Phase 3 worst case. |
| `completed` | M W R | **CTA fill** | no | Warden beat | fault beat | yes | 4 | At budget. Phase 3 worst case. Blue and violet co-occur, so 4.4 applies. |
| `failed` | M W R | **CTA fill** | no | Warden beat, if one acted | fault beat, if one occurred | yes | up to 4 | No red. Section 4.3. |
| `historical_replay` | M W R | no | no | Warden beat | fault beat | yes | 3 | `canStart` is false, so no blue. Cyan is off: a replay is not live. |

Four rules the table encodes, each traceable to a settled decision.

1. **Blue and cyan never co-occur.** Blue paints an enabled action, cyan paints a
   run under way, and `canStart` is false for every state in which a run is under
   way. This is why a 27 degree hue gap between them is acceptable: they are
   never on screen together, so they are never compared.
2. **Cyan marks the run, never a beat.** Phase 3 section 3.3 corollary. Painting
   it per beat would put four cyan marks on a completed run that is no longer
   live.
3. **Orange is applied only to the element whose text is the words
   `Controlled Fault`. The marker glyph takes the neutral ink.** Amended by `10`
   C31. The earlier wording, "the beat and its label", permitted colouring the
   marker, and D14 makes the marker an `aria-hidden` glyph whose accessible name
   is empty and whose text content is `●`. Check V3 requires every orange element
   to carry the string `Controlled Fault` in its text or accessible name, so an
   orange marker fails the check the design told the implementer to write.
   Orange on the label alone satisfies both, and the label is already the words.
4. **No state exceeds four hues.** The maximum is 4, reached in three states, and
   in every one of them the fourth is the neutral ramp.

Non hue tokens, mapped by role rather than by state, since they apply everywhere.

| Token | Used by |
|---|---|
| `--fs-bg` | Every state, as the ground. Also the ink on the blue CTA fill. |
| `--fs-surface` | Expert panels only. Never in Story. |
| `--fs-surface-sunken` | Evidence blocks and the awaiting agent command, in any state that has one. |
| `--fs-surface-raised` | Never. Section 2.1. |
| `--fs-text` | Outcome sentence, beat labels, the CTA label when enabled. |
| `--fs-text-muted` | Labels, the delegation line, `unknown` beats, the CTA label when disabled. |
| `--fs-text-faint` | Evidence metadata such as sequence numbers. Nothing that carries meaning alone. |
| `--fs-border` | Never in Story. Expert evidence surface edge. |
| `--fs-border-strong` | The secondary action outline. |
| `--aw-space-7`, `--aw-space-8` | Separation between the three Story regions. |
| `--aw-measure-sentence` | The outcome sentence only. **Renamed from `--aw-measure-outcome` by `10` C17**, and re derived from 34ch to 46ch. |
| `--aw-measure-body` | Every other prose block. |
| `--aw-motion-*`, `--aw-ease` | Expert only. Unreferenced in Story. |

## 8. The complete token file

Thirteen new declarations. Everything else is consumed under its existing name.

```css
/*
 * The agent workspace token layer.
 *
 * Scoped to `.aw` and imported by the workspace route only, so it cannot reach
 * any other page. Two rules keep that true and both are greppable: this file
 * contains no `:root`, and it never declares a `--fs-` name. It may read them
 * freely. See docs/design/agent-workspace/08-visual-system.md section 1.
 *
 * Only 13 tokens are here because only 13 values are missing from
 * apps/web/src/styles/global.css. Aliasing the rest would create a second name
 * for one value and a second place for it to drift.
 */
.aw {
  /* Hues global.css does not have. Blue is --fs-accent and is not redeclared.
     Contrast on --fs-bg: cyan 9.72, violet 7.01, orange 8.18, all AA.
     Blue and violet are indistinguishable under deuteranopia, so every hue is
     accompanied by its word and the CTA is the only filled element. */
  --aw-cyan: #5cc8d8;
  --aw-violet: #a78bfa;
  --aw-orange: #e8975c;

  /* Chip tints. Alpha 1f matches the existing --fs-*-bg convention. */
  --aw-cyan-bg: #5cc8d81f;
  --aw-violet-bg: #a78bfa1f;
  --aw-orange-bg: #e8975c1f;

  /* The scale stops at --fs-space-6 (32px), which is smaller than the 36px
     outcome type. A gap smaller than the thing it separates does not separate. */
  --aw-space-7: 48px;
  --aw-space-8: 64px;

  /* Measure. Sized against the longest real sentence in state.ts. After C9
     drops `authoritative` that sentence is 121 characters, and it sits at the
     21px step rather than 36px, where 46ch lands it in the three lines 05 drew.
     The 34ch in the first draft was derived for the same sentence at 36px. */
  --aw-measure-sentence: 46ch;
  --aw-measure-body: 62ch;

  /* Expert only. Story Mode has no motion at all. 200ms is half the 400ms poll
     interval in client.ts, so no animation can be interrupted by a repaint. */
  --aw-motion-fast: 120ms;
  --aw-motion-state: 200ms;
  --aw-ease: cubic-bezier(0.2, 0, 0, 1);
}
```

The type ladder is applied at its five call sites rather than tokenised. Five
sizes, five weights, five line heights and two tracking values would be seventeen
tokens for five uses, and a token used once is a rename rather than an
abstraction. The ladder is specified in section 3.1 and belongs in the component
that renders each step.

## 8a. Implementation record — 2026-08-30

Section 8's token file is shipped as
[`apps/web/src/styles/workspace.css`](../../../apps/web/src/styles/workspace.css),
verbatim, with all thirteen tokens at the values specified here.

Both scopes from section 1 are in place and verified in a browser:

| Route | `.aw` present | `--aw-cyan` resolves |
|---|---|---|
| `/live` | yes, `data-mode="story"` | `#5cc8d8` |
| `/viewer` | no | unresolved |

`#live-root` still has 8 direct children — the wrapper is a sibling scope, not a
new region, so the counts G1.1 and P7 read are unchanged.

**V1 is enforced** by `apps/web/tests/workspace-tokens.test.ts`: no `:root`,
`html` or `body` selector; no `--fs-` declaration; every rule begins with `.aw`;
the thirteen tokens present at their documented hex values; and the file
imported by `/live` alone and by neither layout.

One deviation from the letter of the check. V1 is specified as a grep, but this
document's own header comment for the file *describes* the rules and therefore
contains the strings `:root` and `--fs-`. The test strips comments before
checking, which is the rule's intent; a raw grep would fail on the file the
document itself specifies.

The three hues are bound to `[data-live]`, `[data-intervention]` and
`[data-controlled-fault]` and are currently dormant on `/live`, because no
canonical event exists without an API — which is D40's rule, not an omission.

## 9. Checks this document adds

Written to be added to `scripts/qa-live.ts`, at 1440x900 and 480x900, alongside
the P1 to P10 preconditions phase 3 section 4.1 defines. P8 and P9 are restated
because this document supplies the values that make them executable.

```text
V1  workspace.css declares no `:root`, no bare element selector, and no `--fs-` name
V2  getComputedStyle on every visible element in the story body yields at most
    4 distinct values AFTER collapsing --fs-text, --fs-text-muted, --fs-text-faint
    and --fs-bg into one neutral bucket, and every non-neutral value is one of
    --fs-accent, --aw-cyan, --aw-violet, --aw-orange. Restated by 10 C30: the
    earlier cardinality-only form was unsatisfiable, because `completed` renders
    three ink levels plus violet plus orange plus --fs-bg as the ink on the blue
    fill, which is five or six distinct values against a bar of four.
V3  every element whose computed colour is --aw-orange has, in its accessible
    name or its text content, the string "Controlled Fault"
V4  every element whose computed colour is --aw-violet names the Warden
V5  exactly 1 element in the story body has a non-transparent background-color
    that is not a chip tint: #live-start, and only when enabled
V6  border-style is `none` on every element in the story body except
    #live-replay and whatever holds :focus-visible
V7  document.getElementById('live-root').getAnimations({ subtree: true }).length
    === 0, in all twelve states. Restated by 10 C32: Element.getAnimations()
    without { subtree: true } misses a descendant, and document.getAnimations()
    catches the nav and anything global.css animates, so the earlier phrasing
    either under-detected or over-fired.
V8  no computed transition-duration or animation-duration in the workspace
    exceeds 200ms
V9  assigned area, per the section 5.3 definition, is at most 55% of the <main>
    box; warn at 30%
V10 no element in the story body has a computed opacity strictly between 0 and 1
```

V3 and V4 are the machine form of the no colour alone rule. They test the
property that actually matters, which is that removing colour removes no
information, rather than testing that a hex value is present.

V10 is section 2.2: the ink ramp clears AA at three measured levels, so any
partial opacity is an unmeasured contrast the design did not need to create.

`qa-live.ts` currently contains **25** `check(` call sites plus the `check`
function declaration at `qa-live.ts:39`, which a bare `grep -c 'check('` counts
as a twenty sixth. 24 of the 25 sit outside the five iteration loop at
`qa-live.ts:237`, so 24 + 5 gives 29 per viewport and 58 across two, and **not
one of them asserts a colour, a font or a size**. So none of the 58 can be broken by anything
in this document. The checks above are additions, not edits.

## 10. What this document does not decide

1. **Any layout.** Where regions A, B and C sit, what the mode switch looks like,
   and how Expert Mode arranges the graph, evidence and event rail. Phase 3
   section 7 items 1 and 2 left those open and they stay open. The section 5.3
   area figures assume a 720px column because phase 2 named one; they are an
   arithmetic illustration of the ratio, not a layout.
2. **Expert Mode's budgets.** Phase 3 section 7 item 4 defers them. This document
   supplies the tokens Expert will draw from and names the one it will need and
   does not yet have, `--aw-fail`.
3. **Any copy.** Every string quoted here is quoted from `state.ts` as shipped.
4. **The six `var()` corrections in `live.astro`.** Section 0.5 identifies them
   and states the cost. Making them is an implementation task.
5. **Whether the six `live__facts` fields move to Expert or shrink in place.**
   Phase 3 section 7 item 5, still open.

## Links

* Shipped stylesheet: `apps/web/src/styles/global.css`
* Shipped Story page: `apps/web/src/pages/live.astro`
* Shipped state machine: `apps/web/src/features/live/state.ts`
* Shipped client and poll interval: `apps/web/src/features/live/client.ts`
* Renderer sizing constraint: `apps/web/src/features/cockpit/CockpitMount.astro`
* The 58 checks: `scripts/qa-live.ts`
* Phase 0, current state audit: `docs/design/agent-workspace/00-current-state-audit.md`
* Phase 1, prototype autopsy: `docs/design/agent-workspace/01-prototype-autopsy.md`
* Phase 2, reference matrix: `docs/design/agent-workspace/02-reference-matrix.md`
* Phase 3, information hierarchy: `docs/design/agent-workspace/03-information-hierarchy.md`
* Phase 4, state model: `docs/design/agent-workspace/04-state-model.md`
