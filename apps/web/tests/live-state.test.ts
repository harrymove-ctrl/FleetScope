import { describe, expect, it } from 'vitest';

import {
  DELEGATION_UNKNOWN,
  deriveBeats,
  deriveLive,
  REPLAY_NOTE,
  TRUTH_LABEL,
  type CanonicalEvent,
  type Capability,
  type EventsPage,
  type RunSnapshot,
} from '../src/features/live/state';
import { resolveApiBase } from '../src/features/live/client';

/**
 * The Story surface may only say what the events say.
 *
 * These tests exist because the failure mode of a demo UI is not a crash, it is
 * a confident sentence about something that did not happen.
 */

const capability = (over: Partial<Capability> = {}): Capability => ({
  liveMode: true,
  runDriver: 'mcp',
  durableLedger: true,
  budget: { used: 0, limit: 60, perRunCeiling: 6 },
  activeRunId: null,
  ...over,
});

const run = (over: Partial<RunSnapshot> = {}): RunSnapshot => ({
  runId: 'run-1',
  state: 'running',
  terminalResult: 'unknown',
  endedAt: null,
  modelCalls: 0,
  ...over,
});

let sequence = 0;
const event = (kind: string, over: Partial<CanonicalEvent> = {}): CanonicalEvent => ({
  sequence: (sequence += 1),
  kind,
  agent: 'external_agent',
  truth: 'live',
  payload: {},
  ...over,
});

const page = (events: CanonicalEvent[], complete = false): EventsPage => ({
  state: complete ? 'completed' : 'running',
  phase: complete ? 'finished' : 'running',
  complete,
  highWaterMark: events.at(-1)?.sequence ?? 0,
  events,
  replay: { modelCalls: 0, toolCalls: 0, wardenActions: 0 },
});

/** The transcript the MCP path actually produces. */
function transcript(): CanonicalEvent[] {
  sequence = 0;
  return [
    event('run_start'),
    event('tool_call', { payload: { idempotencyKey: 'k' } }),
    event('tool_result', { truth: 'controlled_fault', payload: { status: 'failed' } }),
    event('incident', {
      truth: 'controlled_fault',
      payload: { reason: 'Controlled Fault: injected' },
    }),
    event('intervention', {
      agent: 'warden',
      payload: { rationale: 'idempotent_read is repeatable' },
    }),
    event('tool_call', { payload: { idempotencyKey: 'k' } }),
    event('tool_result', { payload: { status: 'ok' } }),
    event('run_end', { payload: { terminalResult: 'succeeded', delegationObserved: false } }),
  ];
}

// ── the ten states ──────────────────────────────────────────────────────────

describe('every required state is reachable and named', () => {
  it('unavailable when there is no API', () => {
    const view = deriveLive({ capability: null, run: null, page: null });
    expect(view.state).toBe('unavailable');
    expect(view.canStart).toBe(false);
  });

  it('ready before anything is started', () => {
    const view = deriveLive({ capability: capability(), run: null, page: null });
    expect(view.state).toBe('ready');
    expect(view.canStart).toBe(true);
  });

  it('starting while the admission request is in flight', () => {
    const view = deriveLive({ capability: capability(), run: null, page: null, starting: true });
    expect(view.state).toBe('starting');
    expect(view.canStart).toBe(false);
  });

  it('awaiting_agent when an MCP run is admitted and nothing has driven it', () => {
    const view = deriveLive({
      capability: capability({ runDriver: 'mcp' }),
      run: run({ state: 'admitted' }),
      page: page([]),
    });
    expect(view.state).toBe('awaiting_agent');
    expect(view.sentence).toContain('Your Gemini/Antigravity agent is ready to call FleetScope.');
    expect(view.sentence).toContain('FleetScope is governing the tool and recovery policy.');
  });

  it('running once the agent has called the tool', () => {
    sequence = 0;
    const view = deriveLive({
      capability: capability(),
      run: run(),
      page: page([event('run_start'), event('tool_call')]),
    });
    expect(view.state).toBe('running');
  });

  it('incident after the Controlled Fault and before the Warden acts', () => {
    const events = transcript().slice(0, 4);
    const view = deriveLive({ capability: capability(), run: run(), page: page(events) });
    expect(view.state).toBe('incident');
    expect(view.incidentReason).toContain('Controlled Fault');
  });

  it('recovering once the Warden has authorised the retry', () => {
    const events = transcript().slice(0, 5);
    const view = deriveLive({ capability: capability(), run: run(), page: page(events) });
    expect(view.state).toBe('recovering');
    expect(view.policyRationale).toContain('repeatable');
  });

  it('completed when the run succeeded', () => {
    const view = deriveLive({
      capability: capability(),
      run: run({
        state: 'completed',
        terminalResult: 'succeeded',
        endedAt: '2026-08-29T00:00:00Z',
      }),
      page: page(transcript(), true),
    });
    expect(view.state).toBe('completed');
    expect(view.result).toBe('succeeded');
    expect(view.canReplay).toBe(true);
  });

  it('failed when the run did not succeed', () => {
    const view = deriveLive({
      capability: capability(),
      run: run({ state: 'failed', terminalResult: 'failed', endedAt: '2026-08-29T00:00:00Z' }),
      page: page(transcript(), true),
    });
    expect(view.state).toBe('failed');
  });

  it('historical_replay, and says the replay costs nothing', () => {
    const view = deriveLive({
      capability: capability(),
      run: run({
        state: 'completed',
        terminalResult: 'succeeded',
        endedAt: '2026-08-29T00:00:00Z',
      }),
      page: page(transcript(), true),
      replaying: true,
    });
    expect(view.state).toBe('historical_replay');
    expect(view.sentence).toContain(REPLAY_NOTE);
    expect(REPLAY_NOTE).toContain('zero model, tool and Warden calls');
  });
});

// ── what may not be claimed ─────────────────────────────────────────────────

describe('the page cannot claim what the events do not say', () => {
  it('shows delegation as unknown when no delegation event exists', () => {
    const view = deriveLive({
      capability: capability(),
      run: run({ endedAt: '2026-08-29T00:00:00Z', terminalResult: 'succeeded' }),
      page: page(transcript(), true),
    });
    expect(view.delegation.observed).toBe(false);
    expect(view.delegation.text).toBe(DELEGATION_UNKNOWN);
  });

  it('shows delegation as observed only when the event is present', () => {
    sequence = 0;
    const events = [
      event('run_start'),
      event('delegation', { payload: { to: 'security_review' } }),
    ];
    const view = deriveLive({ capability: capability(), run: run(), page: page(events) });
    expect(view.delegation.observed).toBe(true);
    expect(view.delegation.text).toContain('observed at event 2');
  });

  it('marks a beat done only because an event of that kind exists', () => {
    sequence = 0;
    const beats = deriveBeats([event('run_start')]);
    expect(beats.find((beat) => beat.id === 'start')?.status).toBe('done');
    for (const id of ['read', 'fault', 'retry', 'result']) {
      expect(beats.find((beat) => beat.id === id)?.status, id).toBe('pending');
    }
  });

  it('carries each beat truth label from its own event', () => {
    const beats = deriveBeats(transcript());
    expect(beats.find((beat) => beat.id === 'fault')?.truth).toBe('controlled_fault');
    expect(beats.find((beat) => beat.id === 'start')?.truth).toBe('live');
  });

  it('tells the five-beat story in the required order', () => {
    expect(deriveBeats(transcript()).map((beat) => beat.label)).toEqual([
      'Start',
      'Governed read',
      'Controlled Fault',
      'Warden retry',
      'Result',
    ]);
  });

  it('names every truth label a reader may meet', () => {
    expect(TRUTH_LABEL).toEqual({
      live: 'Live',
      controlled_fault: 'Controlled Fault',
      recorded: 'Recorded',
      unknown: 'Unknown',
      unavailable: 'Unavailable',
    });
  });

  it('reports no result before the run ends', () => {
    const view = deriveLive({
      capability: capability(),
      run: run(),
      page: page(transcript().slice(0, 5)),
    });
    expect(view.result).toBeNull();
    expect(view.canReplay).toBe(false);
  });
});

// ── refusals a judge must be able to read ───────────────────────────────────

describe('a deployment that may not start a run says so', () => {
  it('refuses to offer the CTA when live mode is off', () => {
    const view = deriveLive({ capability: capability({ liveMode: false }), run: null, page: null });
    expect(view.canStart).toBe(false);
    expect(view.blockedReason).toContain('LIVE_MODE');
  });

  it('refuses to offer the CTA when the ledger is not durable', () => {
    const view = deriveLive({
      capability: capability({ durableLedger: false }),
      run: null,
      page: null,
    });
    expect(view.canStart).toBe(false);
    expect(view.blockedReason).toContain('durable');
  });

  it('surfaces the cursor and the budget for a judge to check', () => {
    const view = deriveLive({
      capability: capability({ budget: { used: 3, limit: 60, perRunCeiling: 6 } }),
      run: run(),
      page: page(transcript()),
    });
    expect(view.cursor).toBe(8);
    expect(view.budget).toEqual({ used: 3, limit: 60 });
  });
});

// ── the API override is not a redirect primitive ────────────────────────────

describe('the ?api= development override', () => {
  it('accepts a loopback origin', () => {
    expect(resolveApiBase(null, '?api=http://127.0.0.1:8123')).toBe('http://127.0.0.1:8123');
    expect(resolveApiBase(null, '?api=http://localhost:9000/x')).toBe('http://localhost:9000');
  });

  it('ignores any origin that is not loopback', () => {
    // Otherwise a link could point this page's POST at someone else's service.
    for (const raw of ['http://evil.example', 'https://10.0.0.5', 'not-a-url', '//evil.example']) {
      expect(resolveApiBase('http://127.0.0.1:8080', `?api=${raw}`), raw).toBe(
        'http://127.0.0.1:8080',
      );
    }
  });

  it('falls back to the built-in value when absent', () => {
    expect(resolveApiBase('http://127.0.0.1:8080', '')).toBe('http://127.0.0.1:8080');
    expect(resolveApiBase(null, '')).toBeNull();
  });
});
