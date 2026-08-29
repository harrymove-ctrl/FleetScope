/**
 * The judge-first Story state, derived from canonical events only.
 *
 * # Why every field here is derived and none is narrated
 *
 * The page must never be able to claim something the run did not do. So there
 * is no "set the state to running" anywhere: a state is a function of the run
 * record and the events the API returned, and a beat is `done` only because an
 * event of that kind exists. If the worker never emitted a delegation, no
 * arrangement of clicks can make the UI show one.
 *
 * # Why `unknown` is a first-class beat status
 *
 * Gemini CLI has no sub-agents, so on the MCP path delegation is not something
 * the runtime lets us observe. That is different from "it did not happen" and
 * different again from "it failed". It gets its own status and its own words.
 */

export type LiveState =
  | 'unavailable'
  | 'ready'
  | 'starting'
  | 'awaiting_agent'
  | 'running'
  | 'incident'
  | 'recovering'
  | 'completed'
  | 'failed'
  | 'historical_replay';

/** How a record was produced. Never inferred. */
export type Truth = 'live' | 'controlled_fault' | 'recorded' | 'unknown' | 'unavailable';

export const TRUTH_LABEL: Readonly<Record<Truth, string>> = {
  live: 'Live',
  controlled_fault: 'Controlled Fault',
  recorded: 'Recorded',
  unknown: 'Unknown',
  unavailable: 'Unavailable',
};

export interface CanonicalEvent {
  readonly sequence: number;
  readonly kind: string;
  readonly agent: string;
  readonly truth: Truth;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface RunSnapshot {
  readonly runId: string;
  readonly state: string;
  readonly terminalResult: string;
  readonly endedAt: string | null;
  readonly modelCalls: number;
}

export interface EventsPage {
  readonly state: string;
  readonly phase: string;
  readonly complete: boolean;
  readonly highWaterMark: number;
  readonly events: readonly CanonicalEvent[];
  readonly observed?: {
    readonly modelCalls: number;
    readonly toolCalls: number;
    readonly wardenActions: number;
  };
  readonly replay?: {
    readonly modelCalls: number;
    readonly toolCalls: number;
    readonly wardenActions: number;
  };
}

export interface Capability {
  readonly liveMode: boolean;
  readonly runDriver: 'worker' | 'mcp';
  readonly durableLedger: boolean;
  readonly budget: {
    readonly used: number;
    readonly limit: number;
    readonly perRunCeiling: number;
  };
  readonly activeRunId: string | null;
}

export type BeatStatus = 'pending' | 'active' | 'done' | 'failed' | 'unknown';

export interface Beat {
  readonly id: string;
  readonly label: string;
  readonly status: BeatStatus;
  readonly truth: Truth | null;
  readonly sequence: number | null;
  /** Shown when a beat is `unknown`: why, in the reader's terms. */
  readonly note: string | null;
}

export interface LiveView {
  readonly state: LiveState;
  /** One sentence a judge can read in fifteen seconds. */
  readonly sentence: string;
  readonly beats: readonly Beat[];
  readonly delegation: { readonly observed: boolean; readonly text: string };
  readonly agent: string | null;
  readonly incidentReason: string | null;
  readonly policyRationale: string | null;
  readonly result: string | null;
  readonly cursor: number;
  readonly budget: { readonly used: number; readonly limit: number } | null;
  readonly canStart: boolean;
  readonly canReplay: boolean;
  readonly blockedReason: string | null;
}

export const DELEGATION_UNKNOWN = 'Delegation: Unknown / not observable in this runtime';

export const AWAITING_AGENT_LINES: readonly string[] = [
  'Your Gemini/Antigravity agent is ready to call FleetScope.',
  'FleetScope is governing the tool and recovery policy.',
];

export const REPLAY_NOTE = 'Replay performs zero model, tool and Warden calls.';

const BEAT_DEFINITIONS: readonly { id: string; label: string; kinds: readonly string[] }[] = [
  { id: 'start', label: 'Start', kinds: ['run_start'] },
  { id: 'read', label: 'Governed read', kinds: ['tool_call'] },
  { id: 'fault', label: 'Controlled Fault', kinds: ['incident'] },
  { id: 'retry', label: 'Warden retry', kinds: ['intervention'] },
  { id: 'result', label: 'Result', kinds: ['run_end'] },
];

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

function firstOf(events: readonly CanonicalEvent[], kind: string): CanonicalEvent | null {
  return events.find((event) => event.kind === kind) ?? null;
}

function lastOf(events: readonly CanonicalEvent[], kind: string): CanonicalEvent | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event !== undefined && event.kind === kind) return event;
  }
  return null;
}

/** The five beats, each `done` only because an event of its kind exists. */
export function deriveBeats(events: readonly CanonicalEvent[]): Beat[] {
  return BEAT_DEFINITIONS.map((definition) => {
    const match = definition.kinds
      .map((kind) => firstOf(events, kind))
      .find((event): event is CanonicalEvent => event !== null);
    if (match === undefined) {
      return {
        id: definition.id,
        label: definition.label,
        // Pending either way: a finished run that never reached this beat did
        // not reach it, and saying so is the same as saying it never happened.
        status: 'pending' as BeatStatus,
        truth: null,
        sequence: null,
        note: null,
      };
    }
    return {
      id: definition.id,
      label: definition.label,
      status: 'done' as BeatStatus,
      truth: match.truth,
      sequence: match.sequence,
      note: null,
    };
  });
}

export function deriveLive(input: {
  readonly capability: Capability | null;
  readonly run: RunSnapshot | null;
  readonly page: EventsPage | null;
  readonly starting?: boolean;
  readonly replaying?: boolean;
  readonly unavailableReason?: string | null;
}): LiveView {
  const { capability, run, page } = input;
  const events = page?.events ?? [];
  const budget =
    capability === null ? null : { used: capability.budget.used, limit: capability.budget.limit };

  const empty: Omit<LiveView, 'state' | 'sentence' | 'canStart' | 'blockedReason'> = {
    beats: deriveBeats(events),
    delegation: { observed: false, text: DELEGATION_UNKNOWN },
    agent: null,
    incidentReason: null,
    policyRationale: null,
    result: null,
    cursor: page?.highWaterMark ?? 0,
    budget,
    canReplay: false,
  };

  // ── the API is not reachable or not configured ────────────────────────────
  if (capability === null) {
    return {
      ...empty,
      state: 'unavailable',
      sentence:
        input.unavailableReason ??
        'The FleetScope API is not reachable, so no run can be started or replayed.',
      canStart: false,
      blockedReason: input.unavailableReason ?? 'API unavailable',
    };
  }

  // ── configured, but not permitted to start anything ───────────────────────
  const blocked = !capability.liveMode
    ? 'LIVE_MODE is off, so this deployment may replay evidence but not start a run.'
    : !capability.durableLedger
      ? 'The run ledger is not durable, so a run cannot be recorded and will not be started.'
      : null;

  const delegationEvent = firstOf(events, 'delegation');
  const delegation =
    delegationEvent !== null
      ? { observed: true, text: `Delegation: observed at event ${delegationEvent.sequence}` }
      : { observed: false, text: DELEGATION_UNKNOWN };

  const incident = lastOf(events, 'incident');
  const intervention = lastOf(events, 'intervention');
  const end = lastOf(events, 'run_end');
  const lastToolResult = lastOf(events, 'tool_result');
  const agent = lastOf(events, 'tool_call')?.agent ?? events.at(-1)?.agent ?? null;

  const detail = {
    ...empty,
    beats: deriveBeats(events),
    delegation,
    agent,
    incidentReason: incident === null ? null : text(incident.payload['reason']),
    policyRationale: intervention === null ? null : text(intervention.payload['rationale']),
    result: end === null ? null : text(end.payload['terminalResult']),
  };

  if (input.starting === true) {
    return {
      ...detail,
      state: 'starting',
      sentence: 'Admitting a run against the fixed scenario.',
      canStart: false,
      blockedReason: null,
    };
  }

  // ── no run yet ────────────────────────────────────────────────────────────
  if (run === null) {
    return {
      ...detail,
      state: 'ready',
      sentence:
        blocked ?? 'Ready. Starting a run admits it against the fixed scenario and nothing else.',
      canStart: blocked === null,
      blockedReason: blocked,
    };
  }

  const finished = run.endedAt !== null || page?.complete === true;

  if (finished) {
    const succeeded = run.terminalResult === 'succeeded';
    if (input.replaying === true) {
      return {
        ...detail,
        state: 'historical_replay',
        sentence: `Historical replay of ${run.runId}. ${REPLAY_NOTE}`,
        canStart: false,
        canReplay: true,
        blockedReason: null,
      };
    }
    return {
      ...detail,
      state: succeeded ? 'completed' : 'failed',
      sentence: succeeded
        ? 'The governed read failed once by design, the Warden authorised one idempotent retry, and the retry returned the authoritative result.'
        : `The run ended as ${run.terminalResult}.`,
      canStart: blocked === null,
      canReplay: true,
      blockedReason: blocked,
    };
  }

  // ── admitted, but nothing has driven it yet ───────────────────────────────
  if (events.length === 0) {
    return {
      ...detail,
      state: capability.runDriver === 'mcp' ? 'awaiting_agent' : 'running',
      sentence:
        capability.runDriver === 'mcp'
          ? AWAITING_AGENT_LINES.join(' ')
          : 'The worker has started and has not reported yet.',
      canStart: false,
      blockedReason: null,
    };
  }

  // ── under way ─────────────────────────────────────────────────────────────
  if (intervention !== null) {
    return {
      ...detail,
      state: 'recovering',
      sentence:
        `The Warden authorised one idempotent retry under the same key. ${detail.policyRationale ?? ''}`.trim(),
      canStart: false,
      blockedReason: null,
    };
  }
  if (incident !== null) {
    return {
      ...detail,
      state: 'incident',
      sentence: `The first read failed on purpose to exercise recovery: ${detail.incidentReason ?? 'a Controlled Fault'}.`,
      canStart: false,
      blockedReason: null,
    };
  }
  return {
    ...detail,
    state: 'running',
    sentence:
      lastToolResult === null
        ? 'The agent called the governed read.'
        : 'The governed read returned; the run is still under way.',
    canStart: false,
    blockedReason: null,
  };
}
