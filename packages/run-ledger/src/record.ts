/**
 * The durable record of one live run.
 *
 * # Why a ledger and not an in-memory counter
 *
 * The existing `/live/decision` path counts calls in memory and says so: a
 * restart forgets them. That is acceptable for one bounded decision. A run that
 * spends up to six model calls, reaches the internet and performs a recovery
 * cannot forget: an Intervention must execute exactly once ACROSS restarts, and
 * proving that needs a record that survives one.
 */

/** Where a run is in its lifecycle. */
export type RunState = 'admitted' | 'running' | 'completed' | 'failed' | 'stopped' | 'timed_out';

/** How the run's evidence was produced. Never inferred. */
export type RunMode = 'live' | 'recorded_fallback';

/**
 * What a run ended as, in the session's own terms.
 *
 * `unknown` is a real value: a run whose terminal state was never observed must
 * report that rather than defaulting to failure or success.
 */
export type TerminalResult = 'succeeded' | 'failed' | 'timed_out' | 'stopped' | 'unknown';

export interface RunRecord {
  readonly runId: string;
  readonly sessionId: string;
  readonly scenarioId: string;
  readonly mode: RunMode;
  readonly state: RunState;
  readonly startedAt: string;
  readonly endedAt: string | null;
  /** Model calls actually issued. Incremented before a call, never after. */
  readonly modelCalls: number;
  /** Estimated, and labelled as such wherever it is shown. */
  readonly estimatedCostUsd: number;
  readonly interventionCount: number;
  readonly terminalResult: TerminalResult;
  /**
   * The key an Intervention is deduplicated by. Persisted BEFORE any external
   * request, so a crash between persist and execute cannot produce a second one.
   */
  readonly idempotencyKey: string;
  /** Ties this run to its events, spans and tool calls across every hop. */
  readonly correlationId: string;
}

/** A run that has been admitted but has not executed anything yet. */
export function newRun(input: {
  runId: string;
  sessionId: string;
  scenarioId: string;
  mode: RunMode;
  startedAt: string;
  correlationId: string;
  idempotencyKey: string;
}): RunRecord {
  return {
    ...input,
    state: 'admitted',
    endedAt: null,
    modelCalls: 0,
    estimatedCostUsd: 0,
    interventionCount: 0,
    terminalResult: 'unknown',
  };
}

/** Whether a run is still occupying the single active slot. */
export function isActive(run: RunRecord): boolean {
  return run.state === 'admitted' || run.state === 'running';
}
