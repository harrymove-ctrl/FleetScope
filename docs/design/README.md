# Design

Distilled system and feature design: how FleetScope is shaped, what each
surface owns, and which contracts an implementation must preserve.

## Read this set

- [Session Observer](session-observer.md) — current projection, graph,
  follow/replay, metadata, redaction, and safety design.
- [Google hackathon runtime](hackathon-runtime.md) — active launch-readiness
  producer architecture and live runbook.
- [Frontend experience](fleetscope-frontend-experience.md) — canonical public
  launchpad, onboarding/preloader, dashboard composition, cross-route hand-off,
  carousel and integration gates.
- [Theming](theming.md) — the colour, translucency, blur and shadow tokens,
  their light and dark scopes, how to override them, and how the WebGL lens
  reads them as shader uniforms.
- [System design](system.md) — historical enterprise event/control design;
  superseded for the current demo where it conflicts with Session Observer.
- [Architecture overview](../architecture.md) — package dependency direction
  and repository-wide boundaries; read alongside the system design.
- [Agent workspace redesign](agent-workspace/README.md) — historical `/live`
  Story/Expert decisions and acceptance gate; superseded for the current demo.
- [Web UI/UX synthesis](fleetscope-web-uiux-synthesis.md) — reference layering,
  information architecture, and evidence-first interaction principles.
- [React Bits Agent Viewer plan](react-bits-agent-viewer.md) — current
  Astro-native fallback and the prior registry integration notes.
- [Budget-constrained demo](budget-demo.md) — static-first architecture, cost
  guardrails, and recorded/live split.

## Conventions

- Design documents are canonical, progress-neutral, and status-labelled.
- Product requirements live in [`../requirements/`](../requirements/); costly
  cross-system choices live in [`../decisions/`](../decisions/).
- Lower-level designs must link upward and must not silently override a higher
  level. For `/live`, read the Agent Workspace pack before this cross-route
  document.

## When to read

Before implementing or changing a subsystem, read the applicable design and
the decisions it must honor.
