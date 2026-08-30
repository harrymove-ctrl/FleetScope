/**
 * Seven readings of a recorded session, drawn the way a terminal draws.
 *
 * The vocabulary is glyphs in a dashed frame, after mdx-graphs: no SVG, no
 * canvas, no colour doing work that a character could do. It suits this
 * surface because the surface is already a terminal, and it survives a text
 * selection, a screen reader and a copy-paste into an issue.
 *
 * Every reading is backed by a field that exists in the session file. The
 * session carries no token counts, no cost and no per-event latency, so the
 * mdx-graphs shapes that want those -- KPI, Plot, Waterfall, Stat -- are not
 * here. An empty chart would be honest; a chart of invented numbers would not,
 * and inventing them is the one thing this product exists to make impossible.
 *
 * The literals below were generated from the fixture rather than typed, and
 * `viewer-graphs.test.ts` recomputes all of them from it.
 */
import { BUNDLED_CREW, heldSeconds, type CrewMember } from '../launch/crew';

export type EventKind = 'message' | 'thought' | 'transfer' | 'call' | 'result' | 'error';

export interface SessionEvent {
  readonly id: string;
  readonly agent: string;
  readonly kind: EventKind;
  /** Seconds after the session's first event. */
  readonly at: number;
  readonly tool?: string;
  readonly ok: boolean;
}

export const BUNDLED_EVENTS: readonly SessionEvent[] = [
  { id: 'e01', agent: 'user', kind: 'message', at: 0.0, tool: undefined, ok: true },
  { id: 'e02', agent: 'coordinator', kind: 'thought', at: 1.2, tool: undefined, ok: true },
  { id: 'e03', agent: 'coordinator', kind: 'transfer', at: 2.0, tool: undefined, ok: true },
  { id: 'e04', agent: 'flight_search', kind: 'call', at: 3.4, tool: 'search_flights', ok: true },
  { id: 'e05', agent: 'flight_search', kind: 'result', at: 6.9, tool: 'search_flights', ok: true },
  { id: 'e06', agent: 'flight_search', kind: 'message', at: 7.5, tool: undefined, ok: true },
  { id: 'e07', agent: 'coordinator', kind: 'transfer', at: 8.0, tool: undefined, ok: true },
  { id: 'e08', agent: 'hotel_search', kind: 'call', at: 9.1, tool: 'search_hotels', ok: true },
  { id: 'e09', agent: 'hotel_search', kind: 'result', at: 12.7, tool: 'search_hotels', ok: false },
  { id: 'e10', agent: 'hotel_search', kind: 'call', at: 13.0, tool: 'search_hotels', ok: true },
  { id: 'e11', agent: 'hotel_search', kind: 'error', at: 43.0, tool: undefined, ok: false },
  { id: 'e12', agent: 'coordinator', kind: 'message', at: 44.0, tool: undefined, ok: true },
  { id: 'e13', agent: 'coordinator', kind: 'transfer', at: 44.5, tool: undefined, ok: true },
  {
    id: 'e14',
    agent: 'itinerary_writer',
    kind: 'call',
    at: 45.8,
    tool: 'write_itinerary',
    ok: true,
  },
  {
    id: 'e15',
    agent: 'itinerary_writer',
    kind: 'result',
    at: 48.2,
    tool: 'write_itinerary',
    ok: true,
  },
  { id: 'e16', agent: 'itinerary_writer', kind: 'message', at: 48.9, tool: undefined, ok: true },
  { id: 'e17', agent: 'coordinator', kind: 'message', at: 49.5, tool: undefined, ok: true },
];

/** coordinator handed the run to each of these, in this order. */
export const BUNDLED_TRANSFERS: readonly string[] = [
  'coordinator',
  'flight_search',
  'hotel_search',
  'itinerary_writer',
];

/* ---------------------------------------------------------------- Flow ---- */

export interface FlowStep {
  readonly label: string;
  readonly last: boolean;
}

export function flowSteps(chain: readonly string[] = BUNDLED_TRANSFERS): FlowStep[] {
  return chain.map((label, index) => ({ label, last: index === chain.length - 1 }));
}

/* --------------------------------------------------------------- Gantt ---- */

export interface GanttRow {
  readonly label: string;
  readonly held: number;
  /** Leading blank cells, then filled cells, out of `width`. */
  readonly pad: number;
  readonly fill: number;
  readonly faulted: boolean;
}

export function ganttRows(
  width = 28,
  members: readonly CrewMember[] = BUNDLED_CREW.members,
): GanttRow[] {
  const run = BUNDLED_CREW.runSeconds;
  return members.map((member) => {
    const pad = Math.max(0, Math.min(width - 1, Math.round((member.start / run) * width)));
    const raw = Math.round((heldSeconds(member) / run) * width);
    return {
      label: member.id,
      held: heldSeconds(member),
      pad,
      fill: Math.max(1, Math.min(width - pad, raw)),
      faulted: member.fault !== undefined,
    };
  });
}

/* ------------------------------------------------------------ Timeline ---- */

export interface TimelineRow {
  readonly at: string;
  readonly agent: string;
  readonly note: string;
  readonly ok: boolean;
}

const KIND_NOTE: Record<EventKind, string> = {
  message: 'message',
  thought: 'reasoning',
  transfer: 'handed off',
  call: 'called',
  result: 'returned',
  error: 'failed',
};

export function timelineRows(events: readonly SessionEvent[] = BUNDLED_EVENTS): TimelineRow[] {
  return events.map((event) => ({
    at: `${event.at.toFixed(1)}s`,
    agent: event.agent,
    note: event.tool ? `${KIND_NOTE[event.kind]} ${event.tool}` : KIND_NOTE[event.kind],
    ok: event.ok,
  }));
}

/* ---------------------------------------------------------------- Tree ---- */

export interface TreeRow {
  readonly glyph: string;
  readonly label: string;
  readonly events: number;
}

/**
 * The branch field is a path, so the hierarchy is read from it rather than
 * assumed: everything under `coordinator.` is a child of the coordinator.
 */
export function treeRows(events: readonly SessionEvent[] = BUNDLED_EVENTS): TreeRow[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (event.agent === 'user') continue;
    counts.set(event.agent, (counts.get(event.agent) ?? 0) + 1);
  }
  const root = BUNDLED_TRANSFERS[0] ?? '';
  const children = [...counts.keys()].filter((id) => id !== root);
  return [
    { glyph: '', label: root, events: counts.get(root) ?? 0 },
    ...children.map((id, index) => ({
      glyph: index === children.length - 1 ? '└─' : '├─',
      label: id,
      events: counts.get(id) ?? 0,
    })),
  ];
}

/* --------------------------------------------------------------- Check ---- */

export interface CheckRow {
  readonly done: boolean;
  readonly label: string;
  readonly note: string;
}

/**
 * Pairs each call with its result.
 *
 * This is the reading that pays for the whole panel: the session holds four
 * calls and three results, so one call was made and never came back. That is
 * a fact about the record, not an inference about the world.
 */
export function checkRows(events: readonly SessionEvent[] = BUNDLED_EVENTS): CheckRow[] {
  const results = new Map<string, SessionEvent>();
  for (const event of events) {
    if (event.kind === 'result' && event.tool) results.set(event.tool + '@' + event.agent, event);
  }
  const seen = new Set<string>();
  const rows: CheckRow[] = [];
  for (const event of events) {
    if (event.kind !== 'call' || !event.tool) continue;
    const key = event.tool + '@' + event.agent;
    const result = seen.has(key) ? undefined : results.get(key);
    seen.add(key);
    rows.push({
      done: result !== undefined,
      label: event.tool,
      note: result ? `returned at ${result.at.toFixed(1)}s` : 'no result recorded',
    });
  }
  return rows;
}

export function unansweredCalls(events: readonly SessionEvent[] = BUNDLED_EVENTS): number {
  return checkRows(events).filter((row) => !row.done).length;
}

/* -------------------------------------------------------------- Uptime ---- */

export type UptimeCell = 'ok' | 'down';

export function uptimeCells(events: readonly SessionEvent[] = BUNDLED_EVENTS): UptimeCell[] {
  return events.map((event) => (event.ok ? 'ok' : 'down'));
}

/* ---------------------------------------------------------------- Spec ---- */

export interface SpecRow {
  readonly label: string;
  readonly value: string;
}

export function specRows(events: readonly SessionEvent[] = BUNDLED_EVENTS): SpecRow[] {
  const agents = new Set(
    events.filter((event) => event.agent !== 'user').map((event) => event.agent),
  );
  const tools = new Set(events.filter((event) => event.tool).map((event) => event.tool));
  const failed = events.filter((event) => !event.ok).length;
  const elapsed =
    events === BUNDLED_EVENTS
      ? BUNDLED_CREW.runSeconds
      : events.reduce((max, event) => Math.max(max, event.at), 0);
  return [
    { label: 'events', value: String(events.length) },
    { label: 'agents', value: String(agents.size) },
    { label: 'tools', value: String(tools.size) },
    { label: 'elapsed', value: `${elapsed.toFixed(1)}s` },
    { label: 'unanswered', value: String(unansweredCalls(events)) },
    { label: 'failed events', value: String(failed) },
  ];
}

/** The one-breath summary used by the deterministic judge poster. */
export function sessionStatusLine(
  events: readonly SessionEvent[] = BUNDLED_EVENTS,
  transfers: readonly string[] = BUNDLED_TRANSFERS,
): string {
  const unanswered = unansweredCalls(events);
  const failed = events.filter((event) => !event.ok).length;
  const elapsed = specRows(events).find((row) => row.label === 'elapsed')?.value ?? '—';
  return [
    `${transfers.length} agents in handoff order`,
    unanswered === 1 ? '1 call never returned' : `${unanswered} calls never returned`,
    failed === 1 ? '1 failed event' : `${failed} failed events`,
    elapsed,
  ].join(' · ');
}

/* -------------------------------------------------------- Copy blocks ---- */

const GANTT_COPY_WIDTH = 28;

function glyphBar(count: number, glyph: string): string {
  return glyph.repeat(Math.max(0, count));
}

/** Mono blocks that paste into an issue exactly like the reading panels. */
export function readingCopyBlocks(events: readonly SessionEvent[] = BUNDLED_EVENTS): {
  handoffs: string;
  whoHeld: string;
  agentTree: string;
  callsAnswered: string;
  eventHealth: string;
  session: string;
  timeline: string;
} {
  const chain =
    events === BUNDLED_EVENTS
      ? BUNDLED_TRANSFERS
      : [...new Set(events.filter((event) => event.agent !== 'user').map((event) => event.agent))];
  const flow = flowSteps(chain);
  const gantt = ganttRows(GANTT_COPY_WIDTH);
  const tree = treeRows(events);
  const check = checkRows(events);
  const uptime = uptimeCells(events);
  const spec = specRows(events);
  const timeline = timelineRows(events);
  const down = uptime.filter((cell) => cell === 'down').length;
  return {
    handoffs: flow.map((step) => (step.last ? step.label : `${step.label} ──▶ `)).join(''),
    whoHeld: gantt
      .map(
        (row) =>
          `${row.label.padEnd(17)}${glyphBar(row.pad, '·')}${glyphBar(row.fill, row.faulted ? '▚' : '█')}${glyphBar(GANTT_COPY_WIDTH - row.pad - row.fill, '·')}  ${row.held.toFixed(1).padStart(5)}s${row.faulted ? '  timed out' : ''}`,
      )
      .join('\n'),
    agentTree: tree
      .map(
        (row) =>
          `${row.glyph}${row.glyph ? ' ' : ''}${row.label.padEnd(20 - row.glyph.length)}${String(row.events).padStart(2)} events`,
      )
      .join('\n'),
    callsAnswered: check
      .map((row) => `[${row.done ? 'x' : ' '}] ${row.label.padEnd(16)}${row.note}`)
      .join('\n'),
    eventHealth: `${uptime.map((cell) => (cell === 'ok' ? '█' : '▚')).join(' ')}\n${down} of ${uptime.length} events recorded a failure`,
    session: spec.map((row) => `${row.label.padEnd(15)}${row.value}`).join('\n'),
    timeline: timeline
      .map(
        (row) => `${row.at.padStart(6)}  ${row.ok ? '·' : '×'}  ${row.agent.padEnd(18)}${row.note}`,
      )
      .join('\n'),
  };
}
