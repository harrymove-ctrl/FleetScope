# 0006 — Vertex agent runtime with Firestore evidence ledger

- **Status**: Superseded by 0007
- **Date**: 2026-08-30

> This was a proposed CASE-1042 enterprise-proof architecture. It is retained
> for history but is not the current FleetScope product direction. The current
> product is the read-only Session Observer in [ADR 0007](0007-session-observer-scope.md).

## Context

The private All Things Agentic Hackathon path must prove one real Gemini 3.5+
execution through a Google agent framework on Google Cloud. CASE-1042 needs a
root agent, a delegated review agent, a controlled fault, one policy-authorized
retry, and restart-safe event evidence. The current repository has a Google ADK
seam and a local JSONL ledger, but a Cloud Run instance can be replaced and lose
filesystem state. A model API key in a Cloud Run environment would also make the
provider boundary harder to prove and operate.

The 2026-08-30 official pricing and model pages show that `gemini-3.7-flash` is
GA on Vertex/Gemini Enterprise Agent Platform, supports function calling and
structured output, and is priced at an introductory $0.75 input / $3.75 output
per 1M tokens through 2026-12-31. `gemini-3.5-flash-lite` is cheaper at $0.30 /
$2.50 per 1M tokens, but its own guidance requires MEDIUM or HIGH thinking for
multi-step sub-agents because MINIMAL thinking can terminate tool work early.

## Decision

We run the private CASE-1042 proof on **Vertex AI / Gemini Enterprise Agent
Platform**, using the Cloud Run service account and ADC rather than a Gemini API
key. The default model for both the ADK root and delegated agent is
**`gemini-3.7-flash`**, with server-owned prompts, structured output, a six-call
per-run ceiling, and a 90-second scenario timeout. The model may advise; FleetScope
policy and the Warden Control Adapter remain authoritative.

We use **Firestore (Native mode) as the primary managed run ledger**. A run
document, append-only event documents, and intervention/idempotency records are
written with transactions so duplicate delivery returns the original claim and
cannot create a second external effect. Pub/Sub carries asynchronous worker
delivery between the API and ADK worker. **Cloud Storage is secondary** and holds
redacted evidence exports, architecture artifacts, and the final proof bundle;
it is not the transactional run store. Cloud SQL is not used for this bounded
event ledger.

## Alternatives Considered

- **Gemini 3.5 Flash-Lite**: lowest token cost and valid for the rubric, but the
  documented sub-agent thinking caveat adds reliability risk and per-agent
  configuration for the judge-critical delegation/recovery path. Keep it as an
  explicitly selected cost-canary option, not the default take.
- **Gemini API**: the fastest existing code path, but it requires API-key
  handling and gives weaker Cloud-native identity evidence than Vertex ADC. It
  remains a local compatibility path only until a separate decision says
  otherwise.
- **Cloud SQL**: strong relational transactions, but adds schema/migration,
  connection-pool, and private-network operations that do not pay back for one
  bounded append/query ledger.
- **Cloud Storage as the ledger**: excellent for immutable exports, but object
  replacement/list consistency and absent transactional compare-and-set make it
  unsuitable for intervention claims and budget admission.

## Consequences

- Cloud Run logs can show the exact model, framework version, service revision,
  and run correlation without exposing a long-lived API key.
- Firestore makes restart/reconnect and idempotency claims testable across
  instances; the implementation must add indexes, transaction retries, and
  bounded document sizes.
- The deployment becomes two bounded services (API and ADK worker) plus Pub/Sub
  and Firestore, so local JSONL remains the recorded/offline fallback rather than
  pretending to be production durability.
- The introductory 3.7 Flash price is still small for the fixed six-call run;
  application ceilings remain mandatory. A future cost pass may switch both
  agents to 3.5 Flash-Lite only after a provider-backed reliability run proves
  delegation, recovery, and terminal-result truth.
- No Cloud SQL schema, unrestricted prompt endpoint, external write, or model
  self-authorized intervention is introduced.

## Sources checked

- [Vertex Gemini 3.7 Flash model](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-7-flash)
- [Vertex Gemini 3.5 Flash-Lite model](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-5-flash-lite)
- [Agent Platform generative AI pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing)
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
