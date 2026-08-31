# FleetScope idea and pitch

**Status:** active

**Last updated:** 2026-08-31

## One-line idea

> **Four Gemini agents inspect Cloud Run and Storage, then decide READY or
> NOT_READY. FleetScope lets you watch that decision.**

The scoring product is the Google ADK launch-readiness workflow (40% of the
rubric is autonomous action). FleetScope is the observation window, not the
runtime. It never launches, retries, approves, or mutates an agent action.

## The real problem

Multi-agent workflows are difficult to debug and almost impossible to demo from
raw logs. One session may contain several agents, repeated model turns, tool
calls, results, errors, and partial events. A developer scrolling JSONL cannot
quickly answer:

- Which agents actually ran?
- What task did each agent perform?
- Which tool is still waiting or failed?
- What did the session explicitly mark complete?
- Can I replay the same evidence without paying for another run?

## The solution

FleetScope reads the producer-owned session and projects four synchronized
views: an agent rail, parent/child graph, event inspector, and timeline. The same
event log drives local live follow and finished replay. A moving right edge is
live; a fixed right edge is replay. The product does not maintain a second,
invented version of session truth.

## The Google demo case

The concrete producer is `google-cloud-launch-readiness`. Google ADK runs a
`SequentialAgent` so all four tasks execute and all four direct children remain
visible in FleetScope's current one-level graph:

1. `cloud_run_probe` performs read-only Cloud Run `services.get`.
2. `storage_probe` performs read-only Cloud Storage `buckets.get`.
3. `budget_guard` verifies the six-call, 180-second, two-read, zero-workflow-
   write budget and FleetScope's read-only role.
4. `launch_reviewer` returns `READY` or `NOT_READY` from the three reports.

Vertex AI `gemini-3.7-flash` is the configured default and Google ADK
`2.8.0` is pinned. The log distinguishes that configured model from the
provider-owned `modelVersion` observed on actual events.

## Why this is useful

| Without FleetScope | With FleetScope |
|---|---|
| Read thousands of JSON fields | See the agent topology first |
| Guess whether silence means done | Missing terminal evidence stays unknown |
| Re-run to explain what happened | Replay the same finished session |
| Lose a live failure in terminal output | Follow the growing JSONL at the live edge |
| Trust a configured model label | Separate configuration from provider-observed proof |
| Risk exposing hidden reasoning | Drop `thought: true` before rendering |

## Positioning note — Google Cloud reference

The Google Cloud Financial Services reference reinforces the product language
around explainability, traceable evidence, reusable skills, and secure system
connections. FleetScope borrows those ideas as positioning only: the demo is
still the small Google ADK launch-readiness workflow above. It does not claim a
financial-services workflow, MCP connector catalog, KYC/portfolio analysis, or
an enterprise control plane.

## Target user

The first user is one developer building, debugging, or demonstrating a
multi-agent workflow. The value is speed and truth: understand a session without
changing it.

## Hackathon category

**The Taskmaster** is the strongest fit. The producer completes a fixed,
multi-step launch-readiness workflow by calling real Google Cloud APIs and
issuing one evidence-based decision. FleetScope then proves the work happened.

Collaborative Partner is a weaker fit because this flow does not lead a user
through clarifying questions or learn from feedback. Fortified Enterprise Fleet
would require the registry, long-running memory, identity, gateway, and
compliance scope that was deliberately removed.

## 30-second pitch

> “Gemini does not chat here. Google ADK runs four launch-readiness agents:
> they inspect Cloud Run and Cloud Storage, enforce a six-call budget, and
> the reviewer issues READY or NOT_READY. FleetScope does not start those
> agents — it follows the JSONL they write, beside `gcloud` on the same
> screen, so you can see the decision and the Google Cloud resource it
> inspected. Gemini does the work; FleetScope makes the work inspectable.”

## Pitch deck

| Slide | Message | Visual proof |
|---|---|---|
| 1. Problem | Launch readiness is a multi-step job, not a chat | Four agents, one decision |
| 2. Action | Gemini/ADK inspects Cloud Run + Storage and decides READY/NOT_READY | Producer + Cloud Console / `gcloud` |
| 3. Evidence | FleetScope follows the JSONL; it does not run the agents | Split: CLI left, TUI right |
| 4. Trust | Ground truth beats inference; hidden reasoning is removed | Unknown/waiting + redaction |
| 5. Architecture | Vertex + ADK + Cloud Run + Storage, one session ID | Diagram + `.run.app` |
| 6. Replay | Finished work stays debuggable without another billed run | Pause, seek, return to edge |

## Claim discipline

- `configuredModel` is configuration, not proof of execution.
- Only provider-owned `modelVersion` earns the model evidence label.
- A local growing file is **Local live follow**, not Google Cloud deployment
  proof.
- A finished file is **Replay**, even when it came from a real cloud run.
- FleetScope may say it observed a Cloud action; it never says it performed one.
- CASE-1042/Warden/Firestore/Pub/Sub is a superseded story and must not appear in
  the current pitch or video.

## Links

- [Session Observer product brief](session-observer.md)
- [Feature flows](feature-flows.md)
- [UI/UX plan](ui-ux-plan.md)
- [Runtime design](../design/hackathon-runtime.md)
- [Official facts](hackathon-official.md)
- [27-hour plan](../plans/final-27h.md)
- [Hackathon checklist](hackathon-submission-checklist.md)
- [Pitch and video speaking script](pitch-and-video-script.md)
