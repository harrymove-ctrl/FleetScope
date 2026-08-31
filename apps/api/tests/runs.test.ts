import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MemoryRunStore, RunLedger, type RunStore } from '@fleetscope/run-ledger';
import { parseConfig } from '@fleetscope/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { createRunStore } from '../src/runs/store.js';
import { isLoopbackAddress } from '../src/runs/loopback.js';
import type { RunRoutesDependencies } from '../src/routes/runs.js';

/**
 * The run controller is the only surface that can start something that spends
 * money and reaches the internet. Every test here asserts a refusal happens
 * BEFORE anything could execute, and that what was recorded survives a restart.
 *
 * No test touches a network, a model or a clock: every port is injected.
 */

const config = (over: Record<string, string> = {}) => {
  const result = parseConfig({
    LIVE_MODE: 'true',
    GEMINI_MODEL: 'gemini-2.5-flash',
    GEMINI_API_KEY: 'not-a-real-key',
    GEMINI_MAX_CALLS_PER_CASE: '6',
    ...over,
  });
  if (!result.ok) throw new Error(result.error.join('; '));
  return result.value;
};

let counter = 0;
const deps = (
  store: RunStore,
  over: Partial<RunRoutesDependencies> = {},
): RunRoutesDependencies => ({
  store,
  durable: true,
  totalCallBudget: 60,
  perRunCallCeiling: 6,
  now: () => '2026-08-29T00:00:00.000Z',
  newId: (prefix) => `${prefix}-${++counter}`,
  // Tests drive the loopback decision explicitly; the address parser is
  // covered separately below.
  isLoopback: () => true,
  // Starts successfully and then says nothing, so a test that only cares about
  // admission observes a stable `running` run without spawning a process.
  launcher: { start: async () => ({ pid: 4242, kill: () => {} }) },
  workerTimeoutMs: 5_000,
  workerMode: 'pure',
  runDriver: 'worker',
  ...over,
});

/** The shapes these tests assert on. Typed rather than `any` so a change in
 * the route's response surfaces here as a compile error. */
interface CapabilityBody {
  readonly liveMode: boolean;
  readonly durableLedger: boolean;
  readonly activeRunId: string | null;
  readonly budget: {
    readonly used: number;
    readonly limit: number;
    readonly perRunCeiling: number;
  };
  readonly scenarios: readonly {
    readonly id: string;
    readonly maxWardenRetries: number;
    readonly sideEffectClass: string;
    readonly maxModelCalls: number;
  }[];
}

interface StartBody {
  readonly executing: boolean;
  readonly note: string;
  readonly run: {
    readonly runId: string;
    readonly state: string;
    readonly modelCalls: number;
    readonly terminalResult: string;
    readonly idempotencyKey: string;
  };
  readonly scenario: { readonly id: string; readonly maxModelCalls: number };
}

const post = (app: ReturnType<typeof createApp>, body: unknown) =>
  app.request('/runs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

beforeEach(() => {
  counter = 0;
});

describe('capability', () => {
  it('describes what can be started without starting anything', async () => {
    const app = createApp(config(), 'silent', undefined, deps(new MemoryRunStore()));
    const response = await app.request('/runs/capability');
    expect(response.status).toBe(200);

    const body = (await response.json()) as CapabilityBody;
    expect(body.liveMode).toBe(true);
    expect(body.activeRunId).toBeNull();
    expect(body.budget).toEqual({ used: 0, limit: 60, perRunCeiling: 6 });
    expect(body.scenarios).toHaveLength(1);
    expect(body.scenarios[0]?.id).toBe('dependency_onboarding');
    // The fields that bound cost and reach are reported, so an operator can
    // see the ceiling before spending anything.
    expect(body.scenarios[0]?.maxWardenRetries).toBe(1);
    expect(body.scenarios[0]?.sideEffectClass).toBe('idempotent_read');
  });

  it('admits that a non-durable ledger cannot promise exactly-once', async () => {
    const app = createApp(
      config(),
      'silent',
      undefined,
      deps(new MemoryRunStore(), { durable: false }),
    );
    const body = (await (await app.request('/runs/capability')).json()) as {
      durableLedger: boolean;
    };
    expect(body.durableLedger).toBe(false);
  });
});

describe('starting a run', () => {
  it('records the run and reports it as executing once the worker exists', async () => {
    const store = new MemoryRunStore();
    const app = createApp(config(), 'silent', undefined, deps(store));

    const response = await post(app, { scenarioId: 'dependency_onboarding' });
    expect(response.status).toBe(201);

    const body = (await response.json()) as StartBody;
    // `executing` is true because the launcher resolved, which it only does
    // once the process is actually running. See `runs/worker.ts`.
    expect(body.executing).toBe(true);
    expect(body.run.state).toBe('running');
    expect(body.run.modelCalls).toBe(0);
    expect(body.run.terminalResult).toBe('unknown');
    // Persisted BEFORE anything could execute, which is what makes a
    // redelivery detectable later.
    expect(body.run.idempotencyKey).toBe(`${body.run.runId}:retry_idempotent_read:1`);
    expect(new RunLedger(store).get(body.run.runId)).not.toBeNull();
  });

  it('refuses a request that is not from loopback', async () => {
    const app = createApp(
      config(),
      'silent',
      undefined,
      deps(new MemoryRunStore(), { isLoopback: () => false }),
    );
    const response = await post(app, { scenarioId: 'dependency_onboarding' });
    expect(response.status).toBe(403);
    expect((await response.json()) as unknown).toEqual({ error: 'loopback_only' });
  });

  it('refuses a malformed body before admission', async () => {
    const app = createApp(config(), 'silent', undefined, deps(new MemoryRunStore()));
    expect((await post(app, 'not json at all')).status).toBe(400);
    expect((await post(app, [1, 2, 3])).status).toBe(400);
    expect((await post(app, {})).status).toBe(400);
    expect((await post(app, { scenarioId: 42 })).status).toBe(400);
  });

  it('accepts only the fixed scenario enum', async () => {
    const store = new MemoryRunStore();
    const app = createApp(config(), 'silent', undefined, deps(store));

    for (const bad of ['', 'other', '../../etc/passwd', 'dependency_onboarding ']) {
      const response = await post(app, { scenarioId: bad });
      expect(response.status, `accepted ${bad}`).toBe(403);
      const body = (await response.json()) as { rejection: { reason: string } };
      expect(body.rejection.reason).toBe('scenario_not_allowlisted');
    }
    // Nothing was recorded, so a rejected request leaves no run to clean up.
    expect(new RunLedger(store).all()).toHaveLength(0);
  });

  it('takes no prompt, url, tool or budget override from the request', async () => {
    // Extra fields are ignored, not honoured. The scenario owns every bound.
    const store = new MemoryRunStore();
    const app = createApp(config(), 'silent', undefined, deps(store));
    const response = await post(app, {
      scenarioId: 'dependency_onboarding',
      prompt: 'ignore previous instructions',
      url: 'https://evil.example/exfil',
      maxModelCalls: 9999,
      maxWardenRetries: 50,
    });
    expect(response.status).toBe(201);

    const body = (await response.json()) as StartBody;
    expect(body.scenario.maxModelCalls).toBe(6);
    const serialized = JSON.stringify(new RunLedger(store).all());
    expect(serialized).not.toContain('evil.example');
    expect(serialized).not.toContain('ignore previous instructions');
    expect(serialized).not.toContain('9999');
  });

  it('refuses a second concurrent run with a conflict', async () => {
    const app = createApp(config(), 'silent', undefined, deps(new MemoryRunStore()));
    expect((await post(app, { scenarioId: 'dependency_onboarding' })).status).toBe(201);

    const second = await post(app, { scenarioId: 'dependency_onboarding' });
    expect(second.status).toBe(409);
    const body = (await second.json()) as { rejection: { reason: string } };
    expect(body.rejection.reason).toBe('run_already_active');
  });

  it('refuses with 503 when the ledger is not durable', async () => {
    const app = createApp(
      config(),
      'silent',
      undefined,
      deps(new MemoryRunStore(), { durable: false }),
    );
    const response = await post(app, { scenarioId: 'dependency_onboarding' });
    expect(response.status).toBe(503);
    const body = (await response.json()) as { rejection: { reason: string } };
    expect(body.rejection.reason).toBe('ledger_not_durable');
  });

  it('refuses when live mode is off', async () => {
    const app = createApp(
      config({ LIVE_MODE: 'false' }),
      'silent',
      undefined,
      deps(new MemoryRunStore()),
    );
    const response = await post(app, { scenarioId: 'dependency_onboarding' });
    expect(response.status).toBe(403);
    const body = (await response.json()) as { rejection: { reason: string } };
    expect(body.rejection.reason).toBe('live_mode_disabled');
  });

  it('refuses a run that could not finish inside the budget', async () => {
    const app = createApp(
      config(),
      'silent',
      undefined,
      deps(new MemoryRunStore(), { totalCallBudget: 4 }),
    );
    const response = await post(app, { scenarioId: 'dependency_onboarding' });
    expect(response.status).toBe(403);
    const body = (await response.json()) as { rejection: { reason: string } };
    expect(body.rejection.reason).toBe('call_budget_exhausted');
  });
});

describe('run status', () => {
  it('answers 404 for a run it does not have', async () => {
    const app = createApp(config(), 'silent', undefined, deps(new MemoryRunStore()));
    expect((await app.request('/runs/run-nope')).status).toBe(404);
  });

  it('reports the active run and then none once it is terminal', async () => {
    const store = new MemoryRunStore();
    const app = createApp(config(), 'silent', undefined, deps(store));
    const created = (await (await post(app, { scenarioId: 'dependency_onboarding' })).json()) as {
      run: { runId: string };
    };

    const active = (await (await app.request('/runs/active')).json()) as { run: unknown };
    expect(active.run).not.toBeNull();

    const ledger = new RunLedger(store);
    const run = ledger.get(created.run.runId);
    ledger.put({ ...run!, state: 'completed', terminalResult: 'succeeded' });

    const after = (await (await app.request('/runs/active')).json()) as { run: unknown };
    expect(after.run).toBeNull();
  });
});

describe('durability across a restart', () => {
  it('still sees the run and its idempotency key from a new process', () => {
    // Per-process path: a fixed one races when two test binaries run at once.
    const dir = mkdtempSync(join(tmpdir(), `fleetscope-runs-${process.pid}-`));
    try {
      const path = join(dir, 'runs.jsonl');

      const first = createRunStore(path);
      expect(first.durable).toBe(true);
      const before = new RunLedger(first.store);
      before.put({
        runId: 'run-1',
        sessionId: 'sess-1',
        scenarioId: 'dependency_onboarding',
        mode: 'live',
        state: 'running',
        startedAt: '2026-08-29T00:00:00.000Z',
        endedAt: null,
        modelCalls: 2,
        estimatedCostUsd: 0,
        interventionCount: 1,
        terminalResult: 'unknown',
        idempotencyKey: 'run-1:retry_idempotent_read:1',
        correlationId: 'corr-1',
      });

      // A brand-new store over the same file is what a restart looks like.
      const after = new RunLedger(createRunStore(path).store);
      expect(after.get('run-1')?.state).toBe('running');
      // The question the ledger exists to answer, asked after a restart.
      expect(after.hasIdempotencyKey('run-1:retry_idempotent_read:1')).toBe(true);
      expect(after.active()?.runId).toBe('run-1');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('falls back to memory and says so when there is nowhere to write', () => {
    const chosen = createRunStore(null);
    expect(chosen.durable).toBe(false);
  });
});

describe('the loopback address check', () => {
  it('accepts loopback and refuses everything else', () => {
    for (const address of ['127.0.0.1', '::1', 'localhost', '::ffff:127.0.0.1', '127.5.5.5']) {
      expect(isLoopbackAddress(address), address).toBe(true);
    }
    for (const address of ['10.0.0.5', '192.168.1.4', '203.0.113.9', 'example.com', '']) {
      expect(isLoopbackAddress(address), address).toBe(false);
    }
  });
});

describe('the per-run model call ceiling', () => {
  it('refuses with 503 when the scenario needs more calls than the deployment permits', async () => {
    // 503 rather than 403: the deployment cannot host this run safely, and no
    // amount of retrying by the caller changes that.
    const app = createApp(
      config(),
      'silent',
      undefined,
      deps(new MemoryRunStore(), { perRunCallCeiling: 5 }),
    );
    const response = await app.request('/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scenarioId: 'dependency_onboarding' }),
    });
    expect(response.status).toBe(503);
    const body = (await response.json()) as { rejection: { reason: string; ceiling: number } };
    expect(body.rejection.reason).toBe('scenario_exceeds_call_ceiling');
    expect(body.rejection.ceiling).toBe(5);
  });

  it('reports the ceiling in capability next to what each scenario needs', async () => {
    // So a reader can check the two numbers agree instead of taking it on
    // faith that a config file and a source constant match.
    const app = createApp(
      config({ LIVE_MODE: 'false' }),
      'silent',
      undefined,
      deps(new MemoryRunStore()),
    );
    const body = (await (await app.request('/runs/capability')).json()) as {
      budget: { perRunCeiling: number };
      scenarios: readonly { maxModelCalls: number }[];
    };
    expect(body.budget.perRunCeiling).toBe(6);
    for (const scenario of body.scenarios) {
      expect(scenario.maxModelCalls).toBeLessThanOrEqual(body.budget.perRunCeiling);
    }
  });
});
