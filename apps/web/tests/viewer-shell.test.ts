import { describe, expect, it } from 'vitest';
import {
  agentRows,
  eventsForAgent,
  foreignEventNote,
  graphNodeIds,
  inspectorFields,
  latestEventForAgent,
  positionLabel,
  transportBadge,
  NO_EVENT_MESSAGE,
  type AgentSummary,
  type EventDetail,
  type EventSummary,
  type GraphNode,
  type Snapshot,
} from '../src/features/viewer/shell';
import {
  JUMP_TO_AGENT_LATEST_LABEL,
  isViewSidecar,
  needsPlayToggle,
  parseViewState,
  pickFollowedTranscript,
  playheadIsPastLocalEvents,
  serializeViewState,
  shouldApplyRemoteView,
} from '../src/features/viewer/follow';
import { workflowLanes } from '../src/features/viewer/workflows';

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

describe('the workflow board', () => {
  it('keeps parent-first lanes and uses recorded counts', () => {
    const lanes = workflowLanes(agents, [
      {
        sequence: 0,
        agentId: 'coordinator',
        timestamp: '2026-08-28T09:00:00.000Z',
        kind: 'prompt',
        label: 'Plan the work',
        isError: false,
        callId: null,
      },
      {
        sequence: 1,
        agentId: 'coordinator/hotel_search',
        timestamp: '2026-08-28T09:00:01.000Z',
        kind: 'tool_call',
        label: 'search_hotels',
        isError: false,
        callId: 'call-1',
      },
      {
        sequence: 2,
        agentId: 'coordinator/hotel_search',
        timestamp: '2026-08-28T09:00:02.000Z',
        kind: 'tool_result',
        label: 'search_hotels error',
        isError: true,
        callId: 'call-1',
      },
    ]);

    expect(lanes.map((lane) => lane.id)).toEqual([
      'coordinator',
      'coordinator/hotel_search',
      'coordinator/quiet',
    ]);
    expect(lanes[0]?.role).toBe('orchestrator');
    expect(lanes[1]?.parentLabel).toBe('coordinator');
    expect(lanes[1]?.toolCount).toBe(2);
    expect(lanes[1]?.statusLabel).toBe('failed');
    expect(lanes[2]?.statusLabel).toBe('no terminal event');
  });

  it('does not invent activity for an agent without events', () => {
    const lanes = workflowLanes(agents, []);
    expect(lanes.find((lane) => lane.id === 'coordinator/quiet')?.activity).toEqual([]);
    expect(lanes.find((lane) => lane.id === 'coordinator/quiet')?.lastEvent).toBeNull();
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

  it('keeps the jump label for the selected agent’s latest event', () => {
    expect(JUMP_TO_AGENT_LATEST_LABEL).toBe('Jump to this agent’s latest event');
  });

  it('finds the selected agent’s latest event by sequence, not array order', () => {
    const events: EventSummary[] = [
      {
        sequence: 4,
        agentId: 'coordinator/hotel_search',
        timestamp: 't',
        kind: 'message',
        label: 'later-first',
        isError: false,
        callId: null,
      },
      {
        sequence: 1,
        agentId: 'coordinator',
        timestamp: 't',
        kind: 'message',
        label: 'parent',
        isError: false,
        callId: null,
      },
      {
        sequence: 9,
        agentId: 'coordinator/hotel_search',
        timestamp: 't',
        kind: 'tool_result',
        label: 'latest',
        isError: true,
        callId: 'c',
      },
    ];
    expect(latestEventForAgent(events, 'coordinator/hotel_search')?.sequence).toBe(9);
    expect(latestEventForAgent(events, 'coordinator')?.sequence).toBe(1);
    expect(latestEventForAgent(events, 'missing')).toBeNull();
    expect(latestEventForAgent(events, null)).toBeNull();
  });
});

describe('follow-folder pairing', () => {
  it('prefers session.jsonl over a larger sibling transcript', () => {
    const picked = pickFollowedTranscript([
      { name: 'trace.jsonl', path: 'trace.jsonl', size: 9000 },
      { name: 'session.jsonl', path: 'session.jsonl', size: 100 },
    ]);
    expect(picked?.name).toBe('session.jsonl');
  });

  it('picks the shallowest then largest jsonl when session.jsonl is absent', () => {
    const picked = pickFollowedTranscript([
      { name: 'deep.jsonl', path: 'nested/deep.jsonl', size: 8000 },
      { name: 'small.jsonl', path: 'small.jsonl', size: 10 },
      { name: 'big.jsonl', path: 'big.jsonl', size: 50 },
    ]);
    expect(picked?.name).toBe('big.jsonl');
  });

  it('never treats view.json as a transcript', () => {
    expect(isViewSidecar('view.json')).toBe(true);
    expect(isViewSidecar('run/view.json')).toBe(true);
    expect(
      pickFollowedTranscript([{ name: 'view.json', path: 'view.json', size: 999 }]),
    ).toBeNull();
  });

  it('parses a TUI sidecar and ignores corrupt bytes', () => {
    const parsed = parseViewState(
      JSON.stringify({
        v: 1,
        playhead: 71,
        paused: true,
        selectedAgent: 'ux_designer',
        camera: 'manual',
        updatedAt: 1756571844375,
        writer: 'tui',
      }),
    );
    expect(parsed).toEqual({
      v: 1,
      playhead: 71,
      paused: true,
      selectedAgent: 'ux_designer',
      camera: 'manual',
      updatedAt: 1756571844375,
      writer: 'tui',
    });
    expect(parseViewState('{')).toBeNull();
    expect(
      parseViewState(
        '{"v":2,"playhead":1,"paused":false,"camera":"manual","updatedAt":1,"writer":"tui"}',
      ),
    ).toBeNull();
  });

  it('applies only a newer non-web write', () => {
    const tui = parseViewState(
      '{"v":1,"playhead":3,"paused":false,"selectedAgent":null,"camera":"follow","updatedAt":20,"writer":"tui"}',
    )!;
    expect(shouldApplyRemoteView(tui, 10)).toBe(true);
    expect(shouldApplyRemoteView(tui, 20)).toBe(false);
    const web = parseViewState(
      serializeViewState({
        playhead: 3,
        paused: true,
        selectedAgent: 'lead',
        camera: 'manual',
        updatedAt: 99,
      }),
    )!;
    expect(web.writer).toBe('web');
    expect(shouldApplyRemoteView(web, 0)).toBe(false);
  });

  it('toggles play only when the snapshot disagrees with paused', () => {
    expect(needsPlayToggle('playing', true)).toBe(true);
    expect(needsPlayToggle('live', true)).toBe(true);
    expect(needsPlayToggle('paused', true)).toBe(false);
    expect(needsPlayToggle('history', false)).toBe(true);
    expect(needsPlayToggle('playing', false)).toBe(false);
    expect(needsPlayToggle('idle', false)).toBe(false);
  });

  it('treats a playhead past the loaded sequences as the live edge', () => {
    expect(playheadIsPastLocalEvents(71, [0, 1, 70])).toBe(true);
    expect(playheadIsPastLocalEvents(70, [0, 1, 70])).toBe(false);
    expect(playheadIsPastLocalEvents(0, [])).toBe(true);
  });
});
