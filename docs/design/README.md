# Design

Distilled system and feature design: how FleetScope is shaped, what each
surface owns, and which contracts an implementation must preserve.

## Read this set

- [Session Observer](session-observer.md) — current projection, graph,
  follow/replay, metadata, redaction, and safety design.
- [Paired Agent Viewer](paired-viewers.md) — TUI + `/viewer` usage,
  fullscreen, why the TUI felt unusable, and view-state pairing.
- [Google hackathon runtime](hackathon-runtime.md) — active launch-readiness
  producer architecture and live runbook.
- [Action stack and gcloud ↔ TUI](action-and-gcloud-tui.md) — who acts (ADK),
  who observes (TUI), how `gcloud` pairs on a second pane.
- [Theming](theming.md) — the colour, translucency, blur and shadow tokens,
  their light and dark scopes, how to override them, and how the WebGL lens
  reads them as shader uniforms.
- [React Bits Agent Viewer](react-bits-agent-viewer.md) — the Astro-native
  fallback and why the registry integration was not taken.
- [Architecture overview](../architecture.md) — package dependency direction
  and repository-wide boundaries.

## Conventions

- Design documents are canonical, progress-neutral, and status-labelled.
- Product requirements live in [`../requirements/`](../requirements/); costly
  cross-system choices live in [`../decisions/`](../decisions/).
- Lower-level designs must link upward and must not silently override a higher
  level.

## When to read

Before implementing or changing a subsystem, read the applicable design and
the decisions it must honor.
