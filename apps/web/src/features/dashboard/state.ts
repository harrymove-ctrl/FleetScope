/**
 * The Dashboard state contract.
 *
 * # Why this exists
 *
 * The Dashboard used to be a static picture of a healthy setup: a hardcoded
 * "2 of 4 ready", two checks permanently reading `✓ Ready`, and a session card
 * quoting an event count that did not match the session. None of it was
 * derived, so none of it could ever be wrong on screen and right in fact, or
 * the reverse. That is the failure this module removes.
 *
 * Every state names its own copy, tone, actions and which controls are live.
 * A component renders a state; it never infers one from text or CSS, and it
 * never invents a status the probe did not return.
 *
 * # What a browser can and cannot verify
 *
 * This page runs in a browser tab. It CAN verify what it can reach: whether the
 * WASM runtime loads and exposes its ABI, which adapters that build carries,
 * and whether a session the developer picked actually projects.
 *
 * It CANNOT see the filesystem, enumerate previous sessions, or tell whether
 * the `fleetscope` binary is installed. Those checks are marked
 * `verifiable: false` and are rendered as instructions, never as a completed
 * probe with a green tick. Claiming otherwise is the exact dishonesty the
 * product forbids elsewhere, and it is cheaper to say "we cannot check this
 * from here" than to be confidently wrong.
 */

export type DashboardState =
  | 'first-run'
  | 'checking-runtime'
  | 'cli-missing'
  | 'workspace-required'
  | 'adapter-failed'
  | 'no-sessions'
  | 'ready';

/** Maps to the existing `[data-tone]` styling vocabulary. */
export type StatusTone = 'info' | 'ok' | 'warn' | 'bad';

export interface StateAction {
  readonly label: string;
  readonly href?: string;
  /** Marks a control the script wires up rather than a link. */
  readonly command?: 'load-demo' | 'retry-runtime' | 'open-command-menu';
}

export interface DashboardStateContract {
  readonly title: string;
  readonly message: string;
  readonly tone: StatusTone;
  readonly primary: StateAction;
  readonly secondary?: StateAction;
  /**
   * What to do when this state is a dead end. Present on every state that a
   * developer can get stuck in, absent on the states that are simply progress.
   */
  readonly recovery?: StateAction;
  /** Controls that make sense in this state. Everything else is disabled. */
  readonly enabled: readonly ControlId[];
}

export type ControlId = 'open-viewer' | 'load-demo' | 'copy-cli' | 'command-menu';

const ALL_CONTROLS: readonly ControlId[] = ['open-viewer', 'load-demo', 'copy-cli', 'command-menu'];

export const DASHBOARD_STATES: Readonly<Record<DashboardState, DashboardStateContract>> = {
  'first-run': {
    title: 'Watch the CLI session',
    message:
      'Run the producer in your terminal. FleetScope follows the JSONL it writes — this tab never uploads a recording.',
    tone: 'info',
    primary: { label: 'Check the runtime', command: 'retry-runtime' },
    secondary: { label: 'Open Agent Viewer', href: '/viewer' },
    enabled: ALL_CONTROLS,
  },

  'checking-runtime': {
    title: 'Preparing the viewer',
    message: 'Checking the local projection runtime. Nothing leaves this browser.',
    tone: 'info',
    // Deliberately no actions while a probe is in flight: offering a button
    // that races the check is how a UI ends up reporting two answers.
    primary: { label: 'Checking…', command: 'retry-runtime' },
    enabled: [],
  },

  'cli-missing': {
    title: 'The viewer needs attention',
    message:
      'The browser runtime did not load. Retry here, or follow the session from your terminal.',
    tone: 'bad',
    primary: { label: 'Retry the check', command: 'retry-runtime' },
    secondary: { label: 'Open Agent Viewer anyway', href: '/viewer' },
    recovery: { label: 'Build it: pnpm build:wasm', command: 'retry-runtime' },
    enabled: ['command-menu'],
  },

  'workspace-required': {
    title: 'Watch the CLI session',
    message: 'Copy the watch command, run it next to the producer, then open Agent Viewer.',
    tone: 'info',
    primary: { label: 'Open Agent Viewer', href: '/viewer' },
    secondary: { label: 'Preview bundled run', href: '/viewer' },
    enabled: ALL_CONTROLS,
  },

  'adapter-failed': {
    title: "This session isn't supported",
    message:
      'Follow a Gemini or Google ADK JSONL from the CLI. FleetScope will not guess an unknown format.',
    tone: 'bad',
    primary: { label: 'Open Agent Viewer', href: '/viewer' },
    secondary: { label: 'Preview bundled run', href: '/viewer' },
    recovery: { label: 'See the formats this build reads', command: 'open-command-menu' },
    enabled: ALL_CONTROLS,
  },

  'no-sessions': {
    title: 'No session found',
    message: 'Point fleetscope --follow at the folder the producer is writing.',
    tone: 'warn',
    primary: { label: 'Open Agent Viewer', href: '/viewer' },
    secondary: { label: 'Preview bundled run', href: '/viewer' },
    recovery: { label: 'Copy the CLI watch command', command: 'open-command-menu' },
    enabled: ALL_CONTROLS,
  },

  ready: {
    title: 'Watch the CLI session',
    message:
      'The local viewer is ready. Follow the producer from your terminal, or preview the bundled run.',
    tone: 'ok',
    primary: { label: 'Open Agent Viewer', href: '/viewer' },
    secondary: { label: 'Preview bundled run', href: '/viewer' },
    enabled: ALL_CONTROLS,
  },
};

/** One onboarding check, and whether this page is able to decide it. */
export interface SetupCheck {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /**
   * False when the answer is not knowable from a browser tab. Such a check is
   * shown as an instruction with a neutral tone, never as a green tick: the
   * page has not verified it and must not imply that it has.
   */
  readonly verifiable: boolean;
  readonly detail?: string;
}

export const SETUP_CHECKS: readonly SetupCheck[] = [
  {
    id: 'cli',
    title: 'Install the CLI',
    description:
      'The terminal command is the primary way to use FleetScope. A browser tab cannot see whether it is installed, so this one is on you.',
    verifiable: false,
    detail: 'cargo install --path crates/fleetscope-cli',
  },
  {
    id: 'runtime',
    title: 'Load the projection runtime',
    description: 'The same projection the CLI uses, compiled for the browser.',
    verifiable: true,
  },
  {
    id: 'adapters',
    title: 'Session formats',
    description: 'Which dialects this build can read. Reported by the runtime, not hardcoded.',
    verifiable: true,
  },
  {
    id: 'workspace',
    title: 'Follow a local session',
    description:
      'The producer writes JSONL on disk. FleetScope tails that path from the CLI. This tab never uploads a recording.',
    verifiable: false,
    detail: 'fleetscope <path> --follow',
  },
];

/** Inputs the page can actually observe. */
export interface Probe {
  /** `null` while the check is still running. */
  readonly runtimeLoaded: boolean | null;
  /** Adapters the runtime reported. Empty until it answers. */
  readonly formats: readonly string[];
  /** Set once a session has been projected in this tab. */
  readonly openedSession: boolean;
  /** Set when a picked session was refused by every adapter. */
  readonly lastLoadRejected?: 'unsupported' | 'empty-folder';
}

/**
 * Derive the state. Pure, total, and the ONLY place a state is decided.
 *
 * Order matters: a failure the developer has to act on outranks progress, and
 * progress outranks the idle states, so the page never shows a green summary
 * over an error the probe just returned.
 */
export function deriveDashboardState(probe: Probe): DashboardState {
  if (probe.lastLoadRejected === 'unsupported') return 'adapter-failed';
  if (probe.lastLoadRejected === 'empty-folder') return 'no-sessions';
  if (probe.runtimeLoaded === null) return 'checking-runtime';
  if (probe.runtimeLoaded === false) return 'cli-missing';
  if (probe.openedSession) return 'ready';
  return 'workspace-required';
}

/** The initial state, before any probe has run. */
export const INITIAL_STATE: DashboardState = 'first-run';
