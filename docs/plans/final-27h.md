# Final 27 hours — what actually scores

**Status:** active

**Last updated:** 2026-08-31

**Deadline:** 1 Sep 2026 07:00 GMT+7. Facts: [official page](../product/hackathon-official.md).

This is sequence, not a new product. The Session Observer stays read-only.
The agent that **acts** is the Google ADK launch-readiness producer.

## Order

| # | Work | Why | Spend |
|---|---|---|---|
| 1 | Official facts + inverted pitch (this set of docs) | Stop planning against the wrong deadline; stop leading with a viewer | none |
| 2 | Split-screen operator loop: `gcloud`/Console left, FleetScope TUI right | 30% demo/readiness: live unedited proof, Cloud visible | none if using the already-recorded session |
| 3 | Optional Vertex `--run` | Fresh `modelVersion` + live follow on camera | **metered — wait for an explicit yes** |
| 4 | Four-minute video | Required. Decision workflow first, viewer second, Cloud proof on screen | none beyond the take |
| 5 | Devpost fields + Taskmaster + repo sharing | Submission | none |
| 6 | Optional Cloud Run teardown | Page says the app need not stay live after proof | saves money |

Do not: rebuild CASE-1042, add Gemma/Veo/Lyria, keep Cloud Run “for judges”,
or start `--run` without a spoken yes.

## Video beats (decision first)

| Time | Say | Show |
|---|---|---|
| 0:00–0:25 | “Four Gemini agents inspect Cloud Run and Storage, then decide READY or NOT_READY.” | Producer command + ADK topology |
| 0:25–0:50 | “They run on Vertex. Here is Google Cloud.” | Console or `gcloud run services describe` + `.run.app` |
| 0:50–1:40 | “The reviewer decides from the three reports, not from chat.” | `launch_reviewer` READY/NOT_READY in TUI inspector |
| 1:40–2:20 | “FleetScope does not start the agents. It follows the JSONL they write.” | Split: gcloud/producer left, `fleetscope --follow` right |
| 2:20–2:50 | “Budget is itself a task: six calls, two reads, zero writes.” | `budget_guard` card |
| 2:50–3:20 | “Finished work stays replayable.” | Pause, seek, `[` `]`, return to edge |
| 3:20–3:45 | “No hidden reasoning, no keys.” | Redaction / inspect line |
| 3:45–4:00 | “Gemini does the work. FleetScope makes the decision inspectable.” | Same session ID + Cloud Run revision |

## Operator loop (no new spend)

Left pane — Google CLI / recorded agy-or-ADK output:

```bash
gcloud run services describe fleetscope-web \
  --region us-central1 \
  --project project-ac0c5f88-868b-46b9-a2e
```

Right pane — Session Observer:

```bash
./target/debug/fleetscope \
  .fleetscope/sessions/<session-dir> --follow
```

That pairing is the “interact with TUI from Google Console CLI” story:
`gcloud` is the operator’s hand on Cloud; the TUI is the evidence of what the
agents did with the same resources. The TUI never shells out to `gcloud`.

## If the operator says yes to `--run`

One take only. Two terminals as in
[hackathon-runtime](../design/hackathon-runtime.md). Capture provider
`modelVersion` from `fleetscope inspect`. Do not retry. Do not add a seventh
model call.

## Open points

- Whether to spend on a fresh Vertex `--run` (blocked on operator).
- Whether to tear down Cloud Run immediately after the video.
- Taskmaster vs Fleet: recommend Taskmaster; lock on Devpost.

## Links

- [Official facts](../product/hackathon-official.md)
- [Action stack and gcloud ↔ TUI](../design/action-and-gcloud-tui.md)
- [Runtime runbook](../design/hackathon-runtime.md)
- [Checklist](../product/hackathon-submission-checklist.md)
