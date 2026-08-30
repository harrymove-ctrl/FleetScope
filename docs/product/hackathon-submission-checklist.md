# All Things Agentic Hackathon submission checklist

**Status:** cloud and runtime proof captured 2026-08-31; video and Devpost fields pending

**Last updated:** 2026-08-30

## Category

- [ ] Select **The Taskmaster** in Devpost.
- [ ] Description explains the multi-step launch-readiness workflow and
  FleetScope's read-only observation/replay value.
- [ ] Do not use Collaborative Partner unless the product is changed to center
  clarification and feedback.
- [ ] Do not use Fortified Enterprise Fleet or CASE-1042 claims.

## Required Google stack

- [x] **Gemini 3.5+:** run `e-04e1149b-7b8b-4529-951d-9029e6c7bfdb` on
  2026-08-31 records provider `modelVersion` `gemini-3.7-flash` across six
  model calls. Observed from the provider, not read back from configuration.
- [x] **Google agent framework in code:** `google-adk==2.8.0` constructs the
  fixed `SequentialAgent` and four direct child agents.
- [x] **Google agent framework at runtime:** the same session records
  `producer google-adk 2.8.0`, five agents -- `launch_readiness` over
  `budget_guard`, `cloud_run_probe`, `launch_reviewer`, `storage_probe` -- and
  fifteen events.
- [x] **Google Cloud service:** Cloud Run serves the viewer at
  `https://fleetscope-web-6tes2q7oqa-uc.a.run.app`, revision
  `fleetscope-web-00001-g4s`, region `us-central1`, project
  `project-ac0c5f88-868b-46b9-a2e`. Verified 2026-08-31: `/`, `/viewer/` and
  `/dashboard/` return 200 text/html and the projection runtime is served as
  `application/wasm`. The bounded read-only API is a second Cloud Run service,
  `https://fleetscope-api-6tes2q7oqa-uc.a.run.app`, revision
  `fleetscope-api-00001-qtm`; `/health` and `/capability` both answer 200 and
  report `liveMode: false`, so the deployment is recorded-only until a live
  run is explicitly opted into.
- [ ] **Cloud artifact:** optionally show the matching redacted JSONL/proof
  object and generation in Cloud Storage.
- [x] All runtime/framework/cloud evidence uses the same session ID,
  `e-04e1149b-7b8b-4529-951d-9029e6c7bfdb`, projection `ef62b782198ed6b3`.

## Workflow proof

- [x] `cloud_run_probe` is fixed to one read-only `services.get`.
- [x] `storage_probe` is fixed to one read-only `buckets.get`.
- [x] `budget_guard` verifies six calls, ≤180 seconds, two reads, zero workflow
  writes, and FleetScope's read-only role.
- [x] `launch_reviewer` consumes all three reports and produces READY/NOT_READY.
- [x] A seventh model call is refused before it is issued.
- [x] `--run` requires explicit spend and Vertex opt-ins.
- [x] `--upload` requires `--run` and occurs only after agents finish.
- [x] JSONL is flushed event-by-event for live follow.
- [x] Thought parts and secret-shaped keys are removed before persistence.
- [x] Configured and provider-observed model versions are separate.
- [x] Real workflow run captured: decision `READY`, six model calls
  (cloud_run_probe 2, storage_probe 2, budget_guard 1, launch_reviewer 1),
  both tool calls answered, zero failed events.

## Product demo proof

- [ ] Open the same real/redacted ADK JSONL in `fleetscope inspect`.
- [ ] Show `producer google-adk 2.8.0 · model <observed>`.
- [ ] Show root plus four direct children.
- [ ] Follow the growing JSONL and inspect Cloud Run/Storage calls and results.
- [ ] Show budget report and final launch decision.
- [ ] Pause, seek, step, change speed, and return to edge.
- [ ] Show missing terminal/unanswered calls remain unknown/waiting.
- [ ] Show hidden thought text is absent.
- [ ] Show the finished session in `/viewer` and matching projection proof.

## Repository package

- [x] Root README contains local setup, zero-cost dry-run, live command, safety
  gates, and test commands.
- [x] Worker README documents exact agents, operations, budget, redaction, and
  evidence.
- [x] Architecture diagram exists in the active design docs.
- [x] Local product, pitch, feature-flow, UI/UX, requirements, design, ADR, and
  runbook docs tell the Session Observer story.
- [x] Full automated gate suite passes for the current working tree (Python, Rust, TypeScript,
  Astro, WASM, formatting, lint, and type checks on 2026-08-30).
- [ ] Deep viewer interaction QA passes in a normal desktop environment (launchpad viewport QA is green; viewer suite currently hangs before reporting results).
- [ ] Repository URL is linked.
- [ ] If private, share with `testing@devpost.com` and
  `cloudhackathons@google.com`.

## Video and hosted project

- [ ] Public video is under four minutes.
- [ ] Test the video in an incognito window.
- [ ] First 20 seconds state the problem and value.
- [ ] Video shows the app in action, not only slides/logos.
- [ ] Video visibly proves Cloud Run/Google Cloud backend state.
- [ ] No API key, credential, private prompt, hidden reasoning, or unsafe payload
  is visible.
- [ ] Hosted URL is entered on Devpost. It works:
  `https://fleetscope-web-6tes2q7oqa-uc.a.run.app`
- [ ] Testing credentials/instructions are included if gated.
- [ ] Architecture diagram is uploaded.

## Team and Devpost fields

- [ ] All teammates are added and invitations accepted.
- [ ] Features/functionality match the current docs.
- [ ] Technologies list Vertex AI, Gemini, Google ADK, Cloud Run, Cloud Storage,
  Rust, Astro/WASM, and JSONL only where actually used.
- [ ] Data sources say Cloud Run service metadata and Cloud Storage bucket
  metadata; no object contents are read.
- [ ] Findings/learnings include append-only projection, ground truth over
  inference, configured-vs-observed proof, and live/replay as one timeline.

## Current evidence status

| Gate | Status |
|---|---|
| Fixed ADK topology constructs | Verified locally |
| Zero-cost dry-run | Verified locally |
| Safe Cloud response projection | Verified locally |
| Thought/secret redaction | Verified locally |
| Configured vs observed model handling | Verified locally in Python/Rust |
| Rust five-node adapter graph | Verified locally |
| Full workspace gates | Verified locally on 2026-08-30 |
| Launchpad browser QA | Verified across 375, 768, 1024, 1440, and 2560px viewports |
| Real Vertex model event | gemini-3.7-flash observed, 2026-08-31 |
| Cloud Run URL/revision | fleetscope-web-00001-g4s, verified 2026-08-31 |
| Cloud Storage generation | Missing/optional |
| Deep viewer interaction QA | Unverified: Playwright opened IPC but hung for 90s and was stopped |
| Devpost/video/team/repo sharing | Requires authenticated review |

## Claim discipline

A dependency pin, configured model, fixture, screenshot, or green unit test is
not provider execution proof. Use **Live Google demo** only when one session
ties provider `modelVersion`, ADK events, Cloud Run deployment evidence, and
the graph together.

## Links

- [Product brief](session-observer.md)
- [Idea and pitch](idea-and-pitch.md)
- [Runtime runbook](../design/hackathon-runtime.md)
- [Devpost](https://allthingsagentichackathon.devpost.com/)
