# Third-party notices

This file is the single location for third-party copyright and license
attribution. Per product decision **D8**, these notices live in repository
licensing files and do **not** appear in FleetScope product navigation.

## Adapted source

### WildType — the viewer loader

|             |                                                                    |
| ----------- | ------------------------------------------------------------------ |
| Source      | WildType reference algorithm, supplied as framework-free Canvas 2D |
| Vendored in | `apps/web/src/features/viewer/wild-type/`                          |

The port preserves the dense-array geometry and motion algorithm. Its indexed
reads carry non-null assertions because this workspace enables
`noUncheckedIndexedAccess` and the reference does not; the loops and fixed-size
buffers establish those bounds, so the assertions are type-level only.

### reality-split — the landing preloader

|             |                                                              |
| ----------- | ------------------------------------------------------------ |
| Source      | reality-split, supplied as framework-agnostic core logic     |
| Vendored in | `apps/web/src/features/preloader/params.ts`, `.../engine.ts` |

**A vendored copy.** The reference ships an engine plus a React card; only the
card needed React, so `Preloader.astro` drives the engine directly.

`params.ts` is fenced into MEASURED and TUNABLE halves, and the fence is load
bearing: MEASURED came off a 162-frame reference clip and is data, not knobs.
The eases have fatter tails than any closed form, the seam gaps are three
different sizes because a human made them, and the drift law was solved from
two letters' displacement.

Deviations, each marked at its site:

1. non-null assertions on array indexing, for `noUncheckedIndexedAccess`;
2. `time` and `loopLength` exposed read-only, so the overlay can dismiss on a
   phase boundary without reaching into private state;
3. the frame delta is floored at zero. A rAF timestamp can predate the
   `performance.now()` taken when the loop started, and `next % loop` keeps
   that sign, leaving the clock slightly negative and every phase test on the
   wrong branch;
4. the scale is the lesser of the height and what the width can hold, measured
   against the **split** row. Every constant is a fraction of one square's
   side, which suits the reference's card and its seven-letter word; on a
   full-viewport overlay a longer word hangs off both edges, and the seams add
   nearly half a side length on top.

### canvas-ui Bend — the shader fold

|             |                                                                  |
| ----------- | ---------------------------------------------------------------- |
| Project     | **canvas-ui** — <https://github.com/DavidHDev/canvas-ui>         |
| Source      | `src/lib/Bend/BendVanilla.ts`, `src/lib/rect-cache.ts`           |
| Vendored in | `apps/web/src/features/bend/engine.ts`, `.../bend/rect-cache.ts` |

**A verbatim copy.** Upstream publishes this engine alongside React, Preact,
Solid, Svelte and Vue wrappers; only the wrappers need a framework, so the
vanilla build is taken as-is and `Bend.astro` supplies its three DOM elements.

Three deviations, each marked where it occurs:

1. the `rect-cache` import points one directory shallower;
2. `uCover` waits for a capture that produced pixels — upstream derives it from
   feature detection alone, so a capture that throws leaves an opaque canvas
   over a page it never drew;
3. non-null assertions on `uniforms.*` and defaults on the destructured pixel
   bytes, because this workspace compiles with `noUncheckedIndexedAccess` and
   upstream does not. Type-level only; no behaviour changes.

The fold on the landing page is **not** this engine — see
`apps/web/src/features/bend/fold.ts`, which is FleetScope's own CSS
implementation and carries no third-party code.

### liquid-glass-carousel — the launchpad lens mathematics

|             |                                                                                   |
| ----------- | --------------------------------------------------------------------------------- |
| Project     | **liquid-glass-carousel** — a three.js + GSAP liquid-glass carousel engine        |
| License     | **MIT** — Copyright (c) 2026 Yousuf Soomro                                        |
| Reached via | NeuroPay, commit `010d0ec187e038e6e57d945f63b57fd21ad373a9`, `packages/carousel/` |
| Adapted in  | `apps/web/src/features/launch/lens.ts`                                            |

**Adaptation, not a vendored copy.** No file from that project is present in
this repository and no dependency on it is declared. What is adapted is the
fragment-shader mathematics of its lens: the elliptical mask, the inward pull
and tangential fluid rim waves, the weighted multi-sample chromatic dispersion
with per-channel normalisation, the centre nova, the ring with its aura and
shimmer, and the bright rim line.

FleetScope's version differs in three ways that matter:

- **It has no clock.** The original advances its shimmer and entry choreography
  on elapsed time. Every animated term here is a function of scroll position,
  so the effect responds to the reader and is still when they are.
- **It refracts one product screenshot** rather than a rendered carousel of ten
  panels, and is dependency-free WebGL rather than three.js and GSAP.
- **It uses the dark-page tuning**, not the upstream defaults. The upstream
  values were built against a white page; the NeuroPay configuration dials glow
  from 4.2 to 0.9, the ring from 6 to 1.1 and the rim line from 1.4 to 0.32 for
  a near-black background. FleetScope's launchpad is true black, so the
  dialled-back set is what is used here.

The MIT copyright notice above is reproduced in the header of `lens.ts`, as the
license requires.

## Vendored source

### Zoetrope — the Fleet Cockpit rendering substrate

|                    |                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------- |
| Project            | **Zoetrope** — "Terminal UI that visualizes Claude Code agent sessions as a live flow graph." |
| Repository         | https://github.com/furkankly/zoetrope                                                         |
| Pinned commit      | `077707da679955c0402c39ca992bf56cdc6b0264`                                                    |
| License            | **MIT** — Copyright (c) 2026 Furkan Kalaycioglu                                               |
| Vendored at        | `vendor/zoetrope/`                                                                            |
| Upstream `LICENSE` | copied verbatim to `vendor/zoetrope/LICENSE`                                                  |

FleetScope's Fleet Cockpit renders the graph, timeline, camera, tool chips and
semantic zoom of this project. FleetScope depends on its **portable core**
(`default-features = false`): the model, timeline, graph projection, UI rendering
and parser, with no async runtime, no terminal backend and no filesystem access.

**FleetScope modifications: yes — a small patchset.** This vendored copy is
**not** unmodified. The complete record is `vendor/VENDOR-PATCHES.md`; in summary:

- **`render-provenance` Cargo feature** (`Cargo.toml`, `src/ui/panel.rs`).
  Additive and default-on, so upstream behaviour is unchanged. With the feature
  off — which is what `default-features = false` gives FleetScope — the detail
  panel renders neither the triggering prompt nor the assistant's reasoning.
  FleetScope shows Decision Evidence and exposes no private model reasoning.

No other source file differs from the pinned commit. Upstream's own test suite
was re-run after the patch and passes unchanged: **182 library tests + 8 binary
tests**, with `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`
and `cargo check --no-default-features` all clean.

**Not redistributed.** Upstream's `assets/` (demo recordings, GIFs, an OG image,
and JetBrains Mono TTFs shipped without accompanying OFL-1.1 text) and its
Starlight documentation site under `web/` are excluded from this repository.
FleetScope renders its own recorded CASE-1042 evidence and uses the browser's own
monospace font stack. See `vendor/VENDOR-PATCHES.md` for the full inclusion table.

## npm and crates.io dependencies

Dependency licenses are recorded in `pnpm-lock.yaml`, `Cargo.lock`,
`vendor/zoetrope/Cargo.lock` and `crates/fleet-cockpit-web/Cargo.lock`. Generate
a report with:

```bash
pnpm licenses list
cargo tree --format '{p} {l}'
cargo tree --manifest-path vendor/zoetrope/Cargo.toml --format '{p} {l}'
```

Notable transitive dependencies reached through Zoetrope: `ratatui`,
`ratatui-core`, `ratatui-widgets`, `rataflow`, `rust-sugiyama`, `chrono`,
`web-time`, `unicode-width` — and, in the browser build only, `ratzilla`,
`beamterm-renderer`, `wasm-bindgen`, `web-sys` and `critical-section`. All are
resolved from crates.io and are not vendored.
