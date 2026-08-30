# Decisions

Architecture Decision Records (ADRs): the durable choices that shape
FleetScope, with the context and consequences needed to review them later.

## Read this set

- [0001 — pnpm workspaces, source-consumed packages](0001-monorepo-and-tooling.md)
  — repository and tooling boundary; read before changing package layout.
- [0002 — Fleet Cockpit renderer boundary](0002-cockpit-renderer-boundary.md)
  — renderer ownership and integration constraints.
- [0003 — Static-first, with one bounded live path](0003-bounded-live-path.md)
  — recorded versus live behavior and the allowed runtime boundary.
- [0004 — Render manifest cursor mapping](0004-render-manifest-cursor-mapping.md)
  — stable event-to-render selection; read before changing replay behavior.
- [0005 — Redaction boundaries](0005-redaction-boundaries.md)
  — trust and disclosure boundaries for captured events.
- [0006 — Vertex agent runtime with Firestore evidence ledger](0006-cloud-agent-runtime-and-ledger.md)
  — superseded historical proposal; do not use for the current product.
- [0007 — Read-only session observer](0007-session-observer-scope.md)
  — current product boundary: JSONL in, graph/follow/replay out, no agent actions.

## Conventions

- Name new entries `NNNN-<slug>.md`; numbers are monotonic and never reused.
- Record a choice that shapes system structure, crosses a component boundary,
  or is costly to reverse. Implementation details belong in
  [`../design/`](../design/).
- Keep wording progress-neutral and tracker-neutral; mark superseded decisions
  and link the replacement instead of deleting history.

## When to read

Before proposing an architecture or scope change, check the constraints this
change would affect.
