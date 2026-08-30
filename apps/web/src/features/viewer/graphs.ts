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
  return [
    { label: 'events', value: String(events.length) },
    { label: 'agents', value: String(agents.size) },
    { label: 'tools', value: String(tools.size) },
    { label: 'elapsed', value: `${BUNDLED_CREW.runSeconds.toFixed(1)}s` },
    { label: 'unanswered', value: String(unansweredCalls(events)) },
    { label: 'failed events', value: String(failed) },
  ];
}
