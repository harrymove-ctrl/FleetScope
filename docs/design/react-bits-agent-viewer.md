# React Bits Pro UI plan for Agent Viewer

Status: Astro fallback retained; React Bits live in apps/ui
Last updated: 2026-08-31

> This document records the current dependency-free Astro fallback. It must not
> be read as evidence that a proprietary registry item was installed. The
> launchpad design that once owned the React Bits and OriginKit gates was the
> superseded enterprise shell, deleted on 2026-08-31; those gates are unowned
> until something current claims them.

> The warm Story surface mentioned below is a historical/deferred `/cockpit`
> composition only. It does not apply to `/live`, whose near-black Agent
> Workspace pack remains authoritative.

## Why use it

React Bits Pro informed the onboarding Dashboard and product presentation, but
FleetScope's core viewer remains the Zoetrope-derived Rust/WASM renderer. The
roles adopted here provide shell framing, identity, and light motion. They do
not replace the event graph, timeline, canonical cursor, or evidence adapter.

## Current compatibility note

FleetScope's product web app (`apps/web`) is Astro with no React runtime. As of
2026-08-31 the local `REACTBITS_LICENSE_KEY` is configured in gitignored
`.env.local` and the `@reactbits-starter` / `@reactbits-pro` registries
authenticate successfully (`shadcn view` / `shadcn add` work).

**Do not install `@astrojs/react` into `apps/web`:** it breaks Astro CSS virtual
modules (`Missing field moduleType`) and unstyles the site. React Bits TSX lives
in a separate Vite app:

- **`apps/ui`** — React 19 + Tailwind 4 + React Bits Pro App UI (`pnpm dev:ui`).
  Chrome-less embeds at `#/embed/approvals` and `#/embed/dashboard` are iframes
  inside Astro `/approvals` and `/dashboard` (FleetScope nav + landing intact).
  Bare `:5173` is a lab banner only — not the product shell.
- **`apps/web`** — Astro static product surfaces (recorded Approval Card,
  onboarding Dashboard, `/demo`, `/viewer`) stay dependency-free.

HITL/Approvals in Astro keep the Astro-native Approval Card. Pro blocks are
exercised in `apps/ui` until a future product decision merges the shells.

The approved roles were otherwise implemented with dependency-free Astro, SVG,
and CSS:

- `TerminalWindow.astro` for command/workstation framing;
- `AgentIdentity.astro` and `lib/agent-identity.ts` for deterministic actors;
- a staggered Story entrance that disappears under reduced motion;
- a static Dashboard terminal/device preview;
- a warm recorded Story surface around the deferred `/cockpit` evidence
  interactions; it is not a `/live` visual rule.

This preserves a small static Story fallback and avoids adding React, Tailwind,
WebGL, GSAP, or a license secret solely for decoration.

## Implemented composition

### Dashboard onboarding

- App shell/sidebar with Dashboard, Sessions, Agent Viewer, and Settings.
- First-run onboarding card with six steps: runtime check, workspace, local
  permission, adapter check, sample session, finish.
- Empty and failed-check states with one concrete next action.
- A bundled or explicitly chosen session card with adapter-reported metadata;
  no browser-invented recent/live session list. A live-capability card may be
  shown only after a fresh, verified capability response.

### Agent Viewer shell

- Dense app layout around the existing WASM canvas.
- Command menu for Open session, Follow live, Pause, Replay, and Return to live.
- Setup/controls drawer grouped as Observe, Playback, and Safety.
- Detail drawer for selected agent, prompt, tool call, output, and error.
- Subtle entrance/transition motion only; timeline and graph state remain
  authoritative and deterministic.

## React Bits selection rules

- Prefer App UI blocks for dashboard, onboarding, settings, command menu, and
  agent/AI surfaces; these require a Pro or Ultimate license.
- Prefer Starter `-tw` components for small motion accents where Tailwind is
  available.
- Do not use shader/WebGL backgrounds behind the live graph; they compete with
  agent topology and increase rendering cost.
- Do not install a block until its registry metadata and export style are read.
- Harmonize every installed block to FleetScope tokens, density, radius, and
  reduced-motion behavior.

## Local configuration (never commit the key)

Use an environment variable in `.env.local`:

```text
REACTBITS_LICENSE_KEY=<local-license-key>
```

If a React package is introduced, merge these registries into its existing
`components.json` without replacing other fields:

```json
{
  "registries": {
    "@reactbits-starter": {
      "url": "https://pro.reactbits.dev/api/r/starter/{name}.json",
      "headers": { "Authorization": "Bearer ${REACTBITS_LICENSE_KEY}" }
    },
    "@reactbits-pro": {
      "url": "https://pro.reactbits.dev/api/r/pro/{name}.json",
      "headers": { "Authorization": "Bearer ${REACTBITS_LICENSE_KEY}" }
    }
  }
}
```

If the React boundary and entitlement gates pass, the Agent Kit skill would be
installed with:

```bash
npx shadcn@latest add @reactbits-starter/skill
```

Before installing any Pro App UI block, verify the license tier. Never put the
bearer token in source, documentation, Tracking, or a commit.


## Content rule (locked 2026-08-31)

Never ship React Bits **registry demo copy** in product embeds.

| Surface | Allowed meaning | Forbidden leftovers |
|---------|-----------------|---------------------|
| `/dashboard` embed | Session readiness (Empty / Checking / Ready + product commands) | Net revenue, MRR, churn, paid accounts |
| `/approvals` embed | `launch_readiness` HITL (budget +2, GCS upload once, confirm READY) | Delete projects, Acme refunds, API tokens, tickets |

Source of truth: `apps/ui/src/content/{readiness,launch-hitl}.ts` rendered by `apps/ui/src/components/fleet/*`.

## Integration gate

Installing proprietary React Bits source remains a separate future decision.
Do it only when a real React boundary, Tailwind tokens, `cn()` helper, and a
locally held license are present. The current onboarding Dashboard works without
WebGL, Story works before JavaScript/WASM, and every presentation enhancement
has a static or reduced-motion form.

The full prerequisite, tier, export-style, isolation, and removal gates shared
by React Bits and OriginKit lived in the superseded launchpad design and were
deleted with it on 2026-08-31. Recover them from git history if that work
restarts.

## Verification

- deterministic identity is keyed by canonical agent ID, not list position;
- every identity keeps the readable actor name and historical status;
- recorded UI never says `online`, `thinking`, or `live now`;
- Story and Agent Viewer retain their existing cursor and selection contracts;
- browser QA covers the three supported desktop viewports and reduced motion;
- mobile navigation scrolls inside its strip rather than widening the body.
