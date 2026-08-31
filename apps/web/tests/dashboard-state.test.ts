import { describe, expect, it } from 'vitest';
import {
  DASHBOARD_STATES,
  SETUP_CHECKS,
  deriveDashboardState,
  type DashboardState,
  type Probe,
} from '../src/features/dashboard/state';

/**
 * The Dashboard replaced a picture of a healthy setup with a derived one. These
 * tests exist because the happy path is the only state anyone ever looks at by
 * accident: every other state is reachable only when something is wrong, which
 * is exactly when a developer is relying on it to be right.
 */

const base: Probe = { runtimeLoaded: true, formats: ['google-adk@1'], openedSession: false };

describe('deriveDashboardState', () => {
  it('reports a pending probe rather than guessing', () => {
    expect(deriveDashboardState({ ...base, runtimeLoaded: null })).toBe('checking-runtime');
  });

  it('reports a failed runtime', () => {
    expect(deriveDashboardState({ ...base, runtimeLoaded: false })).toBe('cli-missing');
  });

  it('asks the operator to follow the CLI once the runtime is up', () => {
    expect(deriveDashboardState(base)).toBe('workspace-required');
    expect(DASHBOARD_STATES['workspace-required'].title).toContain('CLI');
    expect(DASHBOARD_STATES['workspace-required'].primary.label).toBe('Open Agent Viewer');
    expect(DASHBOARD_STATES.ready.primary.label).not.toContain('Choose local session');
  });

  it('is ready only after a session actually projected', () => {
    expect(deriveDashboardState({ ...base, openedSession: true })).toBe('ready');
  });

  it('puts a rejected session ahead of an otherwise healthy probe', () => {
    // The ordering that matters: a developer who just had a file refused must
    // not be shown a green "ready" panel because the runtime is fine.
    const healthy = { ...base, openedSession: true } as const;
    expect(deriveDashboardState({ ...healthy, lastLoadRejected: 'unsupported' })).toBe(
      'adapter-failed',
    );
    expect(deriveDashboardState({ ...healthy, lastLoadRejected: 'empty-folder' })).toBe(
      'no-sessions',
    );
  });

  it('is total: every declared state is reachable from some probe', () => {
    const probes: Probe[] = [
      { ...base, runtimeLoaded: null },
      { ...base, runtimeLoaded: false },
      base,
      { ...base, openedSession: true },
      { ...base, lastLoadRejected: 'unsupported' },
      { ...base, lastLoadRejected: 'empty-folder' },
    ];
    const reached = new Set(probes.map(deriveDashboardState));
    // `first-run` is the pre-probe initial state and is set directly, not derived.
    const derivable = (Object.keys(DASHBOARD_STATES) as DashboardState[]).filter(
      (state) => state !== 'first-run',
    );
    for (const state of derivable) {
      expect(reached, `${state} is declared but no probe produces it`).toContain(state);
    }
  });
});

describe('the state contract', () => {
  const states = Object.entries(DASHBOARD_STATES);

  it('gives every state copy and a primary action', () => {
    for (const [name, contract] of states) {
      expect(contract.title, `${name} has no title`).not.toBe('');
      expect(contract.message, `${name} has no message`).not.toBe('');
      expect(contract.primary.label, `${name} has no primary action`).not.toBe('');
    }
  });

  it('gives every dead end a recovery action', () => {
    // A state a developer can be stuck in must say what to do next. Progress
    // states (checking, first run) legitimately have none.
    for (const name of ['cli-missing', 'adapter-failed', 'no-sessions'] as const) {
      expect(DASHBOARD_STATES[name].recovery, `${name} strands the developer`).toBeDefined();
    }
  });

  it('offers no controls while a probe is still running', () => {
    // Offering an action that races the check is how a page ends up showing
    // two different answers to the same question.
    expect(DASHBOARD_STATES['checking-runtime'].enabled).toHaveLength(0);
  });

  it('never routes a command through an href', () => {
    for (const [name, contract] of states) {
      for (const action of [contract.primary, contract.secondary, contract.recovery]) {
        if (action?.command !== undefined) {
          expect(action.href, `${name} would navigate away instead of running its command`).toBe(
            undefined,
          );
        }
      }
    }
  });
});

describe('the setup checklist', () => {
  it('marks the checks a browser tab cannot decide', () => {
    // The CLI and the developer's filesystem are not reachable from a page.
    // These must be rendered as instructions, never as a completed probe.
    const manual = SETUP_CHECKS.filter((check) => !check.verifiable).map((check) => check.id);
    expect(manual).toEqual(['cli', 'workspace']);
  });

  it('keeps at least one check the page really can verify', () => {
    // Otherwise the checklist is decoration and the summary count is a lie.
    expect(SETUP_CHECKS.some((check) => check.verifiable)).toBe(true);
  });
});
