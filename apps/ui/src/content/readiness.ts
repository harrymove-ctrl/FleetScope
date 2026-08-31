/**
 * Dashboard embed copy — onboarding / readiness only.
 * Aligned with apps/web DashboardState labels; never SaaS metrics.
 */

export type ReadinessView = 'empty' | 'checking' | 'ready';

export const READINESS_TABS: { key: ReadinessView; label: string }[] = [
  { key: 'empty', label: 'Empty' },
  { key: 'checking', label: 'Checking' },
  { key: 'ready', label: 'Ready' },
];

export const READINESS_COPY: Record<
  ReadinessView,
  { title: string; message: string; checks: { label: string; detail: string; done: boolean }[] }
> = {
  empty: {
    title: 'Start with one session',
    message: 'Choose local files or open the example. FleetScope only reads what you select.',
    checks: [
      { label: 'Browser runtime', detail: 'Not checked yet', done: false },
      { label: 'Local session', detail: 'Nothing selected', done: false },
      { label: 'CLI on this machine', detail: 'Cannot verify from a tab', done: false },
    ],
  },
  checking: {
    title: 'Preparing the viewer',
    message: 'Checking the local projection runtime. Nothing leaves this browser.',
    checks: [
      { label: 'Browser runtime', detail: 'Probing WASM ABI…', done: false },
      { label: 'Local session', detail: 'Waiting', done: false },
      { label: 'CLI on this machine', detail: 'Cannot verify from a tab', done: false },
    ],
  },
  ready: {
    title: 'Runtime can project',
    message:
      'Rehearsal view — Astro onboarding above remains the probe source of truth. Open Viewer or Demo next.',
    checks: [
      { label: 'Browser runtime', detail: 'ABI available (rehearsal)', done: true },
      { label: 'Local session', detail: 'Pick files in the panel above', done: false },
      { label: 'CLI on this machine', detail: 'Cannot verify from a tab', done: false },
    ],
  },
};

export type ReadinessCommand = {
  id: string;
  group: string;
  title: string;
  detail?: string;
  href?: string;
  shortcut: string;
};

/** Commands for the palette — product paths, not SaaS admin. */
export const READINESS_COMMANDS: ReadinessCommand[] = [
  {
    id: 'open-viewer',
    group: 'Open',
    title: 'Open Agent Viewer',
    detail: 'Graph, inspector, replay',
    href: 'http://127.0.0.1:4321/viewer',
    shortcut: '1',
  },
  {
    id: 'open-demo',
    group: 'Open',
    title: 'Open Session readings',
    detail: 'Non-interactive judge poster',
    href: 'http://127.0.0.1:4321/demo',
    shortcut: '2',
  },
  {
    id: 'open-approvals',
    group: 'Open',
    title: 'Open Approvals',
    detail: 'Launch readiness HITL rehearsal',
    href: 'http://127.0.0.1:4321/approvals',
    shortcut: '3',
  },
  {
    id: 'retry-runtime',
    group: 'Checks',
    title: 'Retry runtime check',
    detail: 'Use the Astro dashboard primary control',
    href: 'http://127.0.0.1:4321/dashboard',
    shortcut: 'R',
  },
  {
    id: 'formats',
    group: 'Checks',
    title: 'Supported session formats',
    detail: 'Google ADK JSONL and related',
    href: 'http://127.0.0.1:4321/dashboard',
    shortcut: 'F',
  },
  {
    id: 'cli',
    group: 'CLI',
    title: 'Use the CLI',
    detail: 'fleetscope watch / inspect — terminal is primary',
    shortcut: 'C',
  },
];
