# FleetScope — Session Observer

**Status:** active product direction

**Last updated:** 2026-08-30

## Product promise

> **Watch your agents work.** Gemini and Google ADK write an append-only JSONL
> session. FleetScope lays it out as a graph so you can see which agents ran,
> what each one did, what is waiting, and what failed. Follow a growing session
> or replay a finished one.

FleetScope is a read-only observability viewer. The producer owns execution and
the session log; FleetScope never starts, retries, approves, or mutates an agent
action.

## User and job

One developer building, debugging, or demonstrating a multi-agent workflow
needs to answer:

- Which agents actually ran?
- What task and tool call belongs to each agent?
- Which call never returned or explicitly failed?
- What happened immediately before and after that event?
- Can this exact session be explained again without rerunning it?

## Feature map

| Feature | Surface | Status |
|---|---|---|
| Open JSONL/JSON file or session folder | CLI and `/viewer` | Implemented |
| Detect Google ADK JSONL | adapter, `--formats` | Implemented |
| Parent/child agent graph and rail | CLI/browser viewer | Implemented; visual depth is one level |
| Message, tool, result, error, status inspector | viewer + `inspect` | Implemented |
| Local live follow | CLI `--follow` | Implemented |
| Play, pause, step, seek, speed, return to edge | CLI/browser | Implemented |
| Unknown/waiting state instead of guessed completion | projection | Implemented and tested |
| Hidden-reasoning removal | recorder + adapter | Implemented and tested |
| Native/browser projection fingerprint | shared Rust core | Implemented and tested |
| Fixed Google ADK launch-readiness producer | `demo:google-session` | Implemented; live cloud take pending |
| Optional post-run Cloud Storage proof | producer `--upload` | Implemented; upload pending |

## Google demo workflow

`launch_readiness` is a Google ADK `SequentialAgent` with four direct
children:

```text
launch_readiness
├── cloud_run_probe  — Cloud Run services.get
├── storage_probe    — Cloud Storage buckets.get
├── budget_guard     — six calls (2/2/1/1) / ≤180s / two reads / zero workflow writes
└── launch_reviewer  — READY or NOT_READY
```

The default is Vertex AI `gemini-3.7-flash`, satisfying the Gemini 3.5+
rubric when the provider actually emits that model version. Google ADK is pinned
at `2.8.0`.

The expected call budget is exact: two model turns for each tool-using probe,
one for `budget_guard`, and one for `launch_reviewer`. The same 2/2/1/1
allocation is enforced before each provider call; a seventh call is refused
before it is issued.

## Input and truth contract

```text
ADK Event JSONL
  → incremental redaction
  → format detection
  → Google ADK adapter
  → provider-neutral ViewerSession
  → shared projection
  → CLI TUI / browser / inspect
```

Rules:

1. An explicit provider terminal event outranks inference.
2. An unanswered tool call remains waiting.
3. `thought: true` is dropped before persistence and again at ingestion.
4. Secret-shaped fields are redacted before a JSONL line is flushed.
5. `configuredModel` means configuration only.
6. Only top-level ADK `modelVersion` is provider-observed model evidence.
7. Live and replay use one event timeline; only the right edge changes.

## Four-minute demo

| Time | Say | Show |
|---|---|---|
| 0:00–0:20 | “Multi-agent JSONL is hard to read. FleetScope lets you watch the work.” | Raw JSONL → landing/viewer |
| 0:20–0:45 | “Google ADK is running four fixed launch-readiness tasks.” | Producer command, ADK 2.8.0, Vertex/Cloud evidence |
| 0:45–1:20 | “Here is the team.” | `fleetscope inspect`: root + four children + observed model |
| 1:20–2:00 | “Here is what each agent is doing.” | Follow the growing file; inspect Cloud Run and Storage tools/results |
| 2:00–2:25 | “The budget itself is a visible task.” | `budget_guard`: 6 calls, 180s, 2 reads, 0 workflow writes |
| 2:25–2:50 | “The reviewer decides only from the reports.” | `launch_reviewer` and READY/NOT_READY |
| 2:50–3:25 | “Finished work remains debuggable.” | Pause, seek, step, speed, return to edge |
| 3:25–3:45 | “Hidden reasoning and secrets never enter the viewer.” | Redaction test/proof; no thought content |
| 3:45–4:00 | “Gemini does the work; FleetScope makes it visible.” | Browser graph + same session/proof ID |

## Google Cloud choice

- **Vertex AI** runs Gemini through ADC/service identity.
- **Cloud Run** hosts the demo viewer or read-only session endpoint and is one
  real resource inspected by the workflow.
- **Cloud Storage** stores the optional finished redacted JSONL/proof bundle.
- **Firestore, Cloud SQL, and Pub/Sub** are unnecessary for an immutable session
  observer and are excluded from this demo.

## Submission category

Use **The Taskmaster**. The ADK producer completes a real multi-step
launch-readiness workflow; FleetScope makes that autonomous work observable and
replayable.

## Remaining live gates

- choose the real Google Cloud project, region, Cloud Run service, and bucket;
- verify `gemini-3.7-flash` is available in that Vertex region/account;
- run exactly one metered session and capture provider `modelVersion`;
- optionally upload the finished redacted bundle;
- verify the Cloud Run URL/revision and same session ID in the video;
- complete deep viewer interaction QA in a normal desktop environment (the
  launchpad viewport suite passes; the current Playwright viewer suite hung
  after opening IPC and was stopped);
- complete Devpost category, teammate, repo-sharing, URL, diagram, and video
  checks.

## Links

- [Idea and pitch](idea-and-pitch.md)
- [Feature flows](feature-flows.md)
- [UI/UX plan](ui-ux-plan.md)
- [Requirements](../requirements/session-observer.md)
- [Design](../design/session-observer.md)
- [Hackathon checklist](hackathon-submission-checklist.md)
