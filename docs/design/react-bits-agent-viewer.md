# React Bits Pro UI plan for Agent Viewer

Status: planned
Last updated: 2026-08-28

## Why use it

React Bits Pro can speed up the onboarding Dashboard and signed-in product UI,
but FleetScope's core viewer remains the Zoetrope-derived Rust/WASM renderer.
React Bits should provide shell, navigation, onboarding, settings, and light
motion—not replace the event graph or timeline renderer.

## Current compatibility note

FleetScope's web app is currently Astro and has no `components.json`. Do not run
the shadcn installer in the repository until a React island/package and Tailwind
boundary are intentionally added. The first integration target should be a
small React Agent Viewer shell, not a framework-wide migration.

## Planned UI composition

### Dashboard onboarding

- App shell/sidebar with Dashboard, Sessions, Agent Viewer, and Settings.
- First-run onboarding card with six steps: runtime check, workspace, local
  permission, adapter check, sample session, finish.
- Empty and failed-check states with one concrete next action.
- Recent/live session cards with agent count and last-known state.

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

The Agent Kit skill can then be installed with:

```bash
npx shadcn@latest add @reactbits-starter/skill
```

Before installing any Pro App UI block, verify the license tier. Never put the
bearer token in source, documentation, Tracking, or a commit.

## Integration gate

Adopt React Bits only when the React boundary, Tailwind tokens, `cn()` helper,
and `.env.local` are present. The onboarding Dashboard must remain usable with
reduced motion and without WebGL. The Agent Viewer must still load and operate
if optional React Bits effects fail.
