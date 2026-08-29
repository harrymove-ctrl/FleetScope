/**
 * The scenarios a live run may use. There is no other way to start one.
 *
 * # Why an allowlist and not parameters
 *
 * A live run spends money and reaches the public internet. Every field that
 * could widen either — the prompt, the target, the tool, the retry budget — is
 * fixed HERE, in the server's own source, and the request names a scenario
 * rather than describing one. There is deliberately no endpoint anywhere that
 * accepts a prompt, a URL, a shell command or a tool parameter.
 *
 * This mirrors `apps/api/src/live/allowlist.ts`, which bounds the existing
 * single-decision path the same way.
 */

/** What a recovery is permitted to do. Only one class is implemented. */
export type SideEffectClass = 'idempotent_read';

export interface LiveScenario {
  readonly id: string;
  readonly description: string;
  /** The ADK root agent this scenario runs. */
  readonly rootAgent: string;
  /** The sub-agent the root is expected to delegate to. */
  readonly delegatedAgent: string;
  /** The allowlisted external target. Never taken from a request. */
  readonly target: string;
  /** Human-readable description of the external operation. */
  readonly externalOperation: string;
  /** The single recovery the Warden policy may authorize. */
  readonly recoveryAction: 'retry_idempotent_read';
  readonly sideEffectClass: SideEffectClass;
  /** At most one Warden retry, by construction. */
  readonly maxWardenRetries: 1;
  readonly maxModelCalls: number;
  readonly maxOutputTokens: number;
  readonly timeoutMs: number;
}

export const LIVE_SCENARIOS: readonly LiveScenario[] = [
  {
    id: 'dependency_onboarding',
    description:
      'A root agent onboards a dependency and delegates a security review that reads public repository metadata.',
    rootAgent: 'dependency_onboarding',
    delegatedAgent: 'security_review',
    // A public, read-only target. No purchase, activation, email, account
    // mutation or write of any kind is reachable from this scenario.
    target: 'google/adk-python',
    externalOperation: 'read-only repository metadata',
    recoveryAction: 'retry_idempotent_read',
    sideEffectClass: 'idempotent_read',
    maxWardenRetries: 1,
    maxModelCalls: 6,
    maxOutputTokens: 256,
    timeoutMs: 90_000,
  },
];

export function findScenario(id: string): LiveScenario | null {
  return LIVE_SCENARIOS.find((scenario) => scenario.id === id) ?? null;
}
