/**
 * The run controller, exercised against a REAL started server.
 *
 * # Why this exists as a separate gate
 *
 * `/runs` once mounted only when dependencies were injected. Every route test
 * injected them and passed, while the actual server served 404 on every path,
 * because a test that builds the app itself can never catch a defect in how the
 * app is built. This script therefore spawns the real entrypoint, the same
 * `apps/api` start script a deployment runs, and talks to it over a socket.
 *
 * # Cost
 *
 * Zero. Live mode is enabled so admission can succeed, and a real worker process
 * does run, but it runs in `pure` mode with `FLEETSCOPE_WORKER_OFFLINE=true`: no
 * model, no network, and every event it emits is labelled `recorded`. The model
 * credential is a placeholder that is never transmitted anywhere.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { networkInterfaces, tmpdir } from 'node:os';
import { join } from 'node:path';

let pass = 0;
let fail = 0;
let skip = 0;

function check(name: string, condition: boolean, detail = ''): void {
  const suffix = detail === '' ? '' : `  ::  ${detail}`;
  if (condition) {
    console.log(`   PASS  ${name}${suffix}`);
    pass += 1;
  } else {
    console.log(`   FAIL  ${name}${suffix}`);
    fail += 1;
  }
}

function skipped(name: string, why: string): void {
  console.log(`   SKIP  ${name}  ::  ${why}`);
  skip += 1;
}

/** An unused port, released immediately before the server claims it. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('no port'));
        return;
      }
      const { port } = address;
      probe.close(() => resolve(port));
    });
  });
}

/** A non-loopback address on this host, used to prove the loopback refusal. */
function lanAddress(): string | null {
  for (const list of Object.values(networkInterfaces())) {
    for (const entry of list ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) return entry.address;
    }
  }
  return null;
}

interface Server {
  readonly port: number;
  readonly ledger: string;
  readonly child: ChildProcess;
}

/** Start the REAL server entrypoint and wait until it answers. */
async function start(env: Record<string, string>): Promise<Server> {
  const port = await freePort();
  const ledger = join(mkdtempSync(join(tmpdir(), 'fleetscope-smoke-')), 'runs.jsonl');
  const child = spawn('pnpm', ['--filter', '@fleetscope/api', 'start'], {
    env: {
      ...process.env,
      PORT: String(port),
      API_LOG_LEVEL: 'silent',
      FLEETSCOPE_RUN_LEDGER: ledger,
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited early (${child.exitCode})`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return { port, ledger, child };
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  child.kill('SIGKILL');
  throw new Error('server did not become ready within 60s');
}

async function stop(server: Server): Promise<void> {
  server.child.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (server.child.exitCode === null) server.child.kill('SIGKILL');
}

const json = async (response: Response): Promise<Record<string, unknown>> =>
  (await response.json()) as Record<string, unknown>;

const startRun = (port: number, body: string, host = '127.0.0.1'): Promise<Response> =>
  fetch(`http://${host}:${port}/runs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });

interface EventsPage {
  readonly state: string;
  readonly phase: string;
  readonly complete: boolean;
  readonly highWaterMark: number;
  readonly replay: { modelCalls: number; toolCalls: number; wardenActions: number };
  readonly events: readonly {
    sequence: number;
    kind: string;
    agent: string;
    truth: string;
  }[];
}

const eventsAfter = async (port: number, runId: string, after: number): Promise<EventsPage> =>
  (await (
    await fetch(`http://127.0.0.1:${port}/runs/${runId}/events?after=${after}`)
  ).json()) as EventsPage;

/** Poll the canonical cursor the way a browser would, until the run settles. */
async function pollToCompletion(port: number, runId: string): Promise<EventsPage> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const page = await eventsAfter(port, runId, 0);
    if (page.complete) return page;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('the run did not reach a terminal state within 60s');
}

const LIVE = {
  LIVE_MODE: 'true',
  // The worker answers the allowlisted read from a recorded fixture, so the
  // smoke exercises the whole pipeline without touching the network.
  FLEETSCOPE_WORKER_OFFLINE: 'true',
  GEMINI_MODEL: 'gemini-2.5-flash',
  // Never transmitted: `pure` mode has no model in it at all. Asserted below.
  GEMINI_API_KEY: 'placeholder-not-used-by-this-smoke',
};

const VALID = JSON.stringify({ scenarioId: 'dependency_onboarding' });

async function recordedOnlyPosture(): Promise<void> {
  console.log('\n== LIVE_MODE=false (the default posture)');
  const server = await start({ LIVE_MODE: 'false' });
  try {
    const capability = await fetch(`http://127.0.0.1:${server.port}/runs/capability`);
    check(
      'the real server serves /runs/capability',
      capability.status === 200,
      `HTTP ${capability.status}`,
    );
    check('capability reports recorded-only', (await json(capability))['liveMode'] === false);

    const refused = await startRun(server.port, VALID);
    const body = (await json(refused)) as { rejection?: { reason?: string } };
    check(
      'a start is refused while live mode is off',
      refused.status === 403 && body.rejection?.reason === 'live_mode_disabled',
      `HTTP ${refused.status} ${body.rejection?.reason ?? ''}`,
    );
  } finally {
    await stop(server);
  }
}

async function liveAdmission(): Promise<void> {
  console.log('\n== LIVE_MODE=true (a real worker process, pure mode)');
  const server = await start(LIVE);
  try {
    const capability = await fetch(`http://127.0.0.1:${server.port}/runs/capability`);
    check('GET /runs/capability', capability.status === 200, `HTTP ${capability.status}`);
    const cap = (await json(capability)) as {
      durableLedger?: boolean;
      budget?: { perRunCeiling?: number };
      scenarios?: readonly { id: string; maxModelCalls: number }[];
    };
    check('the configured ledger is durable', cap.durableLedger === true);
    check(
      'every scenario fits under the reported per-run ceiling',
      (cap.scenarios ?? []).every((s) => s.maxModelCalls <= (cap.budget?.perRunCeiling ?? 0)),
      `ceiling ${cap.budget?.perRunCeiling}, scenario needs ${cap.scenarios?.[0]?.maxModelCalls}`,
    );

    const active = await fetch(`http://127.0.0.1:${server.port}/runs/active`);
    check('GET /runs/active', active.status === 200 && (await json(active))['run'] === null);

    const missing = await fetch(`http://127.0.0.1:${server.port}/runs/does-not-exist`);
    check('GET /runs/:runId for an unknown run', missing.status === 404, `HTTP ${missing.status}`);

    // Every refusal below must happen before anything executes.
    const malformed = await startRun(server.port, '{ not json');
    check('a malformed body is refused', malformed.status === 400, `HTTP ${malformed.status}`);

    const noScenario = await startRun(server.port, JSON.stringify({}));
    check('a missing scenario is refused', noScenario.status === 400, `HTTP ${noScenario.status}`);

    const unsupported = await startRun(
      server.port,
      JSON.stringify({ scenarioId: '../../etc/passwd' }),
    );
    const unsupportedBody = (await json(unsupported)) as { rejection?: { reason?: string } };
    check(
      'an unsupported scenario is refused',
      unsupported.status === 403 &&
        unsupportedBody.rejection?.reason === 'scenario_not_allowlisted',
      `HTTP ${unsupported.status}`,
    );

    const remote = lanAddress();
    if (remote === null) {
      skipped('a non-loopback caller is refused', 'this host has no non-loopback IPv4 address');
    } else {
      const response = await startRun(server.port, VALID, remote);
      const body = (await json(response)) as { error?: string };
      check(
        'a non-loopback caller is refused',
        response.status === 403 && body.error === 'loopback_only',
        `via ${remote} gives HTTP ${response.status} ${body.error ?? ''}`,
      );
    }

    // Two starts fired together: admission is synchronous, so exactly one may
    // take the slot however fast the worker is.
    const [first, second] = await Promise.all([
      startRun(server.port, VALID),
      startRun(server.port, VALID),
    ]);
    const accepted = first.status === 201 ? first : second;
    const refused = first.status === 201 ? second : first;

    const run = (await json(accepted)) as {
      run?: { runId: string; state: string; modelCalls: number; idempotencyKey: string };
      executing?: boolean;
      mode?: string;
    };
    check(
      'POST /runs starts the fixed scenario',
      accepted.status === 201,
      `HTTP ${accepted.status}`,
    );
    check(
      'executing is true because a worker process exists',
      run.executing === true && run.run?.state === 'running',
      `state ${run.run?.state}, executing ${run.executing}`,
    );
    check('the worker runs in pure mode', run.mode === 'pure', String(run.mode));
    check(
      'an idempotency key was reserved up front',
      typeof run.run?.idempotencyKey === 'string' &&
        run.run.idempotencyKey.includes('retry_idempotent_read'),
      run.run?.idempotencyKey ?? '(none)',
    );

    const refusedBody = (await json(refused)) as { rejection?: { reason?: string } };
    check(
      'a concurrent start is refused',
      refused.status === 409 && refusedBody.rejection?.reason === 'run_already_active',
      `HTTP ${refused.status} ${refusedBody.rejection?.reason ?? ''}`,
    );

    const runId = run.run?.runId ?? '';
    const settled = await pollToCompletion(server.port, runId);
    check('the run reaches a terminal state', settled.state === 'completed', settled.state);
    check('the phase is derived from the events', settled.phase === 'finished', settled.phase);

    console.log('\n   --- canonical event stream over HTTP ---');
    for (const event of settled.events) {
      const label = event.truth === 'recorded' ? '' : `  [${event.truth.toUpperCase()}]`;
      console.log(
        `      ${String(event.sequence).padStart(2)}  ${event.agent.padEnd(22)} ${event.kind}${label}`,
      );
    }
    console.log('');

    const kinds = settled.events.map((event) => event.kind);
    for (const beat of ['run_start', 'delegation', 'incident', 'intervention', 'run_end']) {
      check(`the story reached ${beat}`, kinds.includes(beat));
    }
    check(
      'the Controlled Fault is labelled, not called an outage',
      settled.events.find((event) => event.kind === 'incident')?.truth === 'controlled_fault',
    );
    check(
      'a recorded run never claims to be live',
      settled.events.every((event) => event.truth !== 'live'),
    );
    check(
      'events are dense from one, so a cursor cannot skip',
      settled.events.every((event, index) => event.sequence === index + 1),
      `${settled.events.length} events`,
    );

    // Replay: read the same evidence again and prove nothing happened.
    const replay = await eventsAfter(server.port, runId, 0);
    check(
      'replay returns the identical transcript',
      JSON.stringify(replay.events) === JSON.stringify(settled.events),
    );
    check(
      'replay performs no model, tool or Warden call',
      replay.replay.modelCalls === 0 &&
        replay.replay.toolCalls === 0 &&
        replay.replay.wardenActions === 0,
      `${replay.replay.modelCalls}/${replay.replay.toolCalls}/${replay.replay.wardenActions}`,
    );
    const tail = await eventsAfter(server.port, runId, replay.highWaterMark);
    check('a caught-up poller receives nothing', tail.events.length === 0);

    const afterAll = (await json(await fetch(`http://127.0.0.1:${server.port}/runs/active`))) as {
      run: unknown;
    };
    check('the active slot is free once the run finished', afterAll.run === null);

    const ledgerText = readFileSync(server.ledger, 'utf8');
    check('the run reached the durable ledger', ledgerText.includes(runId));
    check(
      'the events reached the durable ledger too',
      ledgerText.split('\n').filter((line) => line.includes('"record":"event"')).length ===
        settled.events.length,
    );
  } finally {
    await stop(server);
  }
}

async function overBudget(): Promise<void> {
  console.log('\n== FLEETSCOPE_TOTAL_CALL_BUDGET=0');
  const server = await start({ ...LIVE, FLEETSCOPE_TOTAL_CALL_BUDGET: '0' });
  try {
    const response = await startRun(server.port, VALID);
    const body = (await json(response)) as { rejection?: { reason?: string } };
    check(
      'an over-budget start is refused',
      response.status === 403 && body.rejection?.reason === 'call_budget_exhausted',
      `HTTP ${response.status} ${body.rejection?.reason ?? ''}`,
    );
  } finally {
    await stop(server);
  }
}

async function overPerRunCeiling(): Promise<void> {
  console.log('\n== FLEETSCOPE_RUN_MAX_MODEL_CALLS=5 (the scenario reserves 6)');
  const server = await start({ ...LIVE, FLEETSCOPE_RUN_MAX_MODEL_CALLS: '5' });
  try {
    const response = await startRun(server.port, VALID);
    const body = (await json(response)) as { rejection?: { reason?: string } };
    check(
      'a scenario over the per-run ceiling is refused',
      response.status === 503 && body.rejection?.reason === 'scenario_exceeds_call_ceiling',
      `HTTP ${response.status} ${body.rejection?.reason ?? ''}`,
    );
  } finally {
    await stop(server);
  }
}

async function main(): Promise<number> {
  await recordedOnlyPosture();
  await liveAdmission();
  await overBudget();
  await overPerRunCeiling();
  console.log(`\n${pass} passed, ${fail} failed, ${skip} skipped`);
  return fail === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`\nsmoke aborted: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  },
);
