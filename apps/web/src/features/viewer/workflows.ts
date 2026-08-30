import { agentRows, type AgentSummary, type EventSummary, type Tone } from './shell';

/**
 * A compact, read-only lane for the workflow board.
 *
 * The board is deliberately derived from the same ABI summaries as the rail.
 * It is a second view of the session, not a second projection: counts and
 * terminal state are facts from the loaded recording, while the small activity
 * bars are only a visual encoding of recorded event kinds.
 */
export interface WorkflowLane {
  readonly id: string;
  readonly label: string;
  readonly parentLabel: string | null;
  readonly role: 'orchestrator' | 'task';
  readonly kind: string;
  readonly eventCount: number;
  readonly toolCount: number;
  readonly errorCount: number;
  readonly terminal: AgentSummary['terminal'];
  readonly statusLabel: string;
  readonly statusTone: Tone;
  readonly lastEvent: string | null;
  readonly activity: readonly ('message' | 'tool' | 'error' | 'status')[];
}

const activityKind = (event: EventSummary): 'message' | 'tool' | 'error' | 'status' => {
  if (event.isError) return 'error';
  if (event.kind.startsWith('tool')) return 'tool';
  if (event.kind === 'status') return 'status';
  return 'message';
};

/** Stable parent-first lanes, preserving the provider's labels and status words. */
export function workflowLanes(
  agents: readonly AgentSummary[],
  events: readonly EventSummary[],
): WorkflowLane[] {
  const rows = agentRows(agents);
  const labels = new Map(agents.map((agent) => [agent.id, agent.label]));
  const byAgent = new Map<string, EventSummary[]>();
  for (const event of events) {
    const list = byAgent.get(event.agentId);
    if (list === undefined) byAgent.set(event.agentId, [event]);
    else list.push(event);
  }

  return rows.map((row) => {
    const ownEvents = byAgent.get(row.id) ?? [];
    const activity = ownEvents.map(activityKind);
    return {
      id: row.id,
      label: row.label,
      parentLabel: row.parentId === null ? null : (labels.get(row.parentId) ?? row.parentId),
      role: row.parentId === null ? 'orchestrator' : 'task',
      kind: row.kind,
      eventCount: row.eventCount,
      toolCount: ownEvents.filter((event) => event.kind.startsWith('tool')).length,
      errorCount: row.errorCount,
      terminal: row.terminal,
      statusLabel: row.statusLabel,
      statusTone: row.statusTone,
      lastEvent: ownEvents.at(-1)?.label || ownEvents.at(-1)?.kind || null,
      activity,
    };
  });
}
