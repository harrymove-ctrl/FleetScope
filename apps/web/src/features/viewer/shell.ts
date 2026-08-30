/**
 * The Agent Viewer shell's data contract and its pure presentation logic.
 *
 * # The boundary
 *
 * Rust owns what a session MEANS. This module owns how one row looks. It never
 * computes agent status, event identity, renderer indexes, the event-to-entry
 * offset, timeline folding or projection state: all of those arrive from the
 * WASM ABI already decided, and re-deriving any of them in TypeScript would
 * create a second answer that drifts from the first.
 *
 * What lives here is arrangement — tree depth from a parent pointer, a label
 * for a transport value, which fields an inspector shows — and it lives in a
 * separate module from the page so it can be tested without a browser or a
 * wasm build.
 */

/** Mirrors `agent_viewer_snapshot()`. */
export interface Snapshot {
  readonly entryIndex: number;
  readonly entryCount: number;
  readonly atEdge: boolean;
  readonly transport: 'idle' | 'playing' | 'paused' | 'history' | 'live';
  /**
   * The viewer event the playhead rests on. `null` is a real answer: the
   * playhead may be sitting on a sub-agent sidecar, which is renderer state
   * that came from no event.
   */
  readonly sequence: number | null;
  /**
   * The renderer's own selection. Always present, explicitly `null` when
   * nothing is selected, so an absent field cannot be read as "not selected".
   */
  readonly selectedAgentId: string | null;
}

/** Mirrors `EventSummary` in `agent-viewer-core`. */
export interface EventSummary {
  readonly sequence: number;
  readonly agentId: string;
  readonly timestamp: string;
  readonly kind: string;
  readonly label: string;
  readonly isError: boolean;
  readonly callId: string | null;
}

/** Mirrors `agent_viewer_events(offset, limit)`. */
export interface EventWindow {
  readonly items: readonly EventSummary[];
  readonly totalCount: number;
  readonly offset: number;
  readonly hasMore: boolean;
}

/** Mirrors `AgentSummary` in `agent-viewer-core`. */
export interface AgentSummary {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  readonly parentId: string | null;
  readonly eventCount: number;
  readonly errorCount: number;
  /** `null` means the session never said. Never render that as success. */
  readonly terminal: 'completed' | 'failed' | null;
}

export type Tone = 'ok' | 'warn' | 'bad' | 'info';

export interface AgentRow extends AgentSummary {
  /** Indentation depth, derived from the parent chain the ABI reported. */
  readonly depth: number;
  readonly statusLabel: string;
  readonly statusTone: Tone;
}

/**
 * Order agents parents-first and give each its depth.
 *
 * Depth comes from walking the reported `parentId` chain, not from counting
 * separators in an id: the id format is an adapter's business and a different
 * provider may not use paths at all.
 */
export function agentRows(agents: readonly AgentSummary[]): AgentRow[] {
  const byParent = new Map<string | null, AgentSummary[]>();
  for (const agent of agents) {
    const key = agent.parentId ?? null;
    const bucket = byParent.get(key);
    if (bucket === undefined) byParent.set(key, [agent]);
    else bucket.push(agent);
  }

  const rows: AgentRow[] = [];
  const seen = new Set<string>();
  const walk = (parentId: string | null, depth: number): void => {
    for (const agent of byParent.get(parentId) ?? []) {
      // A malformed tree must not hang the page, so a cycle stops here rather
      // than recursing forever.
      if (seen.has(agent.id)) continue;
      seen.add(agent.id);
      rows.push({ ...agent, depth, ...agentStatus(agent) });
      walk(agent.id, depth + 1);
    }
  };
  walk(null, 0);

  // An agent whose parent was never reported is still real work. Show it at the
  // root rather than dropping it.
  for (const agent of agents) {
    if (!seen.has(agent.id)) {
      seen.add(agent.id);
      rows.push({ ...agent, depth: 0, ...agentStatus(agent) });
    }
  }
  return rows;
}

function agentStatus(agent: AgentSummary): { statusLabel: string; statusTone: Tone } {
  if (agent.terminal === 'failed') return { statusLabel: 'failed', statusTone: 'bad' };
  if (agent.terminal === 'completed') return { statusLabel: 'completed', statusTone: 'ok' };
  // Silence stays silence. "no terminal event" is the honest reading of an
  // agent the session never reported on, and it must not read as success.
  return { statusLabel: 'no terminal event', statusTone: 'info' };
}

export interface TransportBadge {
  readonly label: string;
  readonly tone: Tone;
  /** A glyph so status is never carried by colour alone. */
  readonly glyph: string;
}

/**
 * Describe the playhead.
 *
 * The renderer's `live` transport means "at the live edge of the data that was
 * loaded", NOT that an agent is executing. The browser reads finished files and
 * never tails anything, so this deliberately never renders the word "Live":
 * claiming live execution for a recording is the exact dishonesty the product
 * forbids. `atEdge` is reported as "at latest event" instead.
 */
export function transportBadge(snapshot: Snapshot): TransportBadge {
  switch (snapshot.transport) {
    case 'playing':
      return { label: 'Replaying', tone: 'info', glyph: '▶' };
    case 'paused':
      return { label: 'Paused', tone: 'warn', glyph: '❚❚' };
    case 'history':
      return { label: 'History', tone: 'info', glyph: '◀' };
    case 'live':
    case 'idle':
    default:
      return snapshot.atEdge
        ? { label: 'At latest event', tone: 'ok', glyph: '●' }
        : { label: 'Recorded', tone: 'info', glyph: '·' };
  }
}

/** Position readout. Says "no event here" for a sidecar rather than guessing. */
export function positionLabel(snapshot: Snapshot): string {
  if (snapshot.entryCount === 0) return 'no session';
  if (snapshot.sequence === null) {
    return `renderer item ${snapshot.entryIndex + 1} of ${snapshot.entryCount} · no event here`;
  }
  return `event ${snapshot.sequence} · renderer item ${snapshot.entryIndex + 1} of ${snapshot.entryCount}`;
}

export interface InspectorField {
  readonly label: string;
  readonly value: string;
  readonly tone?: Tone;
}

/** Mirrors `agent_viewer_event_detail(sequence)`. */
export interface EventDetail {
  readonly sequence: number;
  readonly agentId: string;
  readonly agentLabel: string | null;
  readonly type: string;
  readonly timestamp: string;
  readonly status: 'ok' | 'error';
  readonly tool: string | null;
  readonly summary: string;
  readonly callId: string | null;
  readonly source: string;
  readonly rendererEntryIndices: readonly number[];
}

/**
 * The renderer's answer to a selection request.
 *
 * `unknown` is a real answer, not an error: the graph has no node with that id,
 * so nothing was selected and nothing was cleared. A shell that treated the id
 * it asked for as the new selection would show a selection the graph never had.
 */
export interface SelectionAnswer {
  readonly outcome: 'selected' | 'deselected' | 'unknown';
  readonly selectedAgentId: string | null;
}

/** One node the renderer actually has, from `agent_viewer_graph_nodes()`. */
export interface GraphNode {
  readonly id: string;
  readonly selected: boolean;
}

/**
 * The ids a DOM control may stand for.
 *
 * Membership decides whether a rail row is presented as a graph-node control.
 * It is renderer-owned: nothing here infers which agents have nodes.
 */
export function graphNodeIds(nodes: readonly GraphNode[]): ReadonlySet<string> {
  return new Set(nodes.map((node) => node.id));
}

/** What the renderer pushes after an input that moved the selection. */
export interface SelectionSignal {
  readonly selectedAgentId: string | null;
  /** `null` when the renderer is pointing at an item that came from no event. */
  readonly sequence: number | null;
  readonly rendererEntryIndex: number;
}

/**
 * Shown when the renderer's selection lands on an item with no viewer event.
 *
 * A sub-agent sidecar is real renderer state that no event produced. Choosing
 * the nearest event instead would put real content under a wrong heading,
 * which is worse than admitting there is nothing to show.
 */
export const NO_EVENT_MESSAGE = 'Renderer selection has no matching viewer event.';

/**
 * The fields an inspector shows for one event.
 *
 * Every value came from the ABI's detail response, which came from the event,
 * which came through an adapter that drops model reasoning at ingestion. This
 * function introduces no new source of content, so there is no path by which
 * chain-of-thought or a credential appears here.
 */
export function inspectorFields(detail: EventDetail): InspectorField[] {
  const fields: InspectorField[] = [
    { label: 'Sequence', value: String(detail.sequence) },
    { label: 'Agent', value: detail.agentLabel ?? detail.agentId },
    { label: 'Event type', value: detail.type },
    { label: 'Timestamp', value: detail.timestamp },
    {
      label: 'Status',
      value: detail.status,
      tone: detail.status === 'error' ? 'bad' : 'ok',
    },
  ];

  if (detail.tool !== null) fields.push({ label: 'Tool', value: detail.tool });
  // The correlation between a call and the result that answered it.
  if (detail.callId !== null) fields.push({ label: 'Call id', value: detail.callId });

  fields.push({
    label: detail.type === 'tool_result' ? 'Result' : 'Detail',
    value: detail.summary,
    tone: detail.status === 'error' ? 'bad' : undefined,
  });

  fields.push({ label: 'Agent path', value: detail.agentId });
  // Provenance the session actually supports: this reached the viewer as a
  // local file, and nothing was fetched.
  fields.push({ label: 'Source', value: detail.source });
  fields.push({
    label: 'Renderer items',
    value:
      detail.rendererEntryIndices.length === 0 ? 'none' : detail.rendererEntryIndices.join(', '),
  });
  return fields;
}

/**
 * The note to show instead of an event that belongs to a different agent.
 *
 * Selecting an agent does not move the playhead, so the inspector can be left
 * holding the previously selected event. Rendering it under a heading naming
 * another agent reads as "this is what hotel_search did" when it is not. `null`
 * means the event on show does belong to the selection and may be rendered.
 */
export function foreignEventNote(
  selectedAgentId: string | null,
  detailAgentId: string,
  detailAgentLabel: string | null,
): string | null {
  if (selectedAgentId === null || detailAgentId === selectedAgentId) return null;
  const owner = detailAgentLabel ?? detailAgentId;
  return `The event on show belongs to ${owner}. Choose one of the selected agent's events below.`;
}

/** Events belonging to one agent, for the rail's selection to filter by. */
export function eventsForAgent(
  events: readonly EventSummary[],
  agentId: string | null,
): readonly EventSummary[] {
  if (agentId === null) return events;
  return events.filter((event) => event.agentId === agentId);
}
