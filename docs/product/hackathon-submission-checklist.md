# All Things Agentic Hackathon submission checklist

**Status:** local implementation in review; authenticated/cloud/video proof pending

**Last updated:** 2026-08-30

## Category

- [ ] Select **The Taskmaster** in Devpost.
- [ ] Description explains the multi-step launch-readiness workflow and
  FleetScope's read-only observation/replay value.
- [ ] Do not use Collaborative Partner unless the product is changed to center
  clarification and feedback.
- [ ] Do not use Fortified Enterprise Fleet or CASE-1042 claims.

## Required Google stack

- [ ] **Gemini 3.5+:** one real Vertex session records provider
  `modelVersion`; recommended configured model is `gemini-3.7-flash`, subject
  to live region/account availability.
- [x] **Google agent framework in code:** `google-adk==2.8.0` constructs the
  fixed `SequentialAgent` and four direct child agents.
- [ ] **Google agent framework at runtime:** capture the real ADK session/events.
- [x] **Google Cloud service:** Cloud Run serves the viewer at
  `https://fleetscope-web-6tes2q7oqa-uc.a.run.app`, revision
  `fleetscope-web-00001-g4s`, region `us-central1`, project
  `project-ac0c5f88-868b-46b9-a2e`. Verified 2026-08-31: `/`, `/viewer/` and
  `/dashboard/` return 200 text/html and the projection runtime is served as
  `application/wasm`.
- [ ] **Cloud artifact:** optionally show the matching redacted JSONL/proof
  object and generation in Cloud Storage.
- [ ] All runtime/framework/cloud evidence uses the same session ID.

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
- [ ] Real workflow run captured.

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
| Real Vertex model event | Missing |
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
