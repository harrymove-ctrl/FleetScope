# FleetScope patches to vendored source

FleetScope vendors Zoetrope as a **pinned, patched** dependency. It is not
unmodified, and this file is the complete record of what differs. Every entry
states what changed, why a wrapper could not do it, and what was re-run.

> **Wrapper first.** The order of preference is: FleetScope wrapper → adapter →
> DOM evidence → small ABI → *only then* a vendor patch. Most of what FleetScope
> needed from the renderer was achievable without touching it; the list below is
> deliberately short, and each entry says why it could not stay outside.

## Upstream

| | |
|---|---|
| Project | Zoetrope |
| Repository | https://github.com/furkankly/zoetrope |
| Pinned commit | `077707da679955c0402c39ca992bf56cdc6b0264` |
| License | MIT — Copyright (c) 2026 Furkan Kalaycioglu |
| Vendored at | `vendor/zoetrope/` |

The `LICENSE` file is copied verbatim and must never be edited. Upstream git
history is never rewritten.

## What is vendored, and what is not

| Path | Vendored | Why |
|---|---|---|
| `LICENSE`, `README.md` | yes | attribution |
| `Cargo.toml`, `Cargo.lock` | yes | the crate and its pinned dependency graph |
| `src/**` | yes | the library FleetScope depends on |
| `docs/ARCHITECTURE.md` | yes | the fold and timeline semantics FleetScope relies on |
| `wasm-boot/env.js` | yes | **load-bearing.** `wasm32-unknown-unknown` provides no libm intrinsics and no `critical-section` implementation; without these shims the wasm module does not instantiate |
| `wasm-boot/cargo-config.reference.toml` | yes | the wasm32 default-target pattern `crates/fleet-cockpit-web` mirrors |
| `assets/**` | **no** | ~8 MB of demo recordings, GIFs and an OG image FleetScope never renders. The bundled JetBrains Mono TTFs ship with no accompanying OFL-1.1 text, so redistributing them would be a licensing risk for a font FleetScope does not use — `apps/web` uses the browser's own monospace stack |
| `assets/demo.jsonl`, `assets/demo/**` | **no** | Zoetrope's own demo session. `crates/fleet-cockpit-web` compiles in the FleetScope CASE-1042 Case instead |
| `web/` (Starlight site) | **no** | upstream's marketing and docs site. FleetScope's `apps/web` is the product shell |

## Patch 1 — the `render-provenance` feature

**Files:** `vendor/zoetrope/Cargo.toml`, `vendor/zoetrope/src/ui/panel.rs`

**What upstream does.** `render_provenance` in `src/ui/panel.rs` answers "why does
this agent exist" with two rows in the detail panel:

- `↳ prompt` — the triggering user prompt text, and
- `↳ thought` — the assistant's *reasoning* immediately before the spawn
  (`SpawnContext::reasoning`).

For a Claude Code session visualizer that is exactly the right feature. For
FleetScope it is a product violation: FleetScope shows **Decision Evidence** —
inspectable recorded facts — and states plainly that it records no hidden
reasoning and reconstructs none.

**The change.** A new Cargo feature, `render-provenance`, included in `default`.
When it is off, the panel computes and renders neither row.

**Why it is additive rather than a deletion.** Upstream behaviour is bit-for-bit
unchanged: `zoe`, the browser demo, and any other consumer take `default` and
still get both rows. FleetScope already depends on the crate with
`default-features = false` — the same switch that drops the native frontend — so
it needed no new flag and no fork of the panel.

**Why a wrapper could not do it.** The panel is drawn inside `zoetrope::ui::draw`
from state the renderer owns. A wrapper can choose *what data* to hand the
renderer, but not *what the renderer draws with the data it already has*.

**Why it is nevertheless defence in depth, not the control.** The real control is
upstream of the renderer: FleetScope's Scenario Compiler emits no `prompt` field
on a spawn and no `thinking` block anywhere, so `SpawnContext::reasoning` is
always `None` in a FleetScope build and there is nothing to draw. Both the
TypeScript and Rust suites assert that on the compiled artifacts. This patch
exists because a renderer that *can* draw private reasoning is one compiler bug
away from doing so.

**Verification re-run after the patch:**

| Command | Result |
|---|---|
| `cargo test` (default features) | **182 lib + 8 bin passed**, 0 failed |
| `cargo check --no-default-features` | exit 0 |
| `cargo clippy --all-targets -- -D warnings` | exit 0 |
| `cargo clippy --no-default-features -- -D warnings` | exit 0 |
| `cargo fmt --all -- --check` | exit 0 |

## Patch 2 — paired-viewer TUI control (Esc, Failed, tall inspector, hooks)

**Files:** `vendor/zoetrope/src/handler.rs`, `vendor/zoetrope/src/state/mod.rs`, `vendor/zoetrope/src/state/session.rs`, `vendor/zoetrope/src/ui/mod.rs`, `vendor/zoetrope/src/ui/panel.rs`, `vendor/zoetrope/src/tui.rs`

**What upstream does.** Esc is a no-op in Follow so the inspector auto-narrates; `recompute_liveness` overwrites Failed/terminal agents when `last_ts` is recent; a selected agent always splits the canvas 30/70 horizontally, covering the graph on a short terminal; the TUI loop has no pairing hook.

**The change.**

- Esc closes help, then info, then the detail panel even in Follow. Follow's camera stays Follow. `follow_inspector` stops `track_activity` from immediately re-selecting; `f` turns narration back on.
- `recompute_liveness` (and `end_of_stream`) must not overwrite `AgentStatus::Failed` or revive a `terminal` agent.
- Terminals ≥48 rows put the inspector in a ~16-row bottom pane so the graph stays full width. The 30/70 split remains the short-terminal fallback.
- The inspector notes when the selected agent's event is not the playhead (`[`/`]` still step; selection ≠ seek).
- `App::dismiss_overlays` / `App::set_paused` are the shared Esc/pause primitives (native + wasm).
- `tui::run_with` + `TuiHooks` let FleetScope write/poll `view.json` without duplicating the event loop.

**Why a wrapper could not do it.** Esc routing, liveness, layout, the panel, and the event loop all live inside `zoetrope::ui::draw` / `handler` / `tui::run`. A wrapper can choose *what data* to fold, but not *which keys close the overlay* or *how the canvas splits*.

**Verification re-run after the patch:**

| Command | Result |
|---|---|
| `cargo test --manifest-path vendor/zoetrope/Cargo.toml --lib` | **186 passed**, 0 failed |
| `cargo test -p fleetscope-cli` | **pass** (lib + adapter/cli/manifest/render) |
| `cargo test -p agent-viewer-render` | **21 passed**, 0 failed |
| `cargo test -p agent-viewer-core` | **0 tests** (lib compiles) |

## Patch 3 — show streamed assistant output on cards and inspector

**Files:** `vendor/zoetrope/src/state/session.rs`, `vendor/zoetrope/src/state/graph.rs`, `vendor/zoetrope/src/ui/nodes.rs`, `vendor/zoetrope/src/ui/panel.rs`, `vendor/zoetrope/src/ui/mod.rs`

**What upstream does.** The inspector is a tool-call list. Cards show title, optional spawn description, and `⚒ N tools`. Assistant `text` blocks are used only as spawn-reasoning provenance, then discarded. Antigravity `--print` streams are almost all text and zero tools, so the TUI looked empty (`0 tools`, `no tool calls`) while the JSONL held dozens of output chunks.

**The change.** Each agent keeps `last_text` and a capped `notes` list of assistant text excerpts. Cards wrap 2–4 lines of `last_text` and an honest activity row (`N msgs · M tools · K spawned`) — never `⚒ 0 tools`, never a fan-out counted as a tool. Inspector: if the agent has no *work* tools, list notes under **output** and label `Agent` rows `❋ spawned · …`. Timeline log narrates last streamed text (`▸`) when there are no Claude prompt eras. Status bar uses the same counts. Tool chips skip spawn tools. Subagent cards are taller so the output fits.

**Why a wrapper could not do it.** The session model and card/panel widgets live inside the vendored renderer. Emitting fake `tool_use` blocks from FleetScope would lie about tools.

## Patch 4 — poster (light) TUI palette

**Files:** `vendor/zoetrope/src/state/graph.rs`

**What changed.** `new_flow()` used a dark Gemini canvas (`#06070c`). The operator TUI
now starts from `Theme::Light`: white canvas, black card borders, dark ink.
Accent is black (not Zoetrope gold). Success/error stay green/red.

**Why a wrapper could not do it.** Canvas and card colors are painted inside
rataflow from `Flow.theme` constructed in `graph.rs`.

## What FleetScope did NOT patch

Recorded so the decisions are not re-litigated:

- **Historical animation honesty.** Upstream's `ui/edges.rs` animates an edge
  while its target is running, regardless of transport, which reads as "something
  is executing right now" even when parked in the past. Fixed at the WRAPPER
  level instead: `crates/fleet-cockpit-web/src/main.rs` skips `tick_animation`,
  `tick_auto_pan` and `tick_camera` while the transport is historical, so the
  animation phase freezes. No vendor change needed.
- **Unknown rendered as zero.** Upstream's `ui/nodes.rs` shows `0 tok` for an
  agent with no recorded usage. Fixed at the COMPILER level: the adapter omits
  `message.usage` entirely when FleetScope observed none, so the renderer has no
  zero to draw. A test asserts it.
- **The Claude transcript parser** (`src/transcript.rs`). Bridged to, never
  modified — the Scenario Compiler speaks its format. Modifying it would strand
  the 182 upstream tests that give the fold its meaning.
- **`SessionModel`, the timeline engine, graph layout, the tool-chip reconcile
  pass, the camera, rataflow.** Untouched.
- **The native feature** (`main.rs`, `tui.rs`, `handler.rs`, `autopilot.rs`,
  `tailer/{live,replay,bytes}.rs`). Excluded automatically by
  `default-features = false`. Not deleted — deleting it would make the upstream
  test suite unrunnable and rebasing harder.

## Rebasing

Keep each patch to a narrow, separately reviewable change with a comment block
naming FleetScope, so `git log`/`git diff` against a future upstream stays
readable. Re-run the full table above after every vendor change.
