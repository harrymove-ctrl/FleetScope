/**
 * Project WASM / inspect-shaped session facts into Session readings rows.
 *
 * The fixture path (`graphs.ts`) stays the offline demo. This adapter is the
 * bridge for a user-picked session: only fields that exist on the evidence are
 * mapped. Missing handoff order degrades to discovery order with an honest
 * note — never a fabricated pipeline.
 */
import type {
  CheckRow,
  FlowStep,
  SessionEvent,
  SpecRow,
  TimelineRow,
  TreeRow,
  UptimeCell,
} from './graphs';
import { checkRows, flowSteps, specRows, timelineRows, treeRows, uptimeCells } from './graphs';

export interface ProjectionReadingInput {
  readonly events: readonly SessionEvent[];
  /** Transfer chain when the record has handoffs; otherwise omit. */
  readonly transfers?: readonly string[];
  readonly handoffOrderKnown?: boolean;
}

export interface ProjectionReadings {
  readonly flow: FlowStep[];
  readonly tree: TreeRow[];
  readonly check: CheckRow[];
  readonly uptime: UptimeCell[];
  readonly spec: SpecRow[];
  readonly timeline: TimelineRow[];
  readonly handoffNote: string | null;
}

export function readingsFromProjection(input: ProjectionReadingInput): ProjectionReadings {
  const chain =
    input.transfers && input.transfers.length > 0
      ? input.transfers
      : [
          ...new Set(
            input.events.filter((event) => event.agent !== 'user').map((event) => event.agent),
          ),
        ];
  const known = input.handoffOrderKnown ?? Boolean(input.transfers && input.transfers.length > 1);
  return {
    flow: flowSteps(chain),
    tree: treeRows(input.events),
    check: checkRows(input.events),
    uptime: uptimeCells(input.events),
    spec: specRows(input.events),
    timeline: timelineRows(input.events),
    handoffNote: known
      ? null
      : 'Handoff order inferred from first appearance — no transfer events in the record.',
  };
}
