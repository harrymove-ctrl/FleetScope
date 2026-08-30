# FleetScope documentation

**Current product:** the read-only Session Observer — JSONL in, graph,
inspector, live follow, and replay out.

Start here:

1. [Idea and pitch](product/idea-and-pitch.md) — current idea, Taskmaster fit,
   verbal pitch, and deck outline.
2. [Session Observer product brief](product/session-observer.md) — feature map,
   Google workflow, truth contract, and four-minute demo.
3. [Session Observer requirements](requirements/session-observer.md) — problem,
   scope, success measures, non-goals, and open points.
4. [Session Observer design](design/session-observer.md) — adapters, projection,
   live/replay state, failure behavior, and minimal hosted proof.
5. [Google runtime runbook](design/hackathon-runtime.md) — zero-cost validation,
   real run, live follow, and cloud evidence capture.
6. [Hackathon checklist](product/hackathon-submission-checklist.md) — Gemini,
   Google ADK, Cloud Run/Storage, video, repo, and Devpost gates.
7. [Architecture overview](architecture.md) — repository package boundaries.

## Navigation

- [Product](product/README.md) — current brief plus historical product notes.
- [Requirements](requirements/README.md) — current requirements plus deprecated
  enterprise modules.
- [Design](design/README.md) — current design plus deprecated system proposals.
- [Decisions](decisions/README.md) — ADRs, including the superseded enterprise
  runtime and the accepted Session Observer boundary.
- [Plans](plans/README.md) — current entry point and historical plans.
- [Reports](reports/README.md) — dated command/evidence records.
- [Handoffs](handoffs/README.md) — continuation prompts and historical handoffs.

## Scope rule

The old CASE-1042 enterprise Case, Warden, Model Armor, ERP, Firestore, and
Pub/Sub materials are retained for traceability only. They are marked
deprecated/superseded and must not be used to expand the Session Observer demo.

## Verification rule

A local fixture, configured model string, dependency, screenshot, or green unit
test is not Google Cloud execution proof. The live hackathon label requires the
same session ID tied to provider-owned Gemini `modelVersion`, real Google ADK
events, and visible Cloud Run deployment evidence. Cloud Storage upload is an
optional matching artifact, not a substitute for the running backend proof.
