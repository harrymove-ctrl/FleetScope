import { describe, expect, it } from 'vitest';
import {
  agentRows,
  eventsForAgent,
  foreignEventNote,
  graphNodeIds,
  inspectorFields,
  positionLabel,
  transportBadge,
  NO_EVENT_MESSAGE,
  type AgentSummary,
  type EventDetail,
  type EventSummary,
  type GraphNode,
  type Snapshot,
} from '../src/features/viewer/shell';

/**
 * The shell renders what the ABI decided. These tests cover the arrangement it
 * is allowed to do on its own — tree depth, a transport label, which fields an
 * inspector shows — and pin the two things it must never do: invent a status,
 * or claim live execution for a recording.
 */

const agents: AgentSummary[] = [
  {
    id: 'coordinator',
    label: 'coordinator',
    kind: 'agent',
    parentId: null,
    eventCount: 8,
    errorCount: 0,
    terminal: 'completed',
  },
  {
    id: 'coordinator/hotel_search',
    label: 'hotel_search',
    kind: 'agent',
    parentId: 'coordinator',
    eventCount: 4,
    errorCount: 2,
    terminal: 'failed',
  },
  {
    id: 'coordinator/quiet',
    label: 'quiet',
    kind: 'agent',
    parentId: 'coordinator',
    eventCount: 1,
    errorCount: 0,
    terminal: null,
  },
];

const snapshot = (over: Partial<Snapshot> = {}): Snapshot => ({
  entryIndex: 11,
  entryCount: 23,
  atEdge: false,
  transport: 'history',
  sequence: 9,
  ...over,
});

describe('the agent rail', () => {
  it('orders parents before children and derives depth from the parent chain', () => {
    // Depth comes from `parentId`, not from counting separators in an id: the
    // id format belongs to an adapter and another provider may not use paths.
    const rows = agentRows(agents);
    expect(rows.map((row) => [row.label, row.depth])).toEqual([
      ['coordinator', 0],
      ['hotel_search', 1],
      ['quiet', 1],
    ]);
  });

  it('never renders an unreported agent as successful', () => {
    const quiet = agentRows(agents).find((row) => row.label === 'quiet');
    expect(quiet?.statusLabel).toBe('no terminal event');
    expect(quiet?.statusTone).not.toBe('ok');
  });

  it('carries a word for every status, not only a tone', () => {
    for (const row of agentRows(agents)) {
      expect(row.statusLabel).not.toBe('');
    }
  });

  it('keeps an agent whose parent was never reported', () => {
    // Orphaned metadata is still real work. Dropping it would hide activity,
    // which is the failure this whole layer exists to prevent.
    const orphan: AgentSummary = { ...agents[1], id: 'lost', parentId: 'nobody' };
    const rows = agentRows([agents[0], orphan]);
    expect(rows.map((row) => row.id)).toContain('lost');
  });

  it('does not loop on a cyclic tree', () => {
    const a: AgentSummary = { ...agents[0], id: 'a', parentId: 'b' };
    const b: AgentSummary = { ...agents[0], id: 'b', parentId: 'a' };
    expect(
      agentRows([a, b])
        .map((row) => row.id)
        .sort(),
    ).toEqual(['a', 'b']);
  });
});

describe('the transport badge', () => {
  it('never says "live" for a recording', () => {
    // The renderer's `live` transport means "at the live edge of the loaded
    // data", not that an agent is executing. The browser reads finished files
    // and tails nothing, so claiming live execution would be a lie.
    for (const transport of ['live', 'idle'] as const) {
      const badge = transportBadge(snapshot({ transport, atEdge: true }));
      expect(badge.label.toLowerCase()).not.toContain('live');
      expect(badge.label).toBe('At latest event');
    }
  });

  it('distinguishes replaying, paused and history', () => {
    expect(transportBadge(snapshot({ transport: 'playing' })).label).toBe('Replaying');
    expect(transportBadge(snapshot({ transport: 'paused' })).label).toBe('Paused');
    expect(transportBadge(snapshot({ transport: 'history' })).label).toBe('History');
  });

  it('gives every badge a glyph so status is not colour alone', () => {
    for (const transport of ['playing', 'paused', 'history', 'live', 'idle'] as const) {
      expect(transportBadge(snapshot({ transport })).glyph).not.toBe('');
    }
  });
});

describe('the position readout', () => {
  it('names the event when the playhead rests on one', () => {
    expect(positionLabel(snapshot())).toBe('event 9 · renderer item 12 of 23');
  });

  it('says there is no event when the playhead rests on a sidecar', () => {
    // A renderer item can come from no viewer event. Showing the nearest one
    // would put real content under a wrong heading.
    expect(positionLabel(snapshot({ sequence: null, entryIndex: 3 }))).toBe(
      'renderer item 4 of 23 · no event here',
    );
  });

  it('handles an empty session', () => {
    expect(positionLabel(snapshot({ entryCount: 0 }))).toBe('no session');
  });
});

describe('the inspector', () => {
  const detail: EventDetail = {
    sequence: 9,
    agentId: 'coordinator/hotel_search',
    agentLabel: 'hotel_search',
    type: 'tool_result',
    timestamp: '2026-08-28T09:00:12.700Z',
    status: 'error',
    tool: 'search_hotels',
    summary: 'search_hotels error=upstream rate limit',
    callId: 'fc-hotels-1',
    source: 'local-session-file',
    rendererEntryIndices: [11],
  };

  it('shows identity, timing, tool correlation and content', () => {
    const labels = inspectorFields(detail).map((field) => field.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        'Sequence',
        'Agent',
        'Event type',
        'Timestamp',
        'Status',
        'Tool',
        'Call id',
        'Result',
        'Source',
      ]),
    );
  });

  it('states an error in words and marks its tone', () => {
    const status = inspectorFields(detail).find((field) => field.label === 'Status');
    expect(status?.value).toBe('error');
    expect(status?.tone).toBe('bad');
  });

  it('prefers the agent label but falls back to the id', () => {
    expect(inspectorFields(detail).find((f) => f.label === 'Agent')?.value).toBe('hotel_search');
    expect(
      inspectorFields({ ...detail, agentLabel: null }).find((f) => f.label === 'Agent')?.value,
    ).toBe('coordinator/hotel_search');
  });

  it('reports the renderer items an event produced, not an arithmetic guess', () => {
    // Event 9 sits at renderer item 11. Nothing here derives that; the manifest
    // reported it and this only renders what it said.
    expect(inspectorFields(detail).find((f) => f.label === 'Renderer items')?.value).toBe('11');
    expect(
      inspectorFields({ ...detail, rendererEntryIndices: [] }).find(
        (f) => f.label === 'Renderer items',
      )?.value,
    ).toBe('none');
    // A future event folded into several entries needs no schema change.
    expect(
      inspectorFields({ ...detail, rendererEntryIndices: [4, 5] }).find(
        (f) => f.label === 'Renderer items',
      )?.value,
    ).toBe('4, 5');
  });

  it('omits tool and call correlation when the event has none', () => {
    const plain = { ...detail, tool: null, callId: null, type: 'message', status: 'ok' as const };
    const labels = inspectorFields(plain).map((field) => field.label);
    expect(labels).not.toContain('Tool');
    expect(labels).not.toContain('Call id');
  });

  it('adds no content of its own', () => {
    // Every value shown is one the detail already carried. The inspector
    // introduces no new source, so it cannot leak reasoning or a secret.
    const carried = new Set<string>([
      String(detail.sequence),
      detail.agentId,
      detail.agentLabel ?? '',
      detail.type,
      detail.timestamp,
      detail.status,
      detail.tool ?? '',
      detail.summary,
      detail.callId ?? '',
      detail.source,
      '11',
    ]);
    for (const field of inspectorFields(detail)) {
      expect(carried.has(field.value), `${field.label} introduced "${field.value}"`).toBe(true);
    }
  });
});

describe('a selection with no viewer event', () => {
  it('has a message that refuses to guess', () => {
    // The sidecar case. It must not resolve to the nearest event.
    expect(NO_EVENT_MESSAGE).toContain('no matching viewer event');
  });
});

describe('agent filtering', () => {
  const events: EventSummary[] = [
    {
      ...({} as EventSummary),
      sequence: 1,
      agentId: 'coordinator',
      kind: 'message',
      label: 'a',
      isError: false,
      callId: null,
      timestamp: 't',
    },
    {
      ...({} as EventSummary),
      sequence: 2,
      agentId: 'coordinator/hotel_search',
      kind: 'message',
      label: 'b',
      isError: false,
      callId: null,
      timestamp: 't',
    },
  ];

  it('returns everything when no agent is selected', () => {
    expect(eventsForAgent(events, null)).toHaveLength(2);
  });

  it('filters by the agent the ABI reported, not by a path prefix', () => {
    expect(eventsForAgent(events, 'coordinator').map((e) => e.sequence)).toEqual([1]);
  });
});

describe('graph node identity', () => {
  const nodes: GraphNode[] = [
    { id: 'coordinator', selected: false },
    { id: 'coordinator/hotel_search', selected: true },
  ];

  it('takes the selectable ids from the renderer rather than from the agent list', () => {
    const ids = graphNodeIds(nodes);
    expect(ids.has('coordinator/hotel_search')).toBe(true);
    // An agent the session knows about but the graph has no node for must not
    // be presented as a graph-node control.
    expect(ids.has('coordinator/flight_search')).toBe(false);
  });

  it('reports an empty set rather than guessing when the renderer has no nodes', () => {
    expect(graphNodeIds([]).size).toBe(0);
  });
});

describe("the inspector never shows one agent's event under another's selection", () => {
  it('names the real owner when the event belongs to a different agent', () => {
    const note = foreignEventNote('coordinator/hotel_search', 'coordinator', 'coordinator');
    expect(note).not.toBeNull();
    expect(note).toContain('coordinator');
  });

  it('says nothing when the event belongs to the selected agent', () => {
    expect(
      foreignEventNote('coordinator/hotel_search', 'coordinator/hotel_search', 'hotel_search'),
    ).toBeNull();
  });

  it('says nothing when no agent is selected', () => {
    // With no agent selected the inspector is showing whatever the playhead
    // rests on, which is not a claim about any agent.
    expect(foreignEventNote(null, 'coordinator', 'coordinator')).toBeNull();
  });

  it('falls back to the agent id when the session gave no label', () => {
    expect(foreignEventNote('coordinator/hotel_search', 'coordinator', null)).toContain(
      'coordinator',
    );
  });
});
