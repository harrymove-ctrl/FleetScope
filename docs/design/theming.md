# Theming

**Status:** current
**Owner:** FleetScope frontend
**Applies to:** `apps/web/src/styles/theme.css` and every surface that reads it

FleetScope's colour, translucency, blur, shadow and radius live in one file:
[`apps/web/src/styles/theme.css`](../../apps/web/src/styles/theme.css). Change a
variable there — or on any ancestor element — and every surface follows without
touching a component.

That includes the WebGL lens on the launchpad. The renderer reads the `--lens-*`
tokens through `getComputedStyle` and feeds them to the shader as uniforms, so
retinting the liquid glass is a CSS edit rather than a shader edit.

## Scopes

| Selector | Applies |
|---|---|
| `:root` | The dark theme. This is the default and the designed one — FleetScope's product surfaces are dark, so it is not an inversion of a light theme. |
| `[data-theme='light']` | The light theme, opt-in. |
| `[data-theme='dark']` | Pins dark, ignoring the system preference. |
| `@media (prefers-color-scheme: light)` | Honoured only when neither `data-theme` value is set. |

## Surfaces and ink

```css
:root {
  --fs-bg: #05060a;          /* page background */
  --fs-bg-2: #0b0e16;        /* the one alternate surface */
  --fs-ink: #f2f5fa;         /* primary text */
  --fs-ink-muted: #8b94a8;   /* secondary text */
  --fs-hairline: #1b2030;    /* 1px separators */

  --fs-accent: #5aa9ff;      /* primary button and text links, nowhere else */
  --fs-accent-hover: #7cbcff;
  --fs-accent-ink: #04121a;  /* text on the accent fill */
}
```

Two surfaces only. A third reads as a different product, and the alternating
background is the layout device — there is nothing else doing that job.

## Glass

```css
:root {
  /* Translucency ladder, three steps */
  --glass-bg: rgb(255 255 255 / 6%);
  --glass-bg-raised: rgb(255 255 255 / 9%);
  --glass-bg-strong: rgb(255 255 255 / 13%);

  /* The edge. A panel reads as glass because of its rim, not its blur. */
  --glass-border: rgb(255 255 255 / 11%);
  --glass-border-strong: rgb(255 255 255 / 20%);
  --glass-specular: rgb(255 255 255 / 55%);
  --glass-inset: inset 0 1px 0 rgb(255 255 255 / 9%);

  /* Blur scale. 30px is the Apple standard. */
  --blur-sm: 15px;
  --blur: 30px;
  --blur-lg: 50px;
  --glass-saturate: 170%;

  /* Shadow scale */
  --glass-shadow-sm: 0 4px 16px rgb(0 0 0 / 30%), 0 1px 4px rgb(0 0 0 / 15%);
  --glass-shadow: 0 8px 32px rgb(0 0 0 / 40%), 0 2px 8px rgb(0 0 0 / 20%);
  --glass-shadow-lg: 0 12px 48px rgb(0 0 0 / 50%), 0 4px 16px rgb(0 0 0 / 30%);

  /* Radius scale */
  --glass-radius-sm: 12px;
  --glass-radius: 18px;
  --glass-radius-lg: 26px;
}
```

The light theme raises the fills to Apple's light standard — roughly 25% white —
and lightens the shadows, because a bright backdrop needs far less separation
before glass turns milky.

## The lens

These reach the shader. They are the only way to change how the liquid glass
looks without editing GLSL.

```css
:root {
  --lens-tint: #5fe3ff;       /* ring and aura colour */
  --lens-glow: 0.9;           /* overall glow multiplier */
  --lens-white-glow: 0.05;    /* centre nova intensity */
  --lens-dispersion: 7;       /* chromatic separation at the rim */
  --lens-ring: 1.1;           /* ring intensity */
  --lens-rim-line: 0.32;      /* bright border line */
  --lens-size-x: 0.565;       /* half-width, as a fraction of viewport height */
  --lens-size-y: 1;           /* half-height, likewise */
}
```

Two of these carry hard-won defaults:

- **`--lens-size-y: 1` makes the ellipse taller than the viewport on purpose.**
  Only its smooth interior is then ever visible, and the violent rim waves stay
  off screen. At `0.62` the boundary sits inside the viewport and the whole card
  row smears.
- **The appearance values are dark-page tuning, not the reference's upstream
  defaults.** Upstream (`glow 4.2`, `ring 6`, `rim-line 1.4`) was built against a
  white page; on a near-black one those "bloom into an opaque band that swallows
  the cards".

## The carousel backdrop

```css
:root {
  --carousel-ink: #05060a;
}
```

Deliberately **not** aliased to `--fs-bg`, and dark in both themes. The card
artwork is photography of a dark product, and a white gap between dark cards
reads as a rendering fault rather than as a light theme. The renderer clears to
this exact token, so a mismatch with the page shows as seams between the cards.

## Overriding

**Globally**, in your own stylesheet — loaded *after* `theme.css`, or the
cascade will discard it:

```css
:root {
  --blur: 40px;
  --glass-bg: rgb(255 255 255 / 3%);
}
```

**Per theme:**

```css
[data-theme='light'] {
  --glass-bg: rgb(255 255 255 / 40%);
  --blur: 20px;
}
```

**Per element or subtree** — a custom property inherits, so this retints one
section and everything inside it:

```html
<section style="--lens-tint: #ffb073; --lens-ring: 2.2">…</section>
```

## How updates propagate

| Surface | When it updates |
|---|---|
| Anything styled in CSS | Immediately. The variables are read by the stylesheet. |
| The WebGL lens | At mount, and again whenever `data-theme` changes or the system colour scheme changes. |

The lens cannot observe an arbitrary stylesheet edit at runtime — a canvas has
no cascade to re-run — so a token changed by script after mount reaches the DOM
but not the shader until the next theme change. Authoring tokens in CSS, which
is the documented path, is unaffected: the value is in place before the lens
first reads it.

## Accessibility

`prefers-reduced-transparency` is honoured: the glass fills become opaque and
every blur drops to `0`. Translucent panels are the hardest surfaces to read for
anyone with low vision, so this is a real setting rather than a nicety.

Under `forced-colors`, blend modes and translucency are dropped and system
colours take over. Status colour is **not** themed here — it lives in
`global.css`, where every hue is paired with a glyph and a word so meaning
survives greyscale.

## What is not themeable, and why

The Agent Viewer's graph canvas is drawn by the Rust renderer compiled to
WebAssembly, not by CSS. Its colours are `ratatui` ANSI values chosen in the
vendored Zoetrope source and mapped to RGB by a hardcoded table in
`ratzilla/src/backend/color.rs`. `WebGl2BackendOptions` exposes exactly one
colour knob — `canvas_padding_color` — and no palette override.

Retheming that canvas therefore means patching the vendored source to emit
`Color::Rgb(..)` instead of the ANSI names, recording it in
`vendor/VENDOR-PATCHES.md`, and rebuilding the WASM. It is a vendor change plus
a toolchain step, not a token edit, and no CSS variable here reaches it.

## Files

| File | Role |
|---|---|
| `styles/theme.css` | The tokens. The only place a palette is decided. |
| `styles/apple.css` | The launchpad's type scale and layout. Aliases the theme; declares no colour. |
| `styles/glass.css` | The glass shell for `/dashboard` and the `/viewer` frame. Aliases the theme. |
| `styles/global.css` | The evidence vocabulary: flat surfaces and status colour, for surfaces read closely by someone checking a claim. Not themed. |
| `features/launch/lens.ts` | Reads `--lens-*` and `--carousel-ink` into shader uniforms. |
