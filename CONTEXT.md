# Context

Settled vocabulary for FleetScope. Definitions only. Implementation lives in
`docs/` and the code.

## Glossary

**FleetScope** — The product. A read-only observer of agent work. It is not
the runtime that starts, retries, approves, or mutates agents.

**Session Observer** — FleetScope's role: ingest a producer-owned session and
make it inspectable. Not an orchestrator.

**Producer** — Whatever actually ran the agents and wrote the session. Owns
execution, credentials, and spend. FleetScope does not.

**Session** — One append-only JSONL (plus optional companions) that is the
source of truth for a run. Live and replay are the same session with a moving
or fixed right edge.

**launch_readiness** — The Google ADK workflow that inspects Cloud Run and
Storage, checks a six-call budget, and issues READY or NOT_READY. This is the
hackathon scoring action. It is a producer, not FleetScope.

**Projection** — The provider-neutral fold of a session used by every viewer.
One meaning of the session, several surfaces.

**Configured model** — The model id the producer was told to use. Not
execution proof.

**Observed model** — The provider's `modelVersion` on an actual event. The
only model claim that counts as having run.

**Live follow** — The playhead sits at the growing right edge of a session
that is still being written.

**Replay** — The same session after the right edge is fixed, or while the
playhead is parked earlier.

**The Taskmaster** — The Devpost track. Chosen because `launch_readiness`
completes a multi-step job. Not Collaborative Partner, not Fortified
Enterprise Fleet.

**Agent Viewer** — The interactive browser flight deck at `/viewer`. Graph,
rail, inspector, timeline. A Session Observer surface. Not the TUI.

**TUI** — The native `fleetscope` CLI running in a real terminal. Not the
browser, even when `/viewer` is styled like a terminal.

**Cloud Console** — FleetScope `/console` and `GET /cloud/console`. Recorded
Cloud Run, Storage, and ADK evidence with no GCP login. Not Google Cloud
Console.

**Google Cloud Console** — `console.cloud.google.com`. Operator IAM on the
project. Not the judge path.

**UI** — The Vite/React app in `apps/ui`. Optional short demo beat after
Agent Viewer. Not Agent Viewer, not Cloud Console, not the TUI. If you mean
`/viewer`, say Agent Viewer.

**Case** — Historical enterprise correlation (CASE-1042, Warden, /cases).
Allowed as leftover routes. Not the hackathon unit. The demo unit is Session.

**Hackathon producer** — On camera and on Devpost, only `launch_readiness`.
Antigravity is a supported second dialect. It is not the scoring run.
