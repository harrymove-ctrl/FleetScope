# Action stack and gcloud ↔ TUI pairing

**Status:** draft

**Last updated:** 2026-08-31

**Scope:** how Gemini/Google Cloud **acts**, and how an operator’s Google CLI
pairs with the FleetScope TUI without turning the viewer into a control plane.

**Satisfies:** [session-observer requirements](../requirements/session-observer.md)
D2 (FleetScope reads; the producer acts), D5 (launch-readiness sequence), D8
(Taskmaster). Constrained by [ADR 0007](../decisions/0007-session-observer-scope.md).

## Mission

Judges score **action** at 40%. The system that completes a job is the Google
ADK launch-readiness producer. FleetScope remains the read-only Session
Observer. The operator uses `gcloud` (and optionally Cloud Console) in a
second pane so Cloud proof and the TUI share one screen.

## Principles

1. **The producer acts; the viewer never does.** No TUI key starts, retries, or
   authorizes a model call.
2. **Same resource, two instruments.** `gcloud run services describe` and the
   agent’s `services.get` name the same Cloud Run service. Disagreement is a
   bug, not a second source of truth.
3. **Credentials stay with Google CLI / ADC.** FleetScope does not hold a
   billable key.
4. **One session ID** ties Vertex `modelVersion`, ADK events, Cloud Run
   revision, and the TUI projection.

## Who does what

```text
Operator
  ├─ gcloud / Cloud Console     inspect the live Google project
  └─ demo:google-session [--run] start the producer (explicit spend)
        │
        ▼
Google ADK SequentialAgent (acts)
  cloud_run_probe  → Cloud Run Admin API services.get
  storage_probe    → Cloud Storage buckets.get
  budget_guard     → enforce 6 calls / 2 reads / 0 writes
  launch_reviewer  → READY | NOT_READY
        │
        ▼
session.jsonl  (append-only, redacted)
        │
        ▼
FleetScope TUI / /viewer  (observes only)
```

## Gemini / Google action stack

| Layer | Tech | Role in the 40% |
|---|---|---|
| Model | Vertex AI `gemini-3.7-flash` (Gemini 3.5+ rubric) | Model turns that choose tools and write reports |
| Orchestration | Google ADK `2.8.0` `SequentialAgent` | Completes a four-step job without a chat UI |
| Cloud action | Cloud Run `services.get`, Storage `buckets.get` | Real Google APIs, read-only, bounded |
| Decision | `launch_reviewer` | The autonomous outcome: READY / NOT_READY |
| Hosting proof | Cloud Run `fleetscope-web` + `fleetscope-api` | 30% “visible on Google Cloud”; may be deleted after the video |
| Observation | FleetScope TUI + WASM `/viewer` | Makes the action inspectable; does not perform it |
| Operator CLI | `gcloud` + ADC | Human-held Cloud identity; pairs visually with the TUI |

Antigravity CLI (`agy --print`) is a second producer dialect under the
operator’s own auth. Same rule: FleetScope follows the JSONL; it does not
launch `agy`.

## Pairing mechanism

Two fullscreen halves, same machine:

| Pane | Process | Shows |
|---|---|---|
| Left | `gcloud` or Cloud Console, or the producer tty | Identity, project, `services.describe`, Vertex log, producer stdout |
| Right | `fleetscope <session-dir> --follow` | Graph, inspector, READY/NOT_READY, tool results |

There is no IPC between `gcloud` and the TUI. Coupling is **evidence
identity**: project, service name, region, session id, `modelVersion`.

### Success flow

1. Operator authenticates with `gcloud auth application-default login`.
2. Left pane proves the Cloud Run service exists (`describe` or Console).
3. Operator starts the producer only with `--run` and the two env opt-ins.
4. Right pane follows the growing JSONL.
5. Inspector shows `services.get` / `buckets.get` results and the reviewer
   decision.
6. Left pane can re-`describe` the same service; names match.

### Failure flow

- ADC missing → producer refuses `--run`; TUI still opens any recorded file.
- Tool error → TUI keeps the call **waiting** or **failed**; it does not retry.
- Seventh model call → producer refuses before issue; TUI never invents it.
- Cloud Run deleted after the video → allowed by the official cost note;
  the recording remains the proof.

## What this is not

- A TUI command that shells out to `gcloud`.
- An MCP “control Google from the graph” loop for this deadline.
- Fortified Enterprise Fleet (registry, identity, OTel production data).
- Giving judges IAM on the GCP project. They use FleetScope `/console` and
  `GET /cloud/console` instead of `console.cloud.google.com`.

## Acceptance

- Video shows left-pane Google CLI/Console and right-pane TUI without a cut
  that hides how the session was produced.
- Inspector names `launch_reviewer` and the READY/NOT_READY text.
- `gcloud`/`describe` and the agent tool result share the same service id.
- No API key or `thought` text appears.

## Open points

- Whether a wrapper script (`demo:pair`) should launch both panes, or the
  operator tiles them by hand (current demo used two windows).
- Whether Antigravity `agy` shares the video with ADK, or ADK is the only
  billed take.

## Links

- [Official facts](../product/hackathon-official.md)
- [27-hour plan](../plans/final-27h.md)
- [Hackathon runtime](hackathon-runtime.md)
- [Paired viewers](paired-viewers.md)
- [Session Observer design](session-observer.md)
