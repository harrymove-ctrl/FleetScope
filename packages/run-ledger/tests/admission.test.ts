import { beforeEach, describe, expect, it } from 'vitest';
import {
  admitRun,
  callsUsed,
  findScenario,
  isActive,
  LIVE_SCENARIOS,
  MemoryRunStore,
  RunLedger,
  type AdmissionContext,
  type RunRecord,
} from '../src/index.js';

/**
 * Admission is the only thing standing between a request and real money plus a
 * real external request. Every test here asserts a rejection happens BEFORE
 * anything could execute, which is why the gate takes no transport at all: it
 * has nothing to call even if it wanted to.
 */

let counter = 0;
const context = (over: Partial<AdmissionContext> = {}): AdmissionContext => ({
  liveMode: true,
  durableLedger: true,
  totalCallBudget: 60,
  perRunCallCeiling: 6,
  now: () => '2026-08-29T00:00:00.000Z',
  newId: (prefix) => `${prefix}-${++counter}`,
  ...over,
});

let ledger: RunLedger;
beforeEach(() => {
  counter = 0;
  ledger = new RunLedger(new MemoryRunStore());
});

describe('the scenario allowlist', () => {
  it('accepts only scenarios the server itself declared', () => {
    expect(findScenario('dependency_onboarding')).not.toBeNull();
    expect(findScenario('anything_else')).toBeNull();
  });

  it('fixes every field that could widen cost or reach', () => {
    // A request names a scenario; it never describes one. Nothing below may be
    // supplied by a caller.
    for (const scenario of LIVE_SCENARIOS) {
      expect(scenario.sideEffectClass).toBe('idempotent_read');
      expect(scenario.recoveryAction).toBe('retry_idempotent_read');
      expect(scenario.maxWardenRetries).toBe(1);
      expect(scenario.maxModelCalls).toBeLessThanOrEqual(6);
      expect(scenario.maxOutputTokens).toBeLessThanOrEqual(256);
      expect(scenario.timeoutMs).toBeLessThanOrEqual(90_000);
      expect(scenario.target).not.toContain('://');
    }
  });
});

describe('admission', () => {
  it('admits an allowlisted scenario and records the run', () => {
    const result = admitRun(ledger, context(), { scenarioId: 'dependency_onboarding' });
    expect(result.admitted).toBe(true);
    if (!result.admitted) return;
    expect(result.run.state).toBe('admitted');
    expect(result.run.modelCalls).toBe(0);
    expect(result.run.terminalResult).toBe('unknown');
    expect(ledger.get(result.run.runId)).not.toBeNull();
  });

  it('refuses when live mode is off', () => {
    const result = admitRun(ledger, context({ liveMode: false }), {
      scenarioId: 'dependency_onboarding',
    });
    expect(result.admitted).toBe(false);
    if (result.admitted) return;
    expect(result.rejection.reason).toBe('live_mode_disabled');
    // Nothing was written: a refused run must leave no trace to clean up.
    expect(ledger.all()).toHaveLength(0);
  });

  it('refuses to start when the ledger cannot survive a restart', () => {
    // Exactly-once is the ledger's whole job. Without durability the proof does
    // not survive a crash between persisting the key and executing, so the run
    // is refused rather than started on a promise that cannot be kept.
    const result = admitRun(ledger, context({ durableLedger: false }), {
      scenarioId: 'dependency_onboarding',
    });
    expect(result.admitted).toBe(false);
    if (result.admitted) return;
    expect(result.rejection.reason).toBe('ledger_not_durable');
    expect(ledger.all()).toHaveLength(0);
  });

  it('refuses a scenario it did not declare', () => {
    const result = admitRun(ledger, context(), { scenarioId: '../../etc/passwd' });
    expect(result.admitted).toBe(false);
    if (result.admitted) return;
    expect(result.rejection.reason).toBe('scenario_not_allowlisted');
  });

  it('refuses a second concurrent run', () => {
    // Two runs at once would make the budget, the single Intervention slot and
    // the viewer's cursor all ambiguous.
    const first = admitRun(ledger, context(), { scenarioId: 'dependency_onboarding' });
    expect(first.admitted).toBe(true);

    const second = admitRun(ledger, context(), { scenarioId: 'dependency_onboarding' });
    expect(second.admitted).toBe(false);
    if (second.admitted) return;
    expect(second.rejection.reason).toBe('run_already_active');
  });

  it('admits again once the previous run reaches a terminal state', () => {
    const first = admitRun(ledger, context(), { scenarioId: 'dependency_onboarding' });
    if (!first.admitted) throw new Error('expected admission');
    ledger.put({ ...first.run, state: 'completed', terminalResult: 'succeeded' });

    expect(admitRun(ledger, context(), { scenarioId: 'dependency_onboarding' }).admitted).toBe(
      true,
    );
  });

  it('refuses a run that could not finish inside the ceiling', () => {
    // Checked against what the scenario COULD spend, not what it has spent, so
    // a run is never started that has to be killed halfway through.
    const spent: RunRecord = {
      runId: 'run-old',
      sessionId: 'sess-old',
      scenarioId: 'dependency_onboarding',
      mode: 'live',
      state: 'completed',
      startedAt: '2026-08-29T00:00:00.000Z',
      endedAt: '2026-08-29T00:00:10.000Z',
      modelCalls: 57,
      estimatedCostUsd: 0.01,
      interventionCount: 1,
      terminalResult: 'succeeded',
      idempotencyKey: 'run-old:retry_idempotent_read:1',
      correlationId: 'corr-old',
    };
    ledger.put(spent);
    expect(callsUsed(ledger)).toBe(57);

    const result = admitRun(ledger, context({ totalCallBudget: 60 }), {
      scenarioId: 'dependency_onboarding',
    });
    expect(result.admitted).toBe(false);
    if (result.admitted) return;
    expect(result.rejection.reason).toBe('call_budget_exhausted');
  });

  it('gives every run a correlation id and an idempotency key up front', () => {
    const result = admitRun(ledger, context(), { scenarioId: 'dependency_onboarding' });
    if (!result.admitted) throw new Error('expected admission');
    expect(result.run.correlationId).not.toBe('');
    // Bound to the run and the single permitted recovery, so a redelivery of
    // the same Intervention resolves to the same key.
    expect(result.run.idempotencyKey).toBe(`${result.run.runId}:retry_idempotent_read:1`);
  });
});

describe('idempotency across redelivery', () => {
  it('recognises a key it has already written', () => {
    const result = admitRun(ledger, context(), { scenarioId: 'dependency_onboarding' });
    if (!result.admitted) throw new Error('expected admission');
    expect(ledger.hasIdempotencyKey(result.run.idempotencyKey)).toBe(true);
    expect(ledger.hasIdempotencyKey('run-other:retry_idempotent_read:1')).toBe(false);
  });

  it('still recognises it after the run is rewritten many times', () => {
    // Ten redeliveries of the same Intervention must resolve to one key, which
    // is what lets the adapter refuse the second external request.
    const result = admitRun(ledger, context(), { scenarioId: 'dependency_onboarding' });
    if (!result.admitted) throw new Error('expected admission');
    for (let attempt = 0; attempt < 10; attempt += 1) {
      ledger.put({ ...result.run, state: 'running', interventionCount: 1 });
    }
    const keys = new Set(ledger.all().map((run) => run.idempotencyKey));
    expect(keys.size).toBe(1);
    expect(ledger.all()).toHaveLength(1);
  });
});

describe('the append-only ledger', () => {
  it('reports the latest version of a run', () => {
    const result = admitRun(ledger, context(), { scenarioId: 'dependency_onboarding' });
    if (!result.admitted) throw new Error('expected admission');
    ledger.put({ ...result.run, state: 'running' });
    ledger.put({ ...result.run, state: 'completed', terminalResult: 'succeeded' });

    const current = ledger.get(result.run.runId);
    expect(current?.state).toBe('completed');
    expect(current?.terminalResult).toBe('succeeded');
    expect(isActive(current!)).toBe(false);
  });

  it('survives a corrupt line rather than losing every run', () => {
    const store = new MemoryRunStore();
    store.append('{"not":"a run"');
    const recoverable = new RunLedger(store);
    const result = admitRun(recoverable, context(), { scenarioId: 'dependency_onboarding' });
    expect(result.admitted).toBe(true);
    expect(recoverable.all()).toHaveLength(1);
  });

  it('treats admitted and running as occupying the active slot', () => {
    const base = admitRun(ledger, context(), { scenarioId: 'dependency_onboarding' });
    if (!base.admitted) throw new Error('expected admission');
    for (const state of ['admitted', 'running'] as const) {
      expect(isActive({ ...base.run, state })).toBe(true);
    }
    for (const state of ['completed', 'failed', 'stopped', 'timed_out'] as const) {
      expect(isActive({ ...base.run, state })).toBe(false);
    }
  });

  // ── the per-run ceiling ───────────────────────────────────────────────────
  //
  // The scenario declares six model calls in server source. The deployment
  // declares what it permits. These were previously two unrelated numbers in
  // two files, and nothing compared them: a deployment configured lower would
  // have admitted the run and then died on the call that crossed the line.

  it('refuses a scenario that needs more model calls than the deployment permits', () => {
    const result = admitRun(ledger, context({ perRunCallCeiling: 5 }), {
      scenarioId: 'dependency_onboarding',
    });
    if (result.admitted) throw new Error('expected refusal');
    expect(result.rejection).toEqual({
      reason: 'scenario_exceeds_call_ceiling',
      scenarioId: 'dependency_onboarding',
      requires: 6,
      ceiling: 5,
    });
  });

  it('records nothing when the ceiling refuses the run', () => {
    admitRun(ledger, context({ perRunCallCeiling: 0 }), { scenarioId: 'dependency_onboarding' });
    expect(ledger.all()).toEqual([]);
  });

  it('admits the scenario at exactly the ceiling', () => {
    // The shipped default is 6 and the scenario reserves 6, so an off-by-one
    // here would refuse the only scenario the product has.
    const result = admitRun(ledger, context({ perRunCallCeiling: 6 }), {
      scenarioId: 'dependency_onboarding',
    });
    expect(result.admitted).toBe(true);
  });

  it('checks the ceiling before the active-run conflict', () => {
    // A misconfigured deployment should say so, not blame whichever run
    // happens to be in flight.
    admitRun(ledger, context(), { scenarioId: 'dependency_onboarding' });
    const second = admitRun(ledger, context({ perRunCallCeiling: 1 }), {
      scenarioId: 'dependency_onboarding',
    });
    if (second.admitted) throw new Error('expected refusal');
    expect(second.rejection.reason).toBe('scenario_exceeds_call_ceiling');
  });
});
