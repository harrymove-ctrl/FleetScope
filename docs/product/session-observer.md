# FleetScope — Session Observer

**Status:** active product direction

**Last updated:** 2026-08-31

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
| Judge/video Session readings poster (zero click) | `/demo` | Implemented |
| Open JSONL/JSON file or session folder | CLI and `/viewer` | Implemented |
| CLI-first example folder and copyable watch command | CLI and `/viewer` | Implemented |
| Detect Google ADK JSONL | adapter, `--formats` | Implemented |
| Parent/child agent graph and rail | CLI/browser viewer | Implemented; visual depth is one level |
| Message, tool, result, error, status inspector | viewer + `inspect` | Implemented |
| Local live follow | CLI `--follow` | Implemented |
| Local auto-follow of `.fleetscope/sessions` | `/viewer` on 127.0.0.1 | Implemented; Open folder is fallback only |
| Play, pause, step, seek, speed, return to edge | CLI/browser | Implemented |
| Unknown/waiting state instead of guessed completion | projection | Implemented and tested |
| Hidden-reasoning removal | recorder + adapter | Implemented and tested |
| Native/browser projection fingerprint | shared Rust core | Implemented and tested |
| Fixed Google ADK launch-readiness producer | `demo:google-session` | Implemented; live cloud take pending |
| Optional post-run Cloud Storage proof | producer `--upload` | Implemented; upload pending |
| Judge Cloud Console (no GCP login) | `/console` · `GET /cloud/console` | Implemented; hosted redeploy pending |

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

The model is configured by the producer, not selected by the observer UI:
`--model <id>` or `FLEETSCOPE_ADK_MODEL` controls the ADK run. Judges should open
`/demo` for the non-interactive Session readings poster; `/viewer` is the
operator flight deck that shows provenance and follows local `session.jsonl`.
Neither route starts a metered model call from the browser.

See [Session readings judge demo](session-readings-judge-demo.md).

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

Lead with the **decision workflow** (40% of judging). The viewer is proof,
not the product. Full beat sheet: [27-hour plan](../plans/final-27h.md).

| Time | Say | Show |
|---|---|---|
| 0:00–0:25 | “Four Gemini agents inspect Cloud Run and Storage, then decide READY or NOT_READY.” | Producer + ADK topology |
| 0:25–0:50 | “They run on Vertex. Here is Google Cloud.” | Console or `gcloud` + `.run.app` |
| 0:50–1:40 | “The reviewer decides from the reports, not from chat.” | `launch_reviewer` READY/NOT_READY |
| 1:40–2:20 | “FleetScope does not start the agents. It follows the JSONL.” | Split: gcloud left, TUI `--follow` right |
| 2:20–2:50 | “Budget is itself a task.” | `budget_guard` |
| 2:50–3:20 | “Finished work remains debuggable.” | Pause, seek, return to edge |
| 3:20–3:45 | “Hidden reasoning and secrets never enter the viewer.” | Redaction proof |
| 3:45–4:00 | “Gemini does the work; FleetScope makes the decision inspectable.” | Same session ID + Cloud Run revision |

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

Deadline is **1 Sep 2026 07:00 GMT+7**. Cloud Run may be torn down after the
video. Do not start `--run` without an explicit spend yes.

- optional one more Vertex `--run` for a live-follow take;
- record the four-minute video with `gcloud`/Console + TUI pair;
- verify Cloud Run URL/revision on camera (then optional teardown);
- complete Devpost category (Taskmaster), teammates, repo-sharing, diagram.

## Links

- [Idea and pitch](idea-and-pitch.md)
- [Feature flows](feature-flows.md)
- [UI/UX plan](ui-ux-plan.md)
- [Requirements](../requirements/session-observer.md)
- [Design](../design/session-observer.md)
- [Official facts](hackathon-official.md)
- [Hackathon checklist](hackathon-submission-checklist.md)
