import { Hono } from 'hono';

import {
  admitRun,
  callsUsed,
  LIVE_SCENARIOS,
  observedWork,
  parseWorkerEvent,
  phaseOf,
  RunEventLedger,
  RunLedger,
  type AdmissionContext,
  type RunStore,
} from '@fleetscope/run-ledger';

import { isLoopbackRequest } from '../runs/loopback.js';
import { RunExecutor, type WorkerLauncher } from '../runs/worker.js';
import type { FleetScopeConfig } from '../config/index.js';

/**
 * The run controller.
 *
 * # What it will and will not accept
 *
 * `POST /runs` takes ONE field: a scenario id from a fixed enum. There is no
 * prompt, no URL, no tool parameter, no retry count and no budget override
 * anywhere in this surface, because every one of those would widen either the
 * spend or the reach of a live run. The scenario's own definition owns all of
 * them, in server source, and the worker enforces the same closed contract on
 * its own side.
 *
 * # Nothing executes before admission
 *
 * Admission is decided from the ledger alone. A refused run costs nothing: no
 * process is spawned, no model call, no external request.
 *
 * # `executing` means the process exists
 *
 * The response says `executing: true` only after the operating system has
 * actually started the worker. See `runs/worker.ts` for why that is a promise
 * on the child's own `spawn` event rather than an assumption.
 *
 * # Why the mutation is loopback-only
 *
 * Starting a run spawns a process and reaches the internet. That control
 * belongs to whoever is at the machine. Reads are not restricted.
 */
export interface RunRoutesDependencies {
  readonly store: RunStore;
  readonly durable: boolean;
  /** Total model calls this deployment may spend across all runs. */
  readonly totalCallBudget: number;
  /** The most model calls one run may reserve. */
  readonly perRunCallCeiling: number;
  readonly now: () => string;
  readonly newId: (prefix: string) => string;
  /** Starts the worker process. Injected so tests never spawn anything. */
  readonly launcher: WorkerLauncher;
  readonly workerTimeoutMs: number;
  /**
   * `pure` runs the scenario with no model at all and labels its evidence
   * `recorded`. Until a live run is explicitly authorised this is the only
   * mode the controller uses.
   */
  readonly workerMode: 'pure' | 'adk';
  /**
   * `worker` spawns FleetScope's own process. `mcp` admits the run and waits
   * for the developer's own CLI agent to drive it through the FleetScope MCP
   * tool, which is how a live run happens with no model credential here.
   */
  readonly runDriver: 'worker' | 'mcp';
  /** Overrides the loopback check in tests that exercise the refusal itself. */
  readonly isLoopback?: (context: Parameters<typeof isLoopbackRequest>[0]) => boolean;
  /** Exposed so an end-to-end test can await a run without polling. */
  readonly onExecutor?: (executor: RunExecutor) => void;
}

export function runRoutes(config: FleetScopeConfig, deps: RunRoutesDependencies): Hono {
  const app = new Hono();
  const ledger = new RunLedger(deps.store);
  const events = new RunEventLedger(deps.store);
  const loopback = deps.isLoopback ?? isLoopbackRequest;
  const executor = new RunExecutor({
    ledger,
    events,
    launcher: deps.launcher,
    now: deps.now,
    timeoutMs: deps.workerTimeoutMs,
  });
  deps.onExecutor?.(executor);

  const context = (): AdmissionContext => ({
    liveMode: config.liveMode,
    durableLedger: deps.durable,
    totalCallBudget: deps.totalCallBudget,
    perRunCallCeiling: deps.perRunCallCeiling,
    now: deps.now,
    newId: deps.newId,
  });

  /**
   * What this deployment can currently do, before anything is started.
   *
   * Reports whether the ledger is durable rather than assuming it: a process
   * with nowhere to write cannot promise exactly-once across a restart, and
   * says so instead of claiming it.
   */
  app.get('/runs/capability', (c) => {
    const active = ledger.active();
    return c.json({
      liveMode: config.liveMode,
      durableLedger: deps.durable,
      workerMode: deps.workerMode,
      runDriver: deps.runDriver,
      scenarios: LIVE_SCENARIOS.map((scenario) => ({
        id: scenario.id,
        description: scenario.description,
        rootAgent: scenario.rootAgent,
        delegatedAgent: scenario.delegatedAgent,
        target: scenario.target,
        externalOperation: scenario.externalOperation,
        recoveryAction: scenario.recoveryAction,
        sideEffectClass: scenario.sideEffectClass,
        maxWardenRetries: scenario.maxWardenRetries,
        maxModelCalls: scenario.maxModelCalls,
        timeoutMs: scenario.timeoutMs,
      })),
      budget: {
        used: callsUsed(ledger),
        limit: deps.totalCallBudget,
        // Reported next to each scenario's own `maxModelCalls` so a reader can
        // see for themselves that the scenario fits, instead of trusting that
        // two numbers in different files agree.
        perRunCeiling: deps.perRunCallCeiling,
      },
      activeRunId: active?.runId ?? null,
    });
  });

  app.get('/runs/active', (c) => c.json({ run: ledger.active() }));

  app.get('/runs/:runId', (c) => {
    const runId = c.req.param('runId');
    const run = ledger.get(runId);
    if (run === null) return c.json({ error: 'run_not_found' }, 404);
    const stored = events.all(runId);
    return c.json({
      run,
      // Derived from the events themselves, so the UI cannot narrate a phase
      // the run never reached.
      phase: phaseOf(stored),
      highWaterMark: stored.length === 0 ? 0 : stored[stored.length - 1]!.sequence,
      // Counted from the run's own events. Reading this again never changes it,
      // which is what makes replay provably free.
      observed: observedWork(stored),
    });
  });

  /**
   * The canonical cursor read.
   *
   * `?after=N` returns everything with a sequence greater than N. A poller
   * keeps the high-water mark it last saw and asks again; a dropped connection
   * loses nothing, and no event can be skipped by arriving out of order.
   *
   * This handler only reads. It spawns nothing, calls no model and performs no
   * recovery, which is what a replay of a finished run is.
   */
  app.get('/runs/:runId/events', (c) => {
    const runId = c.req.param('runId');
    const run = ledger.get(runId);
    if (run === null) return c.json({ error: 'run_not_found' }, 404);

    const raw = Number.parseInt(c.req.query('after') ?? '0', 10);
    const after = Number.isFinite(raw) && raw > 0 ? raw : 0;
    const stored = events.all(runId);

    return c.json({
      runId,
      state: run.state,
      phase: phaseOf(stored),
      events: stored.filter((event) => event.sequence > after),
      highWaterMark: stored.length === 0 ? 0 : stored[stored.length - 1]!.sequence,
      // Whether a poller may stop asking.
      complete: run.endedAt !== null,
      observed: observedWork(stored),
      replay: { modelCalls: 0, toolCalls: 0, wardenActions: 0 },
    });
  });

  /**
   * Events observed by the FleetScope MCP tool, running inside the developer's
   * own agent session.
   *
   * # Why this is loopback-only too
   *
   * It writes evidence. Anything that can append to the ledger can rewrite what
   * the demo claims happened, so it is gated exactly like starting a run.
   *
   * # Why every line is validated
   *
   * The sender is a separate process this service does not control. Each event
   * is shape-checked and must name this run; anything else is counted as
   * rejected and never stored.
   */
  app.post('/runs/:runId/events', async (c) => {
    if (!loopback(c)) return c.json({ error: 'loopback_only' }, 403);

    const runId = c.req.param('runId');
    const run = ledger.get(runId);
    if (run === null) return c.json({ error: 'run_not_found' }, 404);
    if (run.endedAt !== null) {
      // Append-only means a finished run stays finished. A late writer must not
      // be able to reopen it and change the recorded outcome.
      return c.json({ error: 'run_already_finished' }, 409);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid_body' }, 400);
    }
    const incoming = (body as { events?: unknown }).events;
    if (!Array.isArray(incoming)) return c.json({ error: 'events_required' }, 400);

    const known = new Set(events.all(runId).map((event) => event.sequence));
    let accepted = 0;
    let rejected = 0;
    let ended: string | null = null;

    for (const raw of incoming) {
      const event = parseWorkerEvent(raw, runId);
      if (event === null) {
        rejected += 1;
        continue;
      }
      // Idempotent ingest: a retried POST must not duplicate the transcript.
      if (known.has(event.sequence)) continue;
      known.add(event.sequence);
      events.append(event);
      accepted += 1;
      if (event.kind === 'run_end') {
        const terminal = (event.payload as { terminalResult?: unknown }).terminalResult;
        ended = typeof terminal === 'string' ? terminal : 'unknown';
      }
    }

    const stored = events.all(runId);
    const work = observedWork(stored);

    if (ended !== null) {
      ledger.put({
        ...run,
        state: ended === 'succeeded' ? 'completed' : ended === 'timed_out' ? 'timed_out' : 'failed',
        terminalResult:
          ended === 'succeeded'
            ? 'succeeded'
            : ended === 'timed_out'
              ? 'timed_out'
              : ended === 'failed'
                ? 'failed'
                : 'unknown',
        endedAt: deps.now(),
        modelCalls: work.modelCalls,
        interventionCount: work.wardenActions,
      });
    } else if (run.state === 'admitted' && accepted > 0) {
      // An agent has attached. Only now is the run genuinely under way.
      ledger.put({ ...run, state: 'running' });
    }

    return c.json({
      accepted,
      rejected,
      highWaterMark: stored.length === 0 ? 0 : stored[stored.length - 1]!.sequence,
    });
  });

  app.post('/runs', async (c) => {
    if (!loopback(c)) {
      return c.json({ error: 'loopback_only' }, 403);
    }

    // Parse defensively: a malformed body must be refused before admission,
    // not coerced into a scenario lookup.
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid_body' }, 400);
    }
    if (typeof body !== 'object' || body === null) {
      return c.json({ error: 'invalid_body' }, 400);
    }
    const scenarioId = (body as { scenarioId?: unknown }).scenarioId;
    if (typeof scenarioId !== 'string') {
      return c.json({ error: 'scenario_required' }, 400);
    }

    const admission = admitRun(ledger, context(), { scenarioId });
    if (!admission.admitted) {
      // 409 for a state conflict the caller can resolve by waiting; 503 when
      // this deployment cannot host the run safely however often it is asked;
      // 403 for a refusal that will not change on retry.
      const status =
        admission.rejection.reason === 'run_already_active'
          ? 409
          : admission.rejection.reason === 'ledger_not_durable' ||
              admission.rejection.reason === 'scenario_exceeds_call_ceiling'
            ? 503
            : 403;
      return c.json({ error: 'run_rejected', rejection: admission.rejection }, status);
    }

    if (deps.runDriver === 'mcp') {
      // Nothing is spawned and nothing is executing yet: the developer's own
      // agent has not called the tool. Saying `executing: true` here would be
      // the same lie the worker path was built to avoid.
      return c.json(
        {
          run: admission.run,
          scenario: { id: admission.scenario.id, maxModelCalls: admission.scenario.maxModelCalls },
          executing: false,
          awaitingAgent: true,
          mode: 'mcp',
          note:
            'Run admitted. Start your agent in Gemini or Antigravity CLI; the FleetScope MCP ' +
            'tool will attach to this run. Poll /runs/:runId/events?after=<highWaterMark>.',
        },
        201,
      );
    }

    const started = await executor.start(admission.run, deps.workerMode);
    if (!started.executing) {
      // Admitted but unstartable. The run is already recorded as failed, so the
      // active slot is not held by a process that does not exist.
      return c.json(
        { run: started.run, executing: false, error: 'worker_not_started', detail: started.error },
        503,
      );
    }

    return c.json(
      {
        run: started.run,
        scenario: { id: admission.scenario.id, maxModelCalls: admission.scenario.maxModelCalls },
        // True because the process exists, not because we asked for one.
        executing: true,
        mode: deps.workerMode,
        note: 'Worker started. Poll /runs/:runId/events?after=<highWaterMark> for progress.',
      },
      201,
    );
  });

  return app;
}
