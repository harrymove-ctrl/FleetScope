/**
 * The canonical event spine.
 *
 * # Why events share the run ledger's file
 *
 * A run record and the events it produced are one history. Splitting them
 * across two files would let them disagree after a crash: a run marked
 * `completed` whose last event never landed, or events for a run the ledger
 * forgot. One append-only file gives them one order and one fsync boundary.
 *
 * Lines are discriminated by `record: 'event'`. Run records carry no such field,
 * so the existing reader skips events without any change to `RunRecord`.
 *
 * # Why `sequence` is the only cursor
 *
 * It is assigned by the worker, densely, from 1. Timestamps collide and are not
 * monotonic across a process boundary. Every read is "give me what comes after
 * sequence N", which is replayable, resumable after a dropped connection, and
 * cannot skip an event that arrived out of order.
 */

/** How a record was produced. Never inferred, never defaulted to `live`. */
export type EventTruth = 'live' | 'controlled_fault' | 'recorded' | 'unknown';

export const EVENT_TRUTHS: readonly EventTruth[] = [
  'live',
  'controlled_fault',
  'recorded',
  'unknown',
];

export interface RunEvent {
  /** Discriminates this line from a `RunRecord` in the same file. */
  readonly record: 'event';
  readonly runId: string;
  readonly correlationId: string;
  /** Canonical, dense from 1, assigned by the worker. The only cursor. */
  readonly sequence: number;
  readonly ts: string;
  readonly agent: string;
  readonly kind: string;
  readonly truth: EventTruth;
  readonly payload: Readonly<Record<string, unknown>>;
}

/**
 * Validate a line the worker wrote before it becomes evidence.
 *
 * The worker is a separate process that could be an old build, a crashed write,
 * or something else entirely. Anything that is not a well-formed event is
 * rejected here rather than stored and trusted later.
 */
export function parseWorkerEvent(raw: unknown, runId: string): RunEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const candidate = raw as Record<string, unknown>;

  const sequence = candidate['sequence'];
  if (typeof sequence !== 'number' || !Number.isInteger(sequence) || sequence < 1) return null;

  const truth = candidate['truth'];
  if (typeof truth !== 'string' || !(EVENT_TRUTHS as readonly string[]).includes(truth)) {
    return null;
  }

  const kind = candidate['kind'];
  const agent = candidate['agent'];
  const ts = candidate['ts'];
  if (typeof kind !== 'string' || typeof agent !== 'string' || typeof ts !== 'string') return null;

  // The worker is told which run it is executing; a line claiming a different
  // one is a bug or a mix-up, and either way must not be filed under this run.
  const claimed = candidate['runId'];
  if (typeof claimed !== 'string' || claimed !== runId) return null;

  const correlationId = candidate['correlationId'];
  const payload = candidate['payload'];

  return {
    record: 'event',
    runId,
    correlationId: typeof correlationId === 'string' ? correlationId : '',
    sequence,
    ts,
    agent,
    kind,
    truth: truth as EventTruth,
    payload:
      typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {},
  };
}

/** Where a run has got to, derived from its events rather than narrated. */
export type RunPhase = 'starting' | 'delegated' | 'incident' | 'intervening' | 'finished';

export function phaseOf(events: readonly RunEvent[]): RunPhase {
  let phase: RunPhase = 'starting';
  for (const event of events) {
    if (event.kind === 'delegation') phase = 'delegated';
    else if (event.kind === 'incident') phase = 'incident';
    else if (event.kind === 'intervention') phase = 'intervening';
    else if (event.kind === 'run_end') phase = 'finished';
  }
  return phase;
}

/**
 * What the run actually did, counted from its own events.
 *
 * Used to prove a replay is free: reading a completed run's events again must
 * leave every one of these numbers where it was.
 */
export interface ObservedWork {
  readonly modelCalls: number;
  readonly toolCalls: number;
  readonly wardenActions: number;
}

export function observedWork(events: readonly RunEvent[]): ObservedWork {
  let modelCalls = 0;
  let toolCalls = 0;
  let wardenActions = 0;
  for (const event of events) {
    if (event.kind === 'model_call') modelCalls += 1;
    else if (event.kind === 'tool_call') toolCalls += 1;
    else if (event.kind === 'intervention') wardenActions += 1;
  }
  return { modelCalls, toolCalls, wardenActions };
}

/** Append-only event storage, sharing the run ledger's file. */
export class RunEventLedger {
  constructor(
    private readonly store: { append(line: string): void; readAll(): readonly string[] },
  ) {}

  append(event: RunEvent): void {
    this.store.append(JSON.stringify(event));
  }

  /** Every event for a run, ordered by canonical sequence. */
  all(runId: string): RunEvent[] {
    const events: RunEvent[] = [];
    const seen = new Set<number>();
    for (const line of this.store.readAll()) {
      const trimmed = line.trim();
      if (trimmed === '') continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        continue;
      }
      const candidate = parsed as { record?: unknown; runId?: unknown };
      if (candidate.record !== 'event' || candidate.runId !== runId) continue;
      const event = parseWorkerEvent(parsed, runId);
      // A duplicate sequence means the worker was restarted or a line was
      // written twice. The first one written wins, so replay stays stable.
      if (event === null || seen.has(event.sequence)) continue;
      seen.add(event.sequence);
      events.push(event);
    }
    return events.sort((a, b) => a.sequence - b.sequence);
  }

  /** Everything after a cursor. The one read a poller or a stream needs. */
  since(runId: string, after: number): RunEvent[] {
    return this.all(runId).filter((event) => event.sequence > after);
  }

  /** The highest canonical sequence stored for a run; 0 when there are none. */
  highWaterMark(runId: string): number {
    return this.all(runId).reduce((high, event) => Math.max(high, event.sequence), 0);
  }
}
