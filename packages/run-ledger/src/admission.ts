/**
 * The single gate a live run passes before anything executes.
 *
 * # Ordering is the contract
 *
 * Checks run cheapest-and-safest first, and EVERY rejection happens before a
 * model call, a tool call or an external request. A run that is going to be
 * refused must cost nothing, so an exhausted budget or a second concurrent
 * start is decided from the ledger alone.
 *
 * This mirrors `apps/api/src/live/guard.ts`, which gates the existing
 * single-decision path the same way.
 */

import { newRun, type RunMode, type RunRecord } from './record.js';
import { findScenario, type LiveScenario } from './scenario.js';
import type { RunLedger } from './ledger.js';

export type RunRejection =
  | { readonly reason: 'live_mode_disabled' }
  | { readonly reason: 'ledger_not_durable' }
  | { readonly reason: 'scenario_not_allowlisted'; readonly scenarioId: string }
  | {
      readonly reason: 'scenario_exceeds_call_ceiling';
      readonly scenarioId: string;
      readonly requires: number;
      readonly ceiling: number;
    }
  | { readonly reason: 'run_already_active'; readonly runId: string }
  | { readonly reason: 'call_budget_exhausted'; readonly limit: number; readonly used: number };

export type RunAdmission =
  | { readonly admitted: true; readonly run: RunRecord; readonly scenario: LiveScenario }
  | { readonly admitted: false; readonly rejection: RunRejection };

/** Everything the gate needs that it must not read from the environment. */
export interface AdmissionContext {
  readonly liveMode: boolean;
  /**
   * Whether the ledger survives a restart.
   *
   * A run spends model calls and performs an external read, and the ledger is
   * the only thing that can prove the recovery ran exactly once. Without
   * durability that proof does not survive a crash between persisting the
   * idempotency key and executing, so the run is refused rather than started
   * on a promise that cannot be kept.
   */
  readonly durableLedger: boolean;
  /** Total model calls this deployment may spend, across all runs. */
  readonly totalCallBudget: number;
  /**
   * The most model calls ONE run may reserve.
   *
   * A scenario declares what it needs in server source; this is what the
   * deployment permits. When the two disagree the run is refused here, before
   * anything executes, rather than dying part-way through when the call that
   * crosses the line is finally issued.
   */
  readonly perRunCallCeiling: number;
  readonly now: () => string;
  readonly newId: (prefix: string) => string;
}

/** Model calls already spent, summed across every run the ledger knows. */
export function callsUsed(ledger: RunLedger): number {
  return ledger.all().reduce((total, run) => total + run.modelCalls, 0);
}

export function admitRun(
  ledger: RunLedger,
  context: AdmissionContext,
  request: { readonly scenarioId: string; readonly mode?: RunMode },
): RunAdmission {
  if (!context.liveMode) {
    return { admitted: false, rejection: { reason: 'live_mode_disabled' } };
  }

  if (!context.durableLedger) {
    return { admitted: false, rejection: { reason: 'ledger_not_durable' } };
  }

  const scenario = findScenario(request.scenarioId);
  if (scenario === null) {
    return {
      admitted: false,
      rejection: { reason: 'scenario_not_allowlisted', scenarioId: request.scenarioId },
    };
  }

  // A scenario needing more calls than this deployment permits can never
  // complete here, so it is refused outright rather than started and truncated.
  if (scenario.maxModelCalls > context.perRunCallCeiling) {
    return {
      admitted: false,
      rejection: {
        reason: 'scenario_exceeds_call_ceiling',
        scenarioId: scenario.id,
        requires: scenario.maxModelCalls,
        ceiling: context.perRunCallCeiling,
      },
    };
  }

  // One run at a time. Two concurrent runs would make the call budget, the
  // single active Intervention slot and the viewer's cursor all ambiguous.
  const active = ledger.active();
  if (active !== null) {
    return { admitted: false, rejection: { reason: 'run_already_active', runId: active.runId } };
  }

  // The budget is checked against what a run COULD spend, not what it has
  // spent, so a run is never admitted that cannot finish inside the ceiling.
  const used = callsUsed(ledger);
  if (used + scenario.maxModelCalls > context.totalCallBudget) {
    return {
      admitted: false,
      rejection: {
        reason: 'call_budget_exhausted',
        limit: context.totalCallBudget,
        used,
      },
    };
  }

  const runId = context.newId('run');
  const run = newRun({
    runId,
    sessionId: context.newId('sess'),
    scenarioId: scenario.id,
    mode: request.mode ?? 'live',
    startedAt: context.now(),
    correlationId: context.newId('corr'),
    // Bound to the run and the scenario's single permitted recovery, so a
    // redelivery of the same Intervention resolves to the same key.
    idempotencyKey: `${runId}:${scenario.recoveryAction}:1`,
  });

  return { admitted: true, run: ledger.put(run), scenario };
}
