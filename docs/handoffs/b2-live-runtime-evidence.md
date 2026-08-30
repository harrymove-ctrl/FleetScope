# FleetScope B2 — live runtime and evidence handoff

Status: superseded historical handoff — do not implement  
Prepared: 2026-08-30

This was the next engineering task for the rejected CASE-1042 enterprise
runtime. It is retained for traceability only; do not paste the prompt into a
new coding agent. The active task is the read-only Google ADK session producer
documented in `docs/design/hackathon-runtime.md`.
The receiver starts with no conversation context.

```text
You are continuing FleetScope B2 in the existing worktree. Close the real
runtime/evidence gate before doing any landing-page, Dashboard, carousel,
React Bits, OriginKit, or visual-polish work.

MISSION

B2 is the bounded private submission proof:

  Google ADK root agent
    -> observed delegation to security_review
    -> one Controlled Fault on the allowlisted read
    -> FleetScope Warden authorizes the recovery
    -> exactly one idempotent retry under the same logical-operation key
    -> runtime-confirmed terminal result

After a real process/container restart, the same completed event prefix must
still be readable. Replaying it must prove:

  modelCalls = 0
  toolCalls = 0
  wardenActions = 0

Planning, contract tests, recorded fixtures, and the local MCP bridge already
exist. They are necessary but do not complete B2. Your exit gate is a deployable
runtime plus the evidence contract below. Deploy or spend Cloud/model credit
only when the operator explicitly authorizes that external action in the task
that launches you. Without that authority, finish the implementation and local
no-spend verification, then stop at the deployment gate and report exactly what
remains. Never silently substitute a fixture, Gemini 2.5, or a local API run.

There is no tracker issue supplied for this slice. “B2” in this handoff and the
canonical design are the delivery ledger. Reconcile any changed decision back
into those files.

WORKSPACE — VERIFY BEFORE TOUCHING

- Worktree: /Users/harryphan/Documents/dev/FleetScope
- Branch: feat/agent-viewer-cli
- Snapshot HEAD when this handoff was written: 860ce48
- Canonical future PR base: main
- The worktree is heavily dirty with pre-existing and concurrent code/docs.
  Preserve every unrelated change. Do not stage or discard files you do not own.
- Run:

  git -C /Users/harryphan/Documents/dev/FleetScope status --short --branch
  git -C /Users/harryphan/Documents/dev/FleetScope branch --show-current
  git -C /Users/harryphan/Documents/dev/FleetScope rev-parse --short HEAD

- Stop and report if the worktree or branch differs. A newer HEAD is not
  automatically wrong, but refresh every mutable source before relying on this
  handoff.
- Do not create another clone/worktree/branch, rebase, reset, commit, push,
  deploy, change IAM, provision infrastructure, or open/update a PR unless the
  operator explicitly authorizes that exact action.
- No repository AGENTS.md or CLAUDE.md existed when this handoff was written.
  Recheck before editing and obey one if it has appeared.

READ FIRST, IN THIS ORDER

1. docs/design/fleetscope-frontend-experience.md
   - Sections 2, 9, 13, 15, and 16 own the source hierarchy, event bridge,
     private proof, acceptance criteria, implementation order, and open points.
2. docs/requirements/fleetscope.md
   - Read “Scope split” and the acceptance criteria. Public live controls are
     optional; the private Gemini/framework/Google Cloud proof is mandatory.
3. docs/decisions/0003-bounded-live-path.md
   - Historical /live/decision evidence is non-rubric. Do not promote it.
4. docs/design/budget-demo.md
   - Static-first product and spend guardrails. B2 must remain bounded.
5. apps/api/src/routes/runs.ts
   - Current /runs contract, admission, loopback mutation boundary, event cursor,
     and replay response.
6. apps/api/src/runs/dependencies.ts
   - Production wiring. It currently hardcodes workerMode: 'pure'.
7. apps/api/src/runs/worker.ts and apps/api/src/runs/store.ts
   - Child-process environment, event ingestion, and the local JSONL store.
8. packages/shared/src/env.ts
   - The only environment parser and the current worker/MCP credential rules.
9. apps/adk-worker/src/fleetscope_worker/main.py
   - The explicit FLEETSCOPE_ALLOW_MODEL_CALLS spend gate and model resolution.
10. apps/adk-worker/src/fleetscope_worker/adk_runtime.py
    - The actual Google boundary is Runner.run_async at the current lines
      194-198. Tests must continue to cross this real adapter boundary.
11. apps/adk-worker/src/fleetscope_worker/session.py,
    recovery.py, attempts.py, tools.py, and scenario.py
    - Recorded five-beat reference, Warden policy, retry reservation, allowlist,
      and the stale Gemini 2.5 default.
12. packages/run-ledger/src/{scenario,event,ledger,record}.ts
    - Admission, event truth, canonical sequence, observed-work counters, and
      idempotency record.
13. apps/api/tests/runs-e2e.test.ts, apps/api/tests/runs.test.ts,
    apps/adk-worker/tests/test_adk_runtime.py, and
    apps/adk-worker/tests/test_capture_and_recovery.py
    - Extend the real boundaries. Do not replace them with a fake adapter.
14. apps/api/Dockerfile
    - Current image omits @fleetscope/run-ledger and the Python ADK runtime.

CURRENT VERIFIED STATE VERSUS UNVERIFIED CLAIMS

Verified locally on 2026-08-30:

- pnpm smoke:runs: 35 passed.
- pnpm smoke:mcp: 19 passed.
- pnpm qa:live: 58 passed.
- git diff --check: clean.
- The real ADK adapter constructs the agent tree, creates a session, invokes
  Runner.run_async, and translates real ADK Event shapes in tests.

Those checks are offline/pure/fixture checks. They do NOT prove Gemini 3.5+,
Cloud Run, a real delegated run, restart durability, or Warden recovery on the
ADK path.

Observed blockers you must close or explicitly disposition:

1. apps/api/src/runs/dependencies.ts currently returns workerMode: 'pure'
   unconditionally, so production never requests the ADK runtime.
2. apps/api/src/runs/worker.ts constructs a minimal child environment that does
   not pass FLEETSCOPE_ALLOW_MODEL_CALLS, the selected ADK model, or a verified
   Vertex/Gemini authentication mode. main.py therefore refuses adk mode even if
   the controller asks for it.
3. apps/adk-worker/src/fleetscope_worker/scenario.py still defaults to
   gemini-2.5-flash. The rubric requires the exact available Gemini 3.5-or-newer
   model. A source-string rename is not execution proof.
4. AdkRuntime observes the first tool failure but currently has no Warden policy
   branch that performs the controlled retry after the ADK event stream. The
   recorded ScriptedRuntime has that story; the real path does not yet prove it.
5. packages/shared/src/env.ts models a Gemini API-key worker prerequisite but
   does not yet model a verified Vertex/ADC deployment path.
6. apps/api/Dockerfile copies neither packages/run-ledger nor apps/adk-worker,
   installs no Python runtime/dependencies, and defaults LIVE_MODE=false.
7. POST /runs and POST /runs/:runId/events are loopback-only. A remote private
   Cloud Run operator path is unresolved. Do not “solve” this by making mutation
   routes public.
8. FileRunStore and FileAttemptStore are local JSONL files. A Cloud Run
   container filesystem is ephemeral, so current “durable: true” means local
   process restart only, not instance replacement.
9. No Cloud Run URL/revision, current-model log, live ADK trace, or correlated
   run evidence has been independently verified.

IMPLEMENTATION CONTRACT

Deliver the following in order. Keep each layer fail-closed.

A. Explicit runtime configuration

- Add a typed run-worker mode with safe default 'pure'. 'adk' must require all
  of: LIVE_MODE=true, FLEETSCOPE_RUN_DRIVER=worker, a separate explicit
  spend/real-runtime authorization, and an exact deployment-selected model.
- Do not infer “3.5+” from a name alone. The configured identifier is metadata;
  the matching provider/Vertex log is proof.
- Support the chosen authentication backend explicitly. Prefer Cloud Run
  service-account/Vertex ADC for the private Cloud proof. Verify the exact
  environment contract against google-adk==2.8.0/google-genai source or current
  Google documentation before coding it. If an API-key path remains supported,
  inject the secret only into the worker process, never logs/capability/evidence.
- Pass a strict allowlist of required child environment values. Do not inherit
  process.env wholesale.
- productionRunDependencies must derive workerMode from validated config, never
  from a route/body and never from a hopeful default.
- /runs/capability must distinguish configured from proven. It may expose safe
  model identifier, framework name/version, backend, worker mode, deployment
  revision/region, and durable-store kind, but no key/token/raw prompt.
- Add negative config tests: missing explicit authorization, missing model,
  invalid backend, LIVE_MODE=false, and mcp/worker mismatch must all stay pure or
  fail at boot before a process/model call.

B. Real ADK -> Controlled Fault -> Warden -> one retry

- Keep Runner.run_async as the real Google framework boundary. A test double may
  replace the Runner/model transport, but it must feed real
  google.adk.events.Event objects through AdkRuntime.
- The root agent must actually delegate; absence of an observed delegated author
  or branch leaves the run incomplete.
- The first allowlisted read must fail through ControlledFault and be recorded
  as controlled_fault, never as a provider outage.
- FleetScope code, not the model and not an SDK auto-retry, owns recovery:
  construct the Incident, evaluate RecoveryPolicy, emit the Warden intervention,
  durably reserve the same logical-operation/idempotency key BEFORE acting, then
  perform at most one retry.
- The retry must use the same target and logical-operation key. A duplicate
  delivery/resume must return an already-reserved/no-op result and must not
  produce a second intervention or external effect.
- Persist enough state to distinguish initial attempt, retry reserved, retry
  completed, and terminal result across a process restart. A counter that resets
  or a key recorded without operation state is insufficient.
- Emit one canonical, dense sequence. Required order:

    run_start
      < agent_start/delegation/model/tool detail may interleave >
    delegation
    controlled-fault tool_result
    incident
    intervention with Warden authorization and idempotency key
    retry tool_call
    successful retry tool_result
    run_end with terminalResult=succeeded

- Exactly one event has kind=intervention for the permitted recovery. The
  terminal result may be succeeded only after the retry result is observed.
- Preserve redaction: no chain-of-thought, secret, raw credential, or unsafe
  unbounded tool argument enters an event or log.

C. Deployable image and private mutation boundary

- Build one reproducible image containing the Node API, every required workspace
  package (including @fleetscope/run-ledger), a compatible Python runtime, the
  pinned ADK worker, and its pinned dependencies.
- Prove the built container starts in recorded mode first and serves both
  /health and /runs/capability with HTTP 200 before enabling any live setting.
- Keep public/default operation recorded-only.
- Preserve loopback authorization for local development. Add a separate,
  explicit private-operator authorizer only if it can rely on a verified Cloud
  Run IAM/authenticated ingress boundary. A caller-supplied Host, forwarded-IP,
  email, or boolean header by itself is not authentication.
- Unauthorized POST /runs and event append remain 403. The deployed service must
  not be allow-unauthenticated for mutation. Record the IAM/ingress state in the
  evidence bundle without exposing tokens.
- Keep max instances/concurrency bounded so the storage/idempotency design's
  single-active-run assumption is true. Do not describe a deployment flag as
  proof; capture the service description.

D. Restart-durable run and attempt storage

- Choose and document one managed persistence profile for BOTH canonical
  run/events and retry-operation state. Cloud Run's writable container layer is
  not acceptable.
- Prefer a transactional/conditional reservation for the retry key. A Cloud
  Storage volume mount is acceptable only if the actual append, conditional
  reservation, instance-replacement, and duplicate-delivery probes pass; do not
  assume FUSE semantics.
- The store must support one active run, append/read in canonical order,
  first-write-wins for duplicate sequence, conditional retry reservation, and
  completed-prefix reads after a new container instance.
- Keep the IO-free run-ledger domain contract or refactor it deliberately with
  tests. Do not bury provider IO in scenario/policy code.

E. Reproducible proof harness and redacted evidence

- Add a bounded proof command/script that:
  1. fetches /runs/capability and refuses to continue unless every live gate is
     explicit;
  2. starts only dependency_onboarding through the authenticated operator path;
  3. polls by high-water mark to terminal;
  4. validates the exact ordered chain, one intervention, one retry, IDs, truth
     labels, call ceilings, and terminal result;
  5. submits the duplicate retry/resume probe and proves no second effect;
  6. captures the completed prefix and observed counters;
  7. after a real container/revision restart, fetches the same run/prefix again;
  8. replays repeatedly and proves zero new model/tool/Warden actions.
- Put raw local evidence under:

    .fleetscope/evidence/b2-live-runtime/<UTC timestamp>/

  This directory is ignored. Include a redacted manifest, exact commands,
  timestamps, project/region/service/revision/image digest, URL, runId,
  correlationId, scenario, exact model, framework/version, storage profile,
  ordered event digest, high-water marks, duplicate result, replay counters,
  and the first meaningful error for any failed gate.
- Never store access tokens, API keys, raw private prompts, credentials, or
  unredacted provider payloads.

ACCEPTANCE CRITERIA

B2 is complete only when all applicable rows are independently observed:

1. Fresh production start: GET /health = 200 and GET /runs/capability = 200 from
   the actual built/deployed service, not createApp() in a test.
2. Capability truth: liveMode=true, workerMode=adk, runDriver=worker,
   durableLedger=true, one allowlisted scenario, exact model, Google ADK
   framework/version, deployment revision/region, and durable-store kind.
3. Auth: unauthorized mutation = 403; the explicitly authorized private
   operator can start exactly the allowlisted scenario.
4. Runtime: a Google ADK trace and model/provider log correlate to the same
   runId/timestamp and show the exact Gemini 3.5-or-newer identifier.
5. Event truth: the ordered ledger proves actual delegation, Controlled Fault,
   Warden authorization, exactly one retry using the same key, successful result,
   and terminal completion. No recorded event is promoted to live.
6. Idempotency: a duplicate delivery/resume produces no second intervention,
   retry, or external effect; the durable operation record explains why.
7. Restart: a new container instance can read the identical completed event
   prefix and high-water mark.
8. Replay: repeated GET/replay leaves the stored run unchanged and reports
   modelCalls=0, toolCalls=0, wardenActions=0 for the replay operation; logs show
   no new runtime boundary crossing.
9. Reliability: if model credit/deployment permission is authorized, run the
   bounded scenario three consecutive times before the final demo take. All
   three must pass without widening call/retry limits.
10. Regression: pure/recorded mode, MCP smoke, and public recorded fallback
    remain functional with the private service unavailable.

REQUIRED VALIDATION

Run from /Users/harryphan/Documents/dev/FleetScope and record exact outcomes:

  git diff --check
  pnpm smoke:runs
  pnpm smoke:mcp
  pnpm qa:live
  pnpm check
  apps/adk-worker/.venv/bin/python -m pytest apps/adk-worker/tests
  docker build -f apps/api/Dockerfile -t fleetscope-b2:local .

Then run the built image in recorded/no-secret mode and capture the observed
HTTP status for /health and /runs/capability. Add focused config, route,
authorization, ADK-event, Warden, idempotency, restart-store, Docker, and proof
harness tests. A green injected suite is necessary, never sufficient.

When and only when deployment/model spend is explicitly authorized, also record:

  gcloud run services describe <service> --project <project> --region <region>
  curl -sS -i <authenticated-service-url>/health
  curl -sS -i <authenticated-service-url>/runs/capability

Use the proof harness for POST/poll/restart/replay so secrets and ID tokens are
not pasted into logs or shell history. Capture the exact command shape with
secret values redacted.

NON-GOALS

- No landing-page, Dashboard, onboarding, preloader, carousel, React Bits,
  OriginKit, Story/Expert, Agent Viewer, or visual styling work.
- No new scenario, free-form prompt, arbitrary URL/tool, write-side external
  action, model-selected retry, or retry count supplied by a caller.
- No public unauthenticated live mutation.
- No claim that local MCP, /live/decision, pure mode, a config string, Docker
  source, or a Cloud Console screenshot completes the rubric.
- No Gemini 2.5 fallback and no guessed Gemini 3.5 model identifier.
- No always-on Cloud service or widened budget without operator approval.
- No commit, push, PR, deployment, IAM change, or infrastructure provisioning
  without explicit authorization.

STOP CONDITIONS

Stop and report the first meaningful error; do not downgrade the claim if:

- the exact eligible Gemini 3.5-or-newer model cannot be verified;
- Google ADK Runner.run_async is not the observed framework boundary;
- delegation is absent;
- Warden recovery is not exactly one conditional, idempotent retry;
- the remote mutation path cannot be authenticated without making it public;
- storage cannot survive actual instance replacement;
- replay crosses a model/tool/Warden boundary;
- Cloud project, credits, authentication, or explicit deploy/spend authority is
  unavailable.

HAND-BACK

Finish with:

1. Exact files changed and the contract each now owns.
2. Exact commands run, environment/profile used, pass/fail counts, and first
   meaningful failure.
3. Actual HTTP statuses and container/deployment identity.
4. Evidence directory and manifest path.
5. Exact model, Google framework/version, Cloud project/region/service/revision,
   runId, correlationId, event high-water mark, and durable-store profile, with
   secrets redacted.
6. The ordered event proof, intervention count, retry/duplicate result, restart
   result, and replay counters.
7. Every remaining honest limitation or unexecuted external gate.
8. Confirmation that unrelated dirty files were preserved and whether your
   changes remain uncommitted.
9. Updated canonical design/requirements references for any changed decision.
10. A new self-contained handoff prompt in this same structure if another agent
    must continue.
```
