# Agent Viewer — Gemini / Antigravity Visual Direction

> **Superseded implementation note (2026-08-30):** This file is a historical
> visual concept, not an executable source of truth. It was written against the
> stale `jasong-03/FleetScope@c67e9db` checkout and referenced a reconciliation
> note that is not present in the current repository. Do not follow that old
> absolute path or infer runtime status from this document. Verify the current
> branch/commit and inspect the [canonical frontend experience
> design](../design/fleetscope-frontend-experience.md), the Agent Workspace
> pack, and the actual source before any work. No ADK worker, Gemini 3.5+ run,
> Warden action, or Cloud Run deployment is proven by this plan; visual work is
> deferred until the mandatory live gates pass. The plan remains `/viewer`-only.

Status: superseded visual concept; follow-up implementation plan (deferred)  
Scope: `/viewer` only; preserve shared projection, WASM ABI, CLI, and all other routes.

## Mission

Redesign FleetScope Agent Viewer as a Gemini-powered, Antigravity flight deck: bright Gemini signal accents, a floating/weightless composition, and a dense terminal graph that stays legible. Use https://www.term-v0.app/ as inspiration for paper/CRT texture, generous composition, serif display type, and terminal framing. Do not copy its branding and do not make the UI resemble Claude Code.

The redesign must not change session loading, parsing, projection, fingerprinting, summaries, or Rust/WASM rendering.

Gemini/Antigravity references below describe visual direction only. They do not
claim that a Gemini model, ADK worker, asynchronous run, or live provider is
available; those claims require the separately documented submission evidence.

## Current baseline

- Worktree: `/Users/harryphan/Documents/dev/FleetScope`
- Branch: `feat/agent-viewer-cli`
- Viewer: `apps/web/src/pages/viewer.astro`
- Global shell: `apps/web/src/styles/global.css`, `apps/web/src/layouts/BaseLayout.astro`
- Browser frontend: `crates/agent-viewer-web/`
- Shared projection/rendering: `crates/agent-viewer-core/`, `crates/agent-viewer-render/`
- Local preview: `http://localhost:4323/viewer` (4321/4322 may be occupied)
- Demo invariant: `google-adk@1`, 4 agents, 20 events, fingerprint `e2728f4f985c7f33`

Before editing:
```bash
git -C /Users/harryphan/Documents/dev/FleetScope status --short --branch
git -C /Users/harryphan/Documents/dev/FleetScope branch --show-current
```

Do not modify or include unrelated untracked files: `.claude/`, `apps/web/components.json`, `apps/web/src/SKILL.md`.

## Screenshot analysis contract

The supplied screenshot is a 1536×1155 terminal graph viewport. It has a dark near-black graph surface inset ~38px inside a ~2px dark-navy rounded frame (~22px radius). The root card sits upper-left with a green status dot, large white monospace identity, yellow tool/count text, and green state text. A low-contrast gray minimap floats upper-right. Child cards occupy the middle rows, connected by green lines and arrowheads. The bottom rows are a timeline/event rail with large timestamps, agent names, dotted separators, and tool/status markers.

Eye path: root identity → child topology → active event rail → minimap. Keep the graph, not page chrome, as visual priority.

Reference tokens:
```css
--viewer-paper: #f6f7fb; --viewer-ink: #172033; --viewer-muted: #59657d;
--viewer-panel: #ffffffd9; --viewer-line: #cbd2e3;
--viewer-blue: #4285f4; --viewer-red: #ea4335; --viewer-yellow: #fbbc05;
--viewer-green: #34a853; --viewer-violet: #8b5cf6;
--viewer-terminal: #101522; --viewer-terminal-panel: #1b1d1f;
--viewer-terminal-line: #34415e; --viewer-terminal-text: #f7f7f5;
--viewer-terminal-muted: #858b98; --viewer-terminal-active: #62c568;
--viewer-terminal-agent: #e2bd00;
```

Rules: light dotted paper shell; dark graph “gravity well”; Gemini colors as small signal accents/status/focus states, not a rainbow background; Georgia/serif for display heading and `var(--fs-mono)` for telemetry; 16–24px paper radii and 8–12px terminal radii; preserve words and glyphs so status is never color-only.

## Layout and interaction

1. Add/retain a route-local `.viewer-page` wrapper around PageHeader and viewer body. Use the dot-grid paper background. Header is max-width ~1500px with serif “Agent Viewer”, `GEMINI SIGNAL` badge + multicolor orb, and copy mentioning “Gemini / Antigravity flight deck”.
2. Keep all hooks unchanged: `data-dropzone`, `data-status`, `data-fallback`, `#agent-viewer-canvas`, `data-summary`, picker buttons, and WASM loader.
3. Use floating translucent paper cards (16–20px radius). Keep canvas definite: desktop `min-height:460px; height:60vh`; mobile `min-height:360px; height:55vh`. Do not post-process or replace the WASM canvas.
4. Keep the terminal graph dark (`#101522`) with the screenshot’s own white/green/yellow/gray hierarchy.
5. Preserve plain-text summary, but render it as a dark monospace inset block with horizontal scrolling.
6. Responsive: desktop actions right; tablet actions wrap; mobile 16px padding, 28–36px heading, stacked/full-width actions, and no page-level horizontal overflow.

## Implementation tasks

### Task 1: Route-local scope

Depends on: none  
File scope: `apps/web/src/pages/viewer.astro`

Preserve behavior and add wrapper, copy, Gemini signal badge, and scoped tokens. Gate: `pnpm --filter @fleetscope/web typecheck`. Do not alter global theme, ABI, or data-loading code.

### Task 2: Paper/terminal composition

Depends on: Task 1  
File scope: `apps/web/src/pages/viewer.astro`

Implement dot-grid shell, floating cards, Gemini button states, terminal graph frame, summary treatment, measurable canvas, and responsive breakpoints. Gate with local browser desktop/mobile checks, canvas dimensions, and console logs. No page overflow.

### Task 3: Interaction and visual regression

Depends on: Task 2  
File scope: `apps/web/src/pages/viewer.astro`; touch `scripts/browser-qa.ts` only if a selector truly needs adjustment.

Verify bundled demo, buttons, file/folder affordances, drag highlight, keyboard hints, summary, and canvas rendering. Run:
```bash
pnpm --filter @fleetscope/web typecheck
pnpm exec astro build --root apps/web
pnpm qa:browser
git diff --check
```
Record viewport dimensions and screenshots.

## Acceptance criteria

- Viewer has a distinct Gemini/Antigravity identity, not Claude Code.
- Reference-inspired paper/CRT texture and floating composition are visible.
- Other routes remain unchanged.
- Canvas width and height are both > 0; no console errors.
- Demo remains `google-adk@1`, 4 agents, 20 events, fingerprint `e2728f4f985c7f33`.
- File/folder loading, summary, keyboard hints, and accessibility semantics remain intact.
- Desktop/tablet/mobile have no page-level horizontal overflow.

## Non-goals

No Rust changes, no new dependencies/fonts/icons, no backend/upload path, no nav or other-route redesign, and no replacement of the terminal graph palette with pastel colors.

## Handoff prompt

```text
Implement the Gemini / Antigravity Agent Viewer redesign in
/Users/harryphan/Documents/dev/FleetScope on branch feat/agent-viewer-cli.

Read docs/plans/agent-viewer-gemini-antigravity-plan.md, then inspect
apps/web/src/pages/viewer.astro, apps/web/src/styles/global.css, and
apps/web/src/layouts/BaseLayout.astro.

Use https://www.term-v0.app/ as inspiration for paper/CRT dot-grid, serif
display type, whitespace, and terminal framing. Make /viewer feel Gemini
powered and Antigravity-like, not like Claude Code. Use Gemini accents
#4285f4 #ea4335 #fbbc05 #34a853 #8b5cf6 around a dark terminal graph.

Touch only viewer presentation. Preserve every existing data attribute,
WASM loader, graph canvas, file/folder loading, status live region, summary,
keyboard hints, and fingerprint. Do not touch Rust projection/adapter/rendering
code, other routes, or unrelated untracked files (.claude/,
apps/web/components.json, apps/web/src/SKILL.md). Do not commit or push unless
asked.

Verify before editing:
git -C /Users/harryphan/Documents/dev/FleetScope status --short --branch
git -C /Users/harryphan/Documents/dev/FleetScope branch --show-current

Run:
pnpm --filter @fleetscope/web typecheck
pnpm exec astro build --root apps/web
pnpm qa:browser
git diff --check

Manual proof must show the demo invariant (google-adk@1, 4 agents, 20 events,
fingerprint e2728f4f985c7f33), canvas dimensions > 0, no console errors, no
horizontal overflow at three viewport sizes, and no regression on /cases or
/cockpit/CASE-1042. Finish with changed files, command output, screenshots or
viewport notes, and remaining blockers.
```
