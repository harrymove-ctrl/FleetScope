# FleetScope documentation

**Current product:** the read-only Session Observer — JSONL in, graph,
inspector, live follow, and replay out.

Start here:

1. [Idea and pitch](product/idea-and-pitch.md) — current idea, Taskmaster fit,
   verbal pitch, and deck outline.
2. [Pitch and video script](product/pitch-and-video-script.md) — the spoken
   script for the deck and the demo video, with verified commands.
3. [Session Observer product brief](product/session-observer.md) — feature map,
   Google workflow, truth contract, and four-minute demo.
4. [Session Observer requirements](requirements/session-observer.md) — problem,
   scope, success measures, non-goals, and open points.
5. [Session Observer design](design/session-observer.md) — adapters, projection,
   live/replay state, failure behavior, and minimal hosted proof.
6. [Google runtime runbook](design/hackathon-runtime.md) — zero-cost validation,
   real run, live follow, and cloud evidence capture.
7. [Official hackathon facts](product/hackathon-official.md) — deadline,
   40/30/30 rubric, Cloud Run may be deleted after the video.
8. [Hackathon checklist](product/hackathon-submission-checklist.md) — Gemini,
   Google ADK, Cloud Run/Storage, video, repo, and Devpost gates.
9. [Architecture overview](architecture.md) — repository package boundaries.

## Navigation

- [Product](product/README.md) — what FleetScope promises and how it demos.
- [Requirements](requirements/README.md) — what must be true.
- [Design](design/README.md) — how each surface is shaped.
- [Decisions](decisions/README.md) — ADRs, including the superseded enterprise
  runtime and the accepted Session Observer boundary.
- [Plans](plans/README.md) — remaining sequence and validation gates.

## Scope rule

The superseded CASE-1042 enterprise story — Case, Warden, Model Armor, ERP,
Firestore, Pub/Sub, Agent Catalog, Fleet Cockpit — was removed from this tree on
2026-08-31. It survives in git history and nowhere else, because a document that
exists only to say it is deprecated still costs a reader the time to find that
out. Do not reintroduce it to expand the Session Observer demo.

The only ADR that still records that story is
[0006](decisions/0006-cloud-agent-runtime-and-ledger.md), kept because ADRs are
superseded rather than deleted.

## Verification rule

A local fixture, configured model string, dependency, screenshot, or green unit
test is not Google Cloud execution proof. The live hackathon label requires the
same session ID tied to provider-owned Gemini `modelVersion`, real Google ADK
events, and visible Cloud Run deployment evidence. Cloud Storage upload is an
optional matching artifact, not a substitute for the running backend proof.
