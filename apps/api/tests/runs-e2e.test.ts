import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseConfig } from '@fleetscope/shared';
import { beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { FileRunStore } from '../src/runs/store.js';
import {
  productionWorkerLauncher,
  type RunExecutor,
  type WorkerLauncher,
} from '../src/runs/worker.js';
import type { RunRoutesDependencies } from '../src/routes/runs.js';

/**
 * The whole local pipeline, with a REAL worker process.
 *
 * POST /runs -> the API spawns `fleetscope_worker.main` -> the worker's events
 * are appended to the run ledger -> the run reaches a terminal state -> the
 * events are replayed from storage.
 *
 * # Why this spawns a process instead of faking one
 *
 * Every other test in this file's neighbourhood injects a launcher, which is
 * right for asserting admission logic and wrong for asserting that the two
 * processes actually agree. The contract between them is a pipe carrying JSON
 * written by Python and parsed by TypeScript, and nothing but running both
 * proves it holds.
 *
 * # Why it costs nothing
 *
 * The worker runs in `pure` mode with `FLEETSCOPE_WORKER_OFFLINE=true`: no
 * model, no network, and its evidence is labelled `recorded` throughout.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const WORKER_PYTHON = resolve(REPO_ROOT, 'apps/adk-worker/.venv/bin/python');

const workerAvailable = existsSync(WORKER_PYTHON);

interface RunBody {
  readonly run: { readonly runId: string; readonly state: string };
  readonly executing: boolean;
  readonly mode: string;
}

interface EventsBody {
  readonly state: string;
  readonly phase: string;
  readonly highWaterMark: number;
  readonly complete: boolean;
  readonly observed: { modelCalls: number; toolCalls: number; wardenActions: number };
  readonly replay: { modelCalls: number; toolCalls: number; wardenActions: number };
  readonly events: readonly {
    sequence: number;
    kind: string;
    agent: string;
    truth: string;
    runId: string;
    correlationId: string;
  }[];
}

let spawnCount = 0;
let executor: RunExecutor;
let app: ReturnType<typeof createApp>;

function build(): void {
  const parsed = parseConfig({
    LIVE_MODE: 'true',
    GEMINI_MODEL: 'gemini-2.5-flash',
    // Never transmitted: `pure` mode has no model in it at all.
    GEMINI_API_KEY: 'placeholder-unused',
    FLEETSCOPE_WORKER_PYTHON: WORKER_PYTHON,
    FLEETSCOPE_WORKER_DIR: resolve(REPO_ROOT, 'apps/adk-worker'),
    FLEETSCOPE_WORKER_PYTHONPATH: resolve(REPO_ROOT, 'apps/adk-worker/src'),
    // No model and no network: the read is answered from a recorded fixture.
    FLEETSCOPE_WORKER_OFFLINE: 'true',
  });
  if (!parsed.ok) throw new Error(parsed.error.join('; '));

  const real = productionWorkerLauncher(parsed.value);
  const counting: WorkerLauncher = {
    start: (input, sink) => {
      spawnCount += 1;
      return real.start(input, sink);
    },
  };

  const dependencies: RunRoutesDependencies = {
    store: new FileRunStore(join(mkdtempSync(join(tmpdir(), 'fleetscope-e2e-')), 'runs.jsonl')),
    durable: true,
    totalCallBudget: 60,
    perRunCallCeiling: 6,
    launcher: counting,
    workerTimeoutMs: 60_000,
    workerMode: 'pure',
    runDriver: 'worker',
    now: () => new Date().toISOString(),
    newId: (prefix) => `${prefix}-e2e-${Math.random().toString(36).slice(2, 10)}`,
    isLoopback: () => true,
    onExecutor: (created) => {
      executor = created;
    },
  };

  app = createApp(parsed.value, 'silent', undefined, dependencies);
}

const post = async (): Promise<Response> =>
  await app.request('/runs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scenarioId: 'dependency_onboarding' }),
  });

const events = async (runId: string, after = 0): Promise<EventsBody> =>
  (await (await app.request(`/runs/${runId}/events?after=${after}`)).json()) as EventsBody;

describe.runIf(workerAvailable)('POST /runs drives a real worker end to end', () => {
  let runId: string;
  let start: RunBody;

  beforeAll(async () => {
    build();
    const response = await post();
    expect(response.status).toBe(201);
    start = (await response.json()) as RunBody;
    runId = start.run.runId;
    await executor.settled(runId);
  }, 90_000);

  it('reports the run as executing only because a process was started', () => {
    expect(start.executing).toBe(true);
    expect(start.run.state).toBe('running');
    expect(spawnCount).toBe(1);
  });

  it('runs in pure mode, so nothing could have been spent', () => {
    expect(start.mode).toBe('pure');
  });

  it('reaches a completed terminal state', async () => {
    const body = (await (await app.request(`/runs/${runId}`)).json()) as {
      run: { state: string; terminalResult: string; endedAt: string | null };
      phase: string;
    };
    expect(body.run.state).toBe('completed');
    expect(body.run.terminalResult).toBe('succeeded');
    expect(body.run.endedAt).not.toBeNull();
    expect(body.phase).toBe('finished');
  });

  it('persisted the worker events into the run ledger', async () => {
    const body = await events(runId);
    expect(body.events.length).toBeGreaterThanOrEqual(13);
    expect(body.complete).toBe(true);
  });

  it('tells the five-beat story in canonical order', async () => {
    const kinds = (await events(runId)).events.map((event) => event.kind);
    const order = ['run_start', 'delegation', 'incident', 'intervention', 'run_end'];
    const positions = order.map((kind) => kinds.indexOf(kind));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions]).toEqual([...positions].sort((a, b) => a - b));
  });

  it('records the Controlled Fault as one, never as an outage', async () => {
    const body = await events(runId);
    const incident = body.events.find((event) => event.kind === 'incident');
    expect(incident?.truth).toBe('controlled_fault');
  });

  it('never labels a recorded run as live', async () => {
    const truths = new Set((await events(runId)).events.map((event) => event.truth));
    expect(truths.has('live')).toBe(false);
    expect([...truths].every((truth) => truth === 'recorded' || truth === 'controlled_fault')).toBe(
      true,
    );
  });

  it('carries the run and correlation id on every event', async () => {
    const body = await events(runId);
    expect(new Set(body.events.map((event) => event.runId))).toEqual(new Set([runId]));
    expect(new Set(body.events.map((event) => event.correlationId)).size).toBe(1);
  });

  it('numbers events densely from one, so a cursor cannot skip', async () => {
    const sequences = (await events(runId)).events.map((event) => event.sequence);
    expect(sequences).toEqual(sequences.map((_, index) => index + 1));
  });

  // ── the cursor ────────────────────────────────────────────────────────────

  it('returns only what follows the high-water mark', async () => {
    const all = await events(runId);
    const tail = await events(runId, 8);
    expect(tail.events.every((event) => event.sequence > 8)).toBe(true);
    expect(tail.events.length).toBe(all.events.length - 8);
  });

  it('returns nothing once the caller is caught up', async () => {
    const all = await events(runId);
    expect((await events(runId, all.highWaterMark)).events).toEqual([]);
  });

  it('can be reassembled by polling the cursor forward', async () => {
    // What a browser actually does: keep the last sequence, ask for more.
    const collected: number[] = [];
    let cursor = 0;
    for (let poll = 0; poll < 20; poll += 1) {
      const page = await events(runId, cursor);
      if (page.events.length === 0) break;
      for (const event of page.events) collected.push(event.sequence);
      cursor = page.highWaterMark;
    }
    expect(collected).toEqual((await events(runId)).events.map((event) => event.sequence));
  });

  // ── replay is free ────────────────────────────────────────────────────────

  it('replays from storage with no model, tool or Warden call', async () => {
    const before = await events(runId);
    const spawnsBefore = spawnCount;

    for (let replay = 0; replay < 5; replay += 1) {
      const again = await events(runId);
      expect(again.events).toEqual(before.events);
      expect(again.highWaterMark).toBe(before.highWaterMark);
      expect(again.observed).toEqual(before.observed);
      // The replay counters are the claim the UI prints. They are zero because
      // reading storage is all that happened.
      expect(again.replay).toEqual({ modelCalls: 0, toolCalls: 0, wardenActions: 0 });
    }

    // The decisive one: no second worker was ever started.
    expect(spawnCount).toBe(spawnsBefore);
  });

  it('leaves the run record untouched by replaying it', async () => {
    const read = async () =>
      (await (await app.request(`/runs/${runId}`)).json()) as { run: Record<string, unknown> };
    const before = await read();
    await events(runId);
    await events(runId, 3);
    expect((await read()).run).toEqual(before.run);
  });

  it('frees the active slot once the run has finished', async () => {
    const body = (await (await app.request('/runs/active')).json()) as { run: unknown };
    expect(body.run).toBeNull();
  });
});

describe.runIf(!workerAvailable)('the worker virtualenv is missing', () => {
  it('reports that the end-to-end proof was not run', () => {
    // Never a silent pass: an absent worker means the pipeline is unproven.
    expect(
      workerAvailable,
      `no interpreter at ${WORKER_PYTHON}; run uv venv in apps/adk-worker`,
    ).toBe(false);
  });
});
