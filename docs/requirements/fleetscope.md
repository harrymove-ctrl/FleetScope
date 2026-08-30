# FleetScope product requirements

> **Deprecated scope:** this file describes the earlier enterprise Case
> control-plane requirements. The current requirements are in
> [Session Observer requirements](session-observer.md). Keep this file for
> historical traceability only; do not use its Warden/Armor/ERP requirements to
> scope the demo.

Status: draft — hackathon submission contract plus local/recorded fallback

Last updated: 2026-08-30

## Product thesis

Enterprises need more than a trace viewer to trust an agent fleet. A procurement

manager must be able to discover an approved agent, understand its version and

permissions, start a long-running case, return days later without losing

context, supervise delegated agents, and prove that external data and private

systems were handled under policy.

**FleetScope** is the enterprise agent-fleet control plane for that lifecycle.

It provides a governed catalog, case-based orchestration, durable memory,

zero-trust access, policy-aware routing, external-input screening, and an

auditable Fleet Cockpit.

The primary submission target is **The Fortified Enterprise Fleet**. FleetScope

maps every recommended Gemini Enterprise Agent Platform capability into one

coherent workflow rather than displaying a collection of integrations.

## Scope split: local product path and submission proof path

These requirements intentionally describe two related but separate paths. The
path a developer can use today is not evidence that the private hackathon path
has been completed.

| Path | Purpose and boundary | Claim allowed | Gate |
|---|---|---|---|
| **Local observer product path (current v1)** | Dashboard → a Gemini/Antigravity CLI session or bundled recording → Agent Viewer; a chosen transcript is read locally and is never uploaded | Local observation, projection, and replay only; no provider, governance, or Cloud Run claim | Local projection, privacy, accessibility, and recorded-fallback checks |
| **Hackathon submission proof path (mandatory)** | A private, bounded, allowlisted asynchronous scenario with a real model/framework and Google Cloud service | Live execution and platform controls only after matching runtime and deployment evidence exists | Gemini 3.5+ (or the exact current rubric equivalent), one Google agent framework, Cloud Run/Google Cloud evidence, and `Controlled Fault → Warden authorized → exactly one idempotent retry → terminal result`; restart/replay must be side-effect free |
| **Public recorded fallback** | Static, read-only evidence for visitors when the private path is unavailable | `Recorded` or `Unavailable`, never live | Must remain functional without the live service and cannot substitute for the mandatory submission proof |

The vendor-onboarding workflow below is the enterprise scenario and the spine
of the submission proof. Until its private live gate is independently verified,
the public product presents it as recorded or synthetic. A local transcript,
configuration value, or historical report is not a live-proof result.

The current feature-by-feature flow, pitch, and Devpost field status are kept in
[`../product/feature-flows.md`](../product/feature-flows.md),
[`../product/idea-and-pitch.md`](../product/idea-and-pitch.md), and
[`../product/hackathon-submission-checklist.md`](../product/hackathon-submission-checklist.md).

Historical reports that name `gemini-2.5-flash`, `mode=live`, or a local API run
are retained for engineering context only. They are non-rubric evidence and do
not satisfy the Gemini 3.5+/Google framework/Google Cloud submission gate.

## Primary workflow: vendor onboarding case

A procurement manager discovers an approved **Vendor Onboarding Orchestrator**

in Agent Registry and starts a multi-week onboarding Case. The agent:

1. is launched as a long-running asynchronous process in Agent Runtime;

2. recalls negotiation terms and prior approvals through Memory Bank;

3. accesses private ERP inventory under Agent Identity;

4. delegates logistics checks through Agent Gateway;

5. screens vendor email and attachments with Model Armor;

6. records agent, tool, memory, identity, routing, screening, and intervention

   events for the Fleet Cockpit and audit export.

The workflow is complete when the procurement manager can pause and resume the

Case, inspect its current state and outstanding approvals, observe or replay its

agent graph, and verify why protected data or tools were allowed or blocked.

## Users and jobs

### Primary: procurement manager

When onboarding a vendor spans weeks, systems, and approvals, the procurement

manager needs an approved agent to preserve the Case context, coordinate work,

request decisions at the right time, and explain current status without a

manual reconstruction.

### Fleet administrator

When employees discover or launch agents, the administrator needs to control

which version is approved, what it can do, who can invoke it, and how a running

Case can be paused, contained, or escalated.

### Security and compliance reviewer

When an agent accesses private data, receives external content, delegates work,

or takes an automated action, the reviewer needs Decision Evidence connecting

identity, policy, screened input, routing, memory use, request, and confirmed

result.

### Agent operations engineer

When a long-running Case stalls or becomes costly, the engineer needs to locate

the affected branch, reconstruct the observable state, and recover it without

restarting healthy work.

### Hackathon judge

In a short demonstration, the Judge needs to see the whole enterprise lifecycle

through one believable Case—not seven disconnected service badges.

## Outcomes and success criteria

1. A new procurement manager can find the approved Vendor Onboarding

   Orchestrator version and start a Case in **under 60 seconds**.

2. A Case can cross a simulated multi-day boundary, resume, and retrieve all

   required approved context with **zero missing required memory facts** in the

   golden scenario.

3. **100% of protected ERP requests** in conformance tests contain an

   authorized Agent Identity and a recorded allow/deny result.

4. **100% of delegated calls** in the demo traverse Agent Gateway and record the

   source, destination, route policy, and outcome.

5. **100% of external vendor inputs** are screened before reaching an agent or

   tool; the injection fixture is blocked and recorded.

6. An Operator can locate the failing or blocked branch and its triggering event

   in **under 30 seconds**.

7. Replaying the same canonical event prefix with the same projector version

   yields the same Observable Case State hash in **100% of fixtures**.

8. Every automated or approved Intervention shown in the demo has complete

   Decision Evidence and an authoritative runtime result.

9. The scripted discover → launch → resume → secure access → delegate → screen →

   intervene → audit journey passes **10 consecutive recorded runs** before

   recording. The private submission proof passes **3 consecutive bounded live

   runs** before it appears in the final take. Public live controls may remain

   disabled; disabling them does not waive the private proof gate.

## Product principles

1. **Case first, telemetry second.** Users operate a business outcome; traces

   explain it. The Cockpit MUST not be the only product surface.

2. **One workflow, seven proofs.** Every platform capability MUST change the

   behavior or evidence of the same Case. Logo-only integrations do not count.

3. **Identity before access.** Private tools and data MUST reject requests that

   lack a valid agent identity and policy decision.

4. **Screen before trust.** External content MUST cross Model Armor before agent

   context, memory, or tools.

5. **Memory is provenance-bearing.** Recalled context MUST identify its source,

   scope, and timestamp; memory is not automatically trusted instruction.

6. **Evidence before animation.** Every visual state derives from a Canonical

   Event; the UI never invents success, reasoning, or enforcement.

7. **Recommend broadly, act narrowly.** Models may advise; versioned policy and

   a bounded Control Adapter grant and enforce authority.

8. **Replay state, not hidden thought.** FleetScope reconstructs Observable Case

   State and Decision Evidence, not private chain-of-thought or external reality.

## MVP requirements

FleetScope MUST provide:

- a discoverable, versioned Vendor Onboarding Orchestrator entry with owner,

  capabilities, risk class, allowed callers, tools, and approval state;

- Case creation, asynchronous execution, pause/wait/resume, progress summary,

  and terminal status through Agent Runtime;

- scoped cross-session context persisted and recalled through Memory Bank with

  provenance visible in the Case;

- Agent Identity evidence for at least one protected ERP read, including denied

  access when the identity or policy is invalid;

- one child-agent delegation routed through Agent Gateway with route/policy

  evidence;

- one benign and one adversarial external vendor input screened through Model

  Armor before downstream use;

- a Fleet Cockpit with live topology, tool activity, platform-control badges,

  Case milestones, incidents, approvals, and event-indexed replay;

- append-only Canonical Events and a deterministic Session Projector;

- one policy-gated, idempotent Warden recovery with a runtime-confirmed result;

- an audit/evidence view connecting Registry version, identity, memory, gateway,

  armor, agent/tool, policy, intervention, and result records;

- a static browser deployment and recorded read-only fallback Case. Public live

  controls are optional and MUST be bounded and disabled for the public replay

  by default. The separate private Gemini 3.5+/Google framework/Google Cloud

  proof remains mandatory for hackathon submission.

FleetScope SHOULD provide:

- an Agent Catalog entry surface separate from the live Cockpit;

- a Case Workspace optimized for the procurement manager rather than operator

  telemetry;

- approval inbox for high-impact tool calls and Warden recommendations;

- deep links from each platform badge to its exact Decision Evidence;

- follow-camera navigation with a reduced-motion alternative;

- context-drift detection as advisory only.

FleetScope MAY provide a minimap, fleet-wide analytics, or a policy editor only

after all MUST requirements pass.

## Explicit non-goals for the six-day build

- A generic marketplace or support for arbitrary business workflows.

- Production ERP/email/vendor integrations; synthetic enterprise adapters are

  acceptable when clearly labeled and governed by deterministic local controls

  or the one verified live platform control.

- Full enterprise IAM lifecycle, multi-tenancy, retention, residency, or legal

  hold implementation.

- Raw chain-of-thought storage or display.

- Exact re-execution of models, tools, network reads, or external side effects.

- Free-form model-generated remediation without deterministic authorization.

- A terminal/TUI, mobile experience, or deep rewrite of the reused Rust/WASM

  graph engine.

- Fleet-scale performance claims beyond the tested demo envelope.

## Capability requirements

- [Enterprise fleet lifecycle](fleetscope/enterprise-fleet.md)

- [Audit and replay](fleetscope/audit-and-replay.md)

- [Fleet Cockpit](fleetscope/fleet-cockpit.md)

- [Warden intervention](fleetscope/warden-intervention.md)

## Locked product decisions

- **D1 — Accepted:** FleetScope is the product name used throughout product,

  design, demo, and Tracking documentation.

- **D2 — Accepted:** The vendor onboarding Case is the end-to-end demonstration

  spine; integrations that do not affect this Case are cut.

- **D3 — Accepted:** Registry, Runtime, Memory Bank, Identity, Gateway, Model

  Armor, and Observability are P0 product capabilities for track fit.

- **D4 — Accepted:** Fleet Cockpit's live graph and temporal interaction grammar

  are subordinate to the discovery and Case workflows.

- **D5 — Accepted:** The replay promise is deterministic reconstruction of

  recorded Observable Case State, not hidden reasoning or side-effect replay.

- **D6 — Accepted:** Warden actions pass through versioned policy and an

  idempotent Control Adapter; model advice does not grant authority.

- **D7 — Superseded on 2026-08-26:** The earlier React/Vite/React Flow plus

  Pub/Sub/Firestore MVP mechanism exceeded the USD 35 credit and six-day risk

  envelope.

- **D8 — Accepted for MVP:** Rebrand a pinned MIT-licensed browser/WASM core,

  wrap it in an Astro/DOM FleetScope shell, and use bundled deterministic

  evidence by default. Third-party notices stay in repository licensing files,

  not product navigation. Public live access is optional, but one private,

  bounded live backend proof is a submission gate. Always-on services are

  excluded; the durable store for that proof must be chosen and evidenced

  rather than inferred from a container filesystem.

## Assumptions and risks

| Assumption | What breaks if wrong | Validation |

|---|---|---|

| The supplied track description is current and complete | Track mapping and prize narrative | Verify official live rules before day 1 ends |

| Required model, framework, and Google Cloud services are available to the team/project | The hackathon submission gate cannot pass; a simulation is only a fallback artifact | Review current API/model availability, prove the bounded private path, and label every recorded or synthetic capability honestly |

| Agent Runtime exposes long-running state and one usable control operation | Async and Warden claims weaken | Prove wait/resume and control by day 2 noon |

| Memory Bank exposes provenance sufficient for audit | Long-term-context trust claim weakens | Store, recall, and display one golden memory on day 2 |

| Identity/Gateway/Armor produce usable decision evidence | UI badges become decorative | Capture their actual response/event schemas before UI polish |

| A synthetic ERP and vendor mailbox are allowed | Scenario must integrate real external systems | Confirm submission policy and label adapters accurately |

## Open points

1. What is the official event URL, deadline, demo length, and prize-stacking

   rule?

2. What are the exact available APIs and product names for Registry, Runtime,

   Memory Bank, Identity, Gateway, Model Armor, and Observability?

3. Which long-running Runtime state transitions can be demonstrated reliably?

4. What Memory Bank provenance and scoping metadata is available?

5. How does Agent Gateway express routing and policy decisions?

6. Which one ERP read and one vendor message make the scenario credible?

7. Which Warden recovery operation is supported and safe enough for the demo?

8. Is the live demo private while the public artifact is read-only?

9. Who owns product, UX, runtime, platform integration, cloud, and video?

## Links

- [Glossary](glossary.md)

- [Frontend experience](../design/fleetscope-frontend-experience.md)

- [System design](../design/system.md)

- [Budget-constrained demo design](../design/budget-demo.md)

- [Product plan](../product/product-plan.md)

- [UI/UX plan](../product/ui-ux-plan.md)

- [Six-day delivery plan](../plans/six-day-delivery.md)

- [Demo and validation plan](../plans/demo-validation.md)
