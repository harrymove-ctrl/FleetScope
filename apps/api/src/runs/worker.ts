import { spawn } from 'node:child_process';

import {
  observedWork,
  parseWorkerEvent,
  type RunEvent,
  type RunEventLedger,
  type RunLedger,
  type RunRecord,
} from '@fleetscope/run-ledger';

import type { FleetScopeConfig } from '../config/index.js';

/**
 * Starting the worker, and recording what it says.
 *
 * # Why `executing` is not a hopeful boolean
 *
 * The route reports `executing: true` only after the operating system has
 * actually started the process. `spawn()` returns a handle immediately and
 * fails later, on an `error` event, so a route that returned as soon as it had
 * a handle would claim a run was executing when the interpreter did not exist.
 * `start()` therefore resolves on the child's own `spawn` event and rejects on
 * `error`, and nothing is marked `running` until it does.
 *
 * # Why the worker's output is validated rather than trusted
 *
 * The worker is a separate process on the other side of a pipe. It could be an
 * older build, a partial write, or a crash mid-line. Every line is parsed and
 * shape-checked by `parseWorkerEvent` before it becomes evidence.
 */

export interface WorkerInput {
  readonly runId: string;
  readonly sessionId: string;
  readonly correlationId: string;
  readonly scenarioId: string;
  readonly mode: 'pure' | 'adk';
}

export interface WorkerSink {
  /** One parsed stdout line that looked like an event. */
  onEvent(raw: unknown): void;
  /** The worker's final summary record, if it wrote one. */
  onSummary(summary: Record<string, unknown>): void;
  /** The process ended. `code` is null when it was killed by a signal. */
  onExit(code: number | null): void;
}

export interface WorkerHandle {
  readonly pid: number | null;
  kill(): void;
}

export interface WorkerLauncher {
  /** Resolves ONLY once the process is actually running. */
  start(input: WorkerInput, sink: WorkerSink): Promise<WorkerHandle>;
}

const SUMMARY_SCHEMA = 'fleetscope.worker.summary.v1';

/** Splits a byte stream into whole lines and hands each to the sink. */
function lineReader(onLine: (line: string) => void): (chunk: string) => void {
  let buffered = '';
  return (chunk: string) => {
    buffered += chunk;
    let newline = buffered.indexOf('\n');
    while (newline !== -1) {
      const line = buffered.slice(0, newline).trim();
      buffered = buffered.slice(newline + 1);
      if (line !== '') onLine(line);
      newline = buffered.indexOf('\n');
    }
  };
}

export function productionWorkerLauncher(config: FleetScopeConfig): WorkerLauncher {
  return {
    start(input, sink) {
      return new Promise<WorkerHandle>((resolve, reject) => {
        const child = spawn(config.worker.python, ['-m', 'fleetscope_worker.main'], {
          cwd: config.worker.directory,
          // Built explicitly rather than inherited. The API process holds a
          // model credential; there is no reason for the worker to see it, and
          // an inherited environment is how a secret reaches a process that
          // never needed one.
          env: {
            PYTHONPATH: config.worker.pythonPath,
            ...(config.worker.offline ? { FLEETSCOPE_WORKER_OFFLINE: 'true' } : {}),
            ...(config.worker.attemptLedger === ''
              ? {}
              : { FLEETSCOPE_ATTEMPT_LEDGER: config.worker.attemptLedger }),
          },
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        const consume = lineReader((line) => {
          let parsed: unknown;
          try {
            parsed = JSON.parse(line);
          } catch {
            return; // Not JSON: the worker's own diagnostics, not evidence.
          }
          const record = parsed as { schema?: unknown };
          if (record.schema === SUMMARY_SCHEMA) {
            sink.onSummary(parsed as Record<string, unknown>);
          } else {
            sink.onEvent(parsed);
          }
        });

        child.stdout.setEncoding('utf8');
        child.stdout.on('data', consume);
        // stderr is deliberately not recorded: a traceback can carry a request
        // body, and this process persists what it is given.
        child.stderr.resume();

        child.once('error', (error) => reject(error));
        child.once('spawn', () => {
          // Only now is the process real.
          child.stdin.write(JSON.stringify(input));
          child.stdin.end();
          resolve({
            pid: child.pid ?? null,
            kill: () => {
              child.kill('SIGKILL');
            },
          });
        });
        child.once('close', (code) => sink.onExit(code));
      });
    },
  };
}

export interface RunExecutorDependencies {
  readonly ledger: RunLedger;
  readonly events: RunEventLedger;
  readonly launcher: WorkerLauncher;
  readonly now: () => string;
  /** Wall-clock ceiling for one worker. Killed and recorded when exceeded. */
  readonly timeoutMs: number;
}

export interface StartOutcome {
  readonly run: RunRecord;
  /** True only when the process is genuinely running. */
  readonly executing: boolean;
  readonly error?: string;
}

export class RunExecutor {
  private readonly settledPromises = new Map<string, Promise<void>>();

  constructor(private readonly deps: RunExecutorDependencies) {}

  /** Resolves when the run reaches a terminal state. Used by tests. */
  settled(runId: string): Promise<void> {
    return this.settledPromises.get(runId) ?? Promise.resolve();
  }

  async start(run: RunRecord, mode: 'pure' | 'adk'): Promise<StartOutcome> {
    let markSettled: () => void = () => {};
    this.settledPromises.set(
      run.runId,
      new Promise<void>((resolve) => {
        markSettled = resolve;
      }),
    );

    let summary: Record<string, unknown> | null = null;
    let finished = false;

    const finish = (state: RunRecord['state'], terminal: RunRecord['terminalResult']): void => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      const current = this.deps.ledger.get(run.runId) ?? run;
      const work = observedWork(this.deps.events.all(run.runId));
      this.deps.ledger.put({
        ...current,
        state,
        terminalResult: terminal,
        endedAt: this.deps.now(),
        // Counted from the run's own events, not from the worker's word for it.
        modelCalls: work.modelCalls,
        interventionCount: work.wardenActions,
      });
      markSettled();
    };

    const sink: WorkerSink = {
      onEvent: (raw) => {
        const event: RunEvent | null = parseWorkerEvent(raw, run.runId);
        if (event !== null) this.deps.events.append(event);
      },
      onSummary: (record) => {
        summary = record;
      },
      onExit: (code) => {
        const terminal = summary?.['terminalResult'];
        if (terminal === 'succeeded') return finish('completed', 'succeeded');
        if (terminal === 'timed_out') return finish('timed_out', 'timed_out');
        // `incomplete` is a real outcome: the worker ran but the evidence the
        // scenario claims is absent. It is a failed run whose result is not
        // something we get to call a success.
        if (terminal === 'incomplete') return finish('failed', 'unknown');
        if (terminal === 'failed') return finish('failed', 'failed');
        // No summary at all: the worker died before it could speak for itself.
        return finish('failed', code === 0 ? 'unknown' : 'failed');
      },
    };

    let handle: WorkerHandle;
    try {
      handle = await this.deps.launcher.start(
        {
          runId: run.runId,
          sessionId: run.sessionId,
          correlationId: run.correlationId,
          scenarioId: run.scenarioId,
          mode,
        },
        sink,
      );
    } catch (error) {
      // The process never started, so the run never executed. Recorded as a
      // failure rather than left `admitted` and blocking the active slot.
      const failed = this.deps.ledger.put({
        ...run,
        state: 'failed',
        terminalResult: 'failed',
        endedAt: this.deps.now(),
      });
      markSettled();
      return {
        run: failed,
        executing: false,
        error: error instanceof Error ? error.message : 'the worker could not be started',
      };
    }

    const timer = setTimeout(() => {
      handle.kill();
      finish('timed_out', 'timed_out');
    }, this.deps.timeoutMs);
    // A pending timer must not keep the process alive after the run is done.
    if (typeof timer.unref === 'function') timer.unref();

    const running = this.deps.ledger.put({ ...run, state: 'running' });
    return { run: running, executing: true };
  }
}
