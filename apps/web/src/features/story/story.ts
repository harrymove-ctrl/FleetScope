/**
 * Story Mode: the same shape on every route, different facts per route.
 *
 * # The rule this module exists to enforce
 *
 * A card may only appear if the session can actually evidence it. Story Mode
 * says things like "unsafe input was blocked" or "Warden retried under policy",
 * and a local agent session records none of those. Rendering such a card and
 * explaining underneath does not work: a reader who skims takes the claim and
 * misses the caveat. So a capability without evidence is rendered as an absence
 * with no claim verb in it, and the enterprise wording never appears.
 *
 * # Why absences are shown rather than dropped
 *
 * Silently removing a card changes the layout between routes and reads as the
 * product hiding something. Naming the capability and saying it is not present
 * is both more honest and more informative.
 *
 * Structure is identical on every route:
 *
 *   Outcome → Proof cards → Chapters → What happened? → Evidence
 *
 * Only the adapter differs.
 */

export type Tone = 'ok' | 'warn' | 'bad' | 'info';

/** Mirrors `StoryCapabilities` in `agent-viewer-core`. */
export interface StoryCapabilities {
  readonly hasSecurityEvidence: boolean;
  readonly hasWardenEvidence: boolean;
  readonly hasActivationEvidence: boolean;
  readonly hasRuntimeRecovery: boolean;
}

/** Mirrors `StoryFacts` in `agent-viewer-core`. */
export interface StoryFacts {
  readonly agentCount: number;
  readonly completedCount: number;
  readonly failedCount: number;
  readonly unreportedCount: number;
  readonly eventCount: number;
  readonly errorCount: number;
  readonly unansweredCallCount: number;
  readonly failedAgent: string | null;
  readonly failureDetail: string | null;
  readonly capabilities: StoryCapabilities;
}

export interface ProofCard {
  readonly id: string;
  /** The claim, or for an absence, the capability's name with no claim in it. */
  readonly title: string;
  readonly detail: string;
  /**
   * `absent` means evidence loaded and the chain is not there. `unavailable`
   * means it could not be read at all. A reviewer acts differently on each, so
   * they are never collapsed. See `enterprise.ts`.
   */
  readonly state: 'evidenced' | 'absent' | 'unavailable' | 'unsupported';
  readonly tone: Tone;
}

export interface Chapter {
  readonly id: string;
  readonly title: string;
  /** The canonical event this chapter opens on. `null` when nothing to seek. */
  readonly sequence: number | null;
}

export interface Story {
  /** Never leave the reader to infer the source from a URL. */
  readonly sourceLabel: string;
  readonly outcome: string;
  readonly summary: string;
  readonly cards: readonly ProofCard[];
  /**
   * One line naming what this route cannot evidence, or `null`.
   *
   * Deliberately not a card: an absence must not compete for attention with a
   * fact, and four of them made the local route read as mostly-missing.
   */
  readonly disclosure: string | null;
  readonly chapters: readonly Chapter[];
  readonly narrative: {
    readonly problem: string;
    readonly action: string;
    readonly result: string;
  };
}

/** The governance capabilities Story Mode can claim, and their wording. */
// Names are neutral NOUNS, never past-tense verbs: an absence card must not be
// skimmable as an event. "Runtime recovery", not "Runtime-confirmed recovery".
const GOVERNANCE: readonly {
  id: string;
  name: string;
  flag: keyof StoryCapabilities;
}[] = [
  { id: 'security', name: 'Input screening', flag: 'hasSecurityEvidence' },
  { id: 'warden', name: 'Warden recovery', flag: 'hasWardenEvidence' },
  { id: 'activation', name: 'Vendor activation', flag: 'hasActivationEvidence' },
  { id: 'runtime', name: 'Runtime recovery', flag: 'hasRuntimeRecovery' },
];

/**
 * One line covering every capability this session cannot evidence.
 *
 * Four separate "not present" cards were honest but noisy: they doubled the
 * card count and gave absent capabilities the same visual weight as things
 * that actually happened. A shared presentation contract does not require the
 * same card COUNT on every route, only the same structure, so the local route
 * states the limit once and spends its cards on facts.
 *
 * Returns `null` when the session can evidence everything, so the line
 * disappears rather than reading as a permanent caveat.
 */
export function absenceDisclosure(capabilities: StoryCapabilities): string | null {
  const missing = GOVERNANCE.filter((entry) => !capabilities[entry.flag]);
  if (missing.length === 0) return null;
  return 'Local session only — enterprise security and recovery controls are not part of this recording.';
}

/** Plural that reads like English rather than "1 agents". */
const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/**
 * The local session adapter.
 *
 * Every string it produces traces to a number the Rust side computed. It has no
 * access to governance evidence and never invents any.
 */
export function localStory(facts: StoryFacts, chapters: readonly Chapter[]): Story {
  const healthy = facts.failedCount === 0 && facts.unansweredCallCount === 0;

  const outcome = healthy
    ? 'Session completed'
    : `Session completed with ${count(facts.failedCount, 'failed agent', 'failed agents')}`;

  const summary = facts.failedAgent
    ? `${facts.failedAgent} failed${facts.failureDetail === null ? '' : `: ${facts.failureDetail}`}`
    : healthy
      ? `All ${count(facts.agentCount, 'agent', 'agents')} finished without a recorded error.`
      : 'The session recorded errors but named no failed agent.';

  const cards: ProofCard[] = [
    {
      id: 'agents',
      title: `${count(facts.agentCount, 'agent', 'agents')} ran`,
      detail: `${count(facts.eventCount, 'event', 'events')} recorded`,
      state: 'evidenced',
      tone: 'info',
    },
  ];

  if (facts.failedAgent !== null) {
    cards.push({
      id: 'failure',
      title: `${facts.failedAgent} failed`,
      detail:
        facts.errorCount > 0
          ? `${count(facts.errorCount, 'recorded error', 'recorded errors')}`
          : 'recorded as failed',
      state: 'evidenced',
      tone: 'bad',
    });
  }

  if (facts.unansweredCallCount > 0) {
    cards.push({
      id: 'unanswered',
      title: `${count(facts.unansweredCallCount, 'call', 'calls')} did not return`,
      detail: 'A tool was invoked and no result was recorded',
      state: 'evidenced',
      tone: 'warn',
    });
  }

  cards.push({
    id: 'outcome',
    title: `${facts.completedCount} of ${facts.agentCount} completed`,
    detail:
      facts.unreportedCount > 0
        ? `${count(facts.unreportedCount, 'agent', 'agents')} reported no terminal event`
        : 'Every agent reported a terminal event',
    state: 'evidenced',
    tone: facts.completedCount === facts.agentCount ? 'ok' : 'warn',
  });

  return {
    sourceLabel: 'Local Session',
    outcome,
    summary,
    cards,
    disclosure: absenceDisclosure(facts.capabilities),
    chapters,
    narrative: {
      problem:
        facts.failedAgent === null
          ? 'No agent reported a failure.'
          : `${facts.failedAgent} failed${
              facts.failureDetail === null ? '.' : `: ${facts.failureDetail}`
            }`,
      // The viewer OBSERVES a local run. It does not act on one, and saying
      // otherwise would be the same overclaim as a Warden card.
      action:
        'FleetScope read this session from a local file. It did not start, control or recover the run.',
      result: `${facts.completedCount} of ${facts.agentCount} agents completed${
        facts.unansweredCallCount > 0
          ? `, and ${facts.unansweredCallCount} call did not return`
          : ''
      }.`,
    },
  };
}

/**
 * Chapters from the events already loaded.
 *
 * Grouping, not derivation: each chapter points at the first event recorded for
 * an agent, so opening one seeks by canonical sequence like any other click.
 */
export function chaptersFrom(
  events: readonly { sequence: number; agentId: string }[],
  agents: readonly { id: string; label: string }[],
): Chapter[] {
  const opening = events.at(0);
  const closing = events.at(-1);
  if (opening === undefined || closing === undefined) return [];

  const chapters: Chapter[] = [{ id: 'start', title: 'Start', sequence: opening.sequence }];
  for (const agent of agents) {
    const first = events.find((event) => event.agentId === agent.id);
    // The root agent opens the session; it is the Start chapter already.
    if (first === undefined || first.sequence === opening.sequence) continue;
    chapters.push({ id: agent.id, title: agent.label, sequence: first.sequence });
  }
  chapters.push({ id: 'result', title: 'Result', sequence: closing.sequence });
  return chapters;
}
