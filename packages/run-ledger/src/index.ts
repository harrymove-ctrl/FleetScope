/**
 * The run ledger: what a live run is, and the gate it passes to start.
 *
 * Deliberately IO-free and dependency-free. The store is a port, the clock and
 * id generator are injected, so admission, budget and idempotency are all
 * testable at zero cost and with no network, no model and no filesystem.
 */

export {
  admitRun,
  callsUsed,
  type AdmissionContext,
  type RunAdmission,
  type RunRejection,
} from './admission.js';
export {
  EVENT_TRUTHS,
  observedWork,
  parseWorkerEvent,
  phaseOf,
  RunEventLedger,
  type EventTruth,
  type ObservedWork,
  type RunEvent,
  type RunPhase,
} from './event.js';
export { MemoryRunStore, RunLedger, type RunStore } from './ledger.js';
export {
  isActive,
  newRun,
  type RunMode,
  type RunRecord,
  type RunState,
  type TerminalResult,
} from './record.js';
export {
  findScenario,
  LIVE_SCENARIOS,
  type LiveScenario,
  type SideEffectClass,
} from './scenario.js';
