# All Things Agentic — official facts (corrected)

**Status:** active

**Last updated:** 2026-08-31

**Source:** official Devpost page, read 2026-08-31 ~03:48 GMT+7.
[https://allthingsagentichackathon.devpost.com/](https://allthingsagentichackathon.devpost.com/)

This document overrides earlier notes that treated the deadline as 31 August
and that treated “keep Cloud Run up for judging” as required.

## Deadline

**`Sep 1, 2026 @ 7:00am GMT+7`.**

At `Mon Aug 31 2026 03:48 GMT+7` that is about **27 hours**, not a same-day
cut. A prior search snippet (“August 3 to August 31”) was wrong against the
page. Do not plan as if submission is tonight.

## Cost and deployment (page quote)

> Your app does not need to be publicly accessible or live at the exact moment
> of submission or judging (so you don't rack up unnecessary costs). You just
> need to provide clear proof that it was built and deployed on Google Cloud.

The two Cloud Run services already deployed are that proof:

- `https://fleetscope-web-6tes2q7oqa-uc.a.run.app`
- `https://fleetscope-api-6tes2q7oqa-uc.a.run.app`

Record them in the video (Console, `gcloud`, or the `.run.app` URL). After the
take, they may be deleted so they stop billing. They do not have to stay up
for judges to click.

## Judging

| Criterion | Weight | What the page rewards |
|---|---|---|
| Innovation & Operational Utility | **40%** | Autonomous, high-value **action** over chat — agents that **make decisions and complete tasks** |
| Architectural Discipline & Tech Stack | 30% | Decoupled systems, state/memory, secure credentials, failure handling |
| Demo & Production Readiness | 30% | **Live, unedited** demo, architecture diagram, reproducible setup, visible Google Cloud proof |

### Scoring risk

FleetScope-the-viewer is observation. A JSONL graph does not earn the 40%
action criterion by itself.

The scoring product is **`launch_readiness`**: a Google ADK `SequentialAgent`
with four children (`cloud_run_probe`, `storage_probe`, `budget_guard`,
`launch_reviewer`) that call real Google APIs and issue **READY / NOT_READY**.
The Session Observer is the evidence surface for that workflow.

Devpost copy and the video must lead with the decision workflow. Leading with
the viewer is volunteering to forfeit the heaviest criterion.

## Track

Checklist still says **The Taskmaster**. Reconsider once, then lock:

| Track | Fit | Risk |
|---|---|---|
| **The Taskmaster** | Producer completes a fixed multi-step job and a decision | Matches what we can prove |
| Fortified Enterprise Fleet | Page text lists registry, identity, observability / OTel traces | We do not have production data or enterprise compliance proof |

Recommendation remains Taskmaster. Fleet is a worse mismatch than the page
wording suggests. Do not switch unless a new evidence bundle appears before
the deadline.

## Video (required, ~4 minutes)

Must include:

1. Problem + value proposition (first ~20 seconds).
2. The app actually running (not slides only).
3. **Proof the backend ran on Google Cloud** — Console, Cloud Run dashboard,
   Vertex logs, or a `.run.app` URL.

Live and unedited. Test the public link in a private window.

## Optional bonus

- Public write-up (Medium / dev.to / YouTube) that **states it is for this
  hackathon**.
- Social post with **`#AllThingsAgenticHackathon`**.
- Extra integration of Gemma / Veo / Lyria — skip unless it is already built.

## Remaining order

1. Lock this page (done).
2. Invert pitch and video so the **decision workflow** is first.
3. Optional: one more Vertex `--run` if the operator explicitly spends.
4. Record the four-minute take: `gcloud`/Console + TUI pair.
5. Fill Devpost. Tear down Cloud Run after the video if cost matters.

`pnpm demo:google-session -- --run` spends real money. Do not start it from
this document.

## Links

- [27-hour plan](../plans/final-27h.md)
- [Action stack and gcloud ↔ TUI](../design/action-and-gcloud-tui.md)
- [Submission checklist](hackathon-submission-checklist.md)
- [Idea and pitch](idea-and-pitch.md)
