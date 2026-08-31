# `@fleetscope/ui`

Vite + React 19 + Tailwind 4 host for **React Bits Pro** blocks.

This is **not** the FleetScope product shell. Product chrome (landing, Bend,
nav, Demo, Viewer) stays in `apps/web`. Astro iframes chrome-less embeds:

| Astro route  | Embed                   |
| ------------ | ----------------------- |
| `/approvals` | `/ui/#/embed/approvals` |
| `/dashboard` | `/ui/#/embed/dashboard` |

## Dev

```bash
pnpm dev:web   # :4321 — open this
pnpm dev:ui    # :5173 — iframe target
```

## Build into Astro static files

```bash
pnpm build:ui   # writes apps/web/public/ui/
pnpm build:web
```
