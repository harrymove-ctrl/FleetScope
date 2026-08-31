# Feature inventory and how to invoke each one

**Status:** active  
**Last updated:** 2026-08-31

This is the README safety net for features the four-minute video cannot show.
The scoring product is `launch_readiness`. FleetScope is the read-only
evidence surface.

## Submission path (demo these)

| Feature | Where | Invoke | Status |
|---|---|---|---|
| Launch-readiness ADK workflow | Producer | `pnpm demo:google-session` (dry-run) or `--run` with spend opt-ins | Implemented. Dry-run is the default. |
| Cloud Run `services.get` | `cloud_run_probe` | Happens inside the producer. Inspect via `/console` Cloud Run | Recorded in the bundled fixture |
| Cloud Storage `buckets.get` | `storage_probe` | Same. `/console` Storage. No object list/download | Recorded |
| Six-call / 180s / zero-write budget | `budget_guard` | Same session. Seventh call is refused before issue | Implemented |
| READY / NOT_READY | `launch_reviewer` | Same session. Decision is `READY` on the fixture | Implemented |
| Judge Cloud Console | `/console` · `GET /cloud/console` | Hosted web `/console` or curl the API | Implemented; hosted site needs a redeploy to pick this up |
| Session readings poster | `/demo` | Open the route. Zero clicks | Implemented |
| Browser Agent Viewer | `/viewer` | Hosted: Preview example. Local 127.0.0.1: auto-follow `.fleetscope/sessions` | Implemented |
| Native TUI | `fleetscope-cli` | `cargo run -p fleetscope-cli --bin fleetscope -- examples/gemini-session --follow --tiny` | Implemented |
| Headless inspect | CLI | `fleetscope inspect <path>` | Implemented |
| Dashboard copy-and-talk | `/dashboard` | Copy Antigravity / Copy example / Open judge Cloud Console | Implemented |
| Loopback auto-follow | Vite plugin on 127.0.0.1 | `GET /local-sessions.json` while `pnpm dev` | Implemented. Not on hosted Cloud Run (static). |
| Google ADK adapter | `google-adk@1` | Any ADK JSONL | Implemented |
| Hidden-thought / secret redaction | Producer + adapter | Proven in worker tests | Implemented |
| Unknown / waiting instead of guessed done | Projection | Unanswered tool calls stay waiting | Implemented |
| Play / pause / step / seek / speed / follow | CLI and `/viewer` | Space `[` `]` `g` `G` `f` | Implemented |
| Optional Storage proof upload | Producer `--upload` | Only after `--run` | Implemented; upload of a generation not captured |
| Hosted Cloud Run web + API | `us-central1` | See URLs below | Deployed 2026-08-31, recorded-only |

Hosted URLs:

- Web: https://fleetscope-web-6tes2q7oqa-uc.a.run.app
- API: https://fleetscope-api-6tes2q7oqa-uc.a.run.app
- Judge console (after redeploy): https://fleetscope-web-6tes2q7oqa-uc.a.run.app/console

## Producer dialects

| Dialect | How it gets into FleetScope | Do not |
|---|---|---|
| Google ADK JSONL | `pnpm demo:google-session` writes `.fleetscope/sessions/<id>/session.jsonl` | Start it from the browser |
| Antigravity CLI | `pnpm demo:antigravity` bridges `agy --print --output-format stream-json` | Parse Antigravity's private conversation store |
| Checked-in example | `examples/gemini-session` | Treat it as a live Vertex take |

## Present in the repo, not the hackathon story

These routes still render. Do not lead the video or Devpost copy with them.

| Surface | Route / package | Why it is not the submission |
|---|---|---|
| CASE-1042 case list | `/cases` | Superseded enterprise fixture |
| Agent catalog | `/catalog` | Permission list, not a run |
| Approvals | `/approvals` | HITL story, not Taskmaster |
| Case graph / cockpit | `/cockpit/CASE-1042` | Zoetrope CASE renderer |
| Audit trail | `/audit/CASE-1042` | Same |
| Bounded live-proof UI | `/live` | Allowlisted CASE step; hosted `liveMode: false` |
| Warden / Model Armor adapters | `packages/warden`, `packages/platform-adapters` | Enterprise control plane |
| React UI experiment | `apps/ui` | Not the judge path |
| MCP server in the worker | `apps/adk-worker/.../mcp_server.py` | Optional driver, not the demo |
| Fleet cockpit WASM | `crates/fleet-cockpit-web` | CASE renderer, not Session Observer |

## Folder map (for judges reading the repo)

```text
apps/adk-worker/     Google ADK SequentialAgent producer (launch_readiness)
apps/api/            Bounded JSON API: health, capability, runs, /cloud/console
apps/web/            Astro site: /dashboard /console /viewer /demo + CASE routes
crates/fleetscope-cli
crates/agent-viewer-*
packages/            Shared TS: domain, projector, fixtures, run-ledger, …
examples/gemini-session
examples/antigravity-project
scripts/             demo-google-session, demo-antigravity, deploy-cloud-run
docs/product/        Pitch, checklist, this inventory, Devpost packet
docs/design/         Runtime runbook, gcloud ↔ TUI pairing
vendor/zoetrope/     Vendored TUI/WASM renderer
```

## Failure and recovery (operational stability)

| Failure | What happens |
|---|---|
| Invalid producer config | Refuse before ADC or a model client exists |
| `--run` without spend/Vertex opt-in | Refuse |
| `--upload` without `--run` | Refuse |
| Cloud API non-200 | Record operation/status/resource only |
| Model call 7 | Refuse before the call |
| Unanswered tool | Viewer keeps **waiting** |
| `thought: true` / secret-shaped keys | Stripped before JSONL flush |
| Hosted API with `LIVE_MODE=false` | Live paths return a recorded fallback |
| Judge has no GCP IAM | `/console` and curl `/cloud/console` still work |

## Links

- [Devpost additional-info packet](devpost-additional-info.md)
- [Session Observer brief](session-observer.md)
- [Feature flows](feature-flows.md)
- [Hackathon checklist](hackathon-submission-checklist.md)
