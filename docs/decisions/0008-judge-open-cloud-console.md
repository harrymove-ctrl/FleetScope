# 0008 — Judges open Cloud Console, then launch_readiness

- **Status:** Accepted
- **Date:** 2026-08-31

## Context

FleetScope has three judge-visible opens: Cloud Console (`/console`), Agent
Viewer (`/viewer`), and Session readings (`/demo`). The 40% rubric scores
agents that decide and finish tasks. Opening the graph first reads as a
viewer product and forfeits that criterion. Google Cloud Console
(`console.cloud.google.com`) requires project IAM judges do not have.

## Decision

The first beat is FleetScope **Cloud Console** showing the
**launch_readiness** READY/NOT_READY decision. Agent Viewer and the TUI are
proof that the same session is inspectable. A short **UI** (`apps/ui`) beat
may follow Agent Viewer. UI does not replace Agent Viewer. Google Cloud
Console stays operator-only.

## Alternatives considered

### Agent Viewer first

Rejected for judging. The graph is evidence, not the action.

### Session readings `/demo` first

Rejected as the lead. Useful as a zero-click poster after the decision is
on screen.

### Google Cloud Console as the lead

Rejected. Judges cannot log in.

## Consequences

- Talk track and Devpost testing notes start at `/console`.
- Video must name launch_readiness before Agent Viewer.
- Case routes may remain in the app as history and must not lead.
