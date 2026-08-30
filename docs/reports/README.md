# Reports

Dated, immutable point-in-time records: what a specific FleetScope run, gate,
or proof actually produced, on a specific date, with its evidence.

## Read this set

- [End-to-end implementation report — 2026-08-26](fleetscope-end-to-end-implementation-2026-08-26.md)
  — immutable historical inventory and command output from that checkout. Its
  Gemini 2.5/local live results are not current hackathon-rubric evidence.
- [UI completion report — 2026-08-26](fleetscope-ui-completion-2026-08-26.md)
  — immutable historical route audit and browser QA. Re-run current gates
  before using its pass counts or live labels as a readiness claim.

## Conventions

- Name entries `YYYY-MM-DD-<topic>.md` and do not revise a report to keep it
  current; distill durable conclusions into [`../design/`](../design/).
- State the command, commit or checkout identity, environment, and first error
  for every failed or partial gate.

## When to read

Before re-running an experiment or relying on a prior readiness claim.
