/**
 * The enterprise Story adapter: canonical events in, governance claims out.
 *
 * # The rule this module exists to enforce
 *
 * A capability card may claim only what the recording PROVES. Configuration is
 * not evidence: a policy being installed, a scanner being enabled or a role
 * existing says nothing about whether the control acted. Every claim here is
 * the conclusion of a chain of canonical events, and every chain can be broken
 * by deleting one event or by corrupting one correlation id — which is exactly
 * what `story-enterprise.test.ts` does to each of them.
 *
 * # Four states, and why `absent` and `unavailable` are not the same
 *
 * `absent` means evidence loaded and the chain is not there. `unavailable`
 * means evidence could not be read at all. A reviewer acts differently on each:
 * one is a finding about the run, the other is a finding about the tooling.
 * Collapsing them would report a missing control when the truth is that nothing
 * is known.
 *
 * # What this adapter may read
 *
 * Canonical events and projected Case state. NOT the evidence manifest, NOT the
 * graph, NOT DOM copy, NOT timestamps as a proxy for causality. A capability
 * that is real but unrecorded therefore reads as `absent`. That bias is
 * deliberate: the opposite bias invents governance.
 */

import type { CanonicalEvent } from '@fleetscope/event-schema';

import type { Chapter, Story, Tone } from './story';

/** Schema versions whose event semantics this adapter is written against. */
const SUPPORTED_SCHEMA_VERSIONS: readonly string[] = ['1.0.0'];

export type CardState = 'evidenced' | 'absent' | 'unavailable' | 'unsupported';

export interface ProofCard {
  readonly id: string;
  /** The claim when evidenced; the capability's bare name otherwise. */
  readonly title: string;
  readonly detail: string;
  readonly state: CardState;
  readonly tone: Tone;
  /** Where the Case Cursor goes. `null` whenever there is nothing to verify. */
  readonly primaryCaseSequence: number | null;
  /** Every event a reviewer needs to check the claim. Empty unless evidenced. */
  readonly evidenceEventIds: readonly string[];
  /**
   * The event AT `primaryCaseSequence`.
   *
   * Not `evidenceEventIds[0]`: that is the first event of the chain, which for
   * the Warden card is the incident and for the activation card is the approval
   * request. Opening the drawer on it would show a reviewer the wrong end of
   * the proof from a control labelled with the card's own claim.
   */
  readonly primaryEventId: string | null;
  /** Only when the events themselves name an agent. Never inferred. */
  readonly agentInstanceId?: string;
}

/**
 * One step of the Proof Path.
 *
 * The path is the shape of the run, not a progress bar: it answers "what did
 * this system actually do, in order" for a reader who has never seen the
 * vocabulary. `not-reached` therefore carries no destination — seeking to
 * roughly where a step would have been is how a reader ends up reading an
 * unrelated event as the approval that never happened.
 */
export interface ProofStep {
  readonly id: string;
  /** A verb, so the path reads as a sentence rather than a schema. */
  readonly title: string;
  readonly state: 'reached' | 'not-reached';
  readonly caseSequence: number | null;
}

/**
 * One stop on the Guided Evidence Tour.
 *
 * The tour exists because the Golden Path works but does not tell a first-time
 * reader where to start: four cards and six path steps are a menu, not a
 * narrative. Each stop answers what happened and why it matters, in words
 * someone who has never seen the vocabulary can act on.
 */
export interface TourStep {
  readonly id: string;
  readonly heading: string;
  readonly what: string;
  readonly why: string;
  /** A word, so state survives greyscale and screen readers. */
  readonly status: string;
  /** Paired with the word, never a substitute for it. */
  readonly icon: string;
  readonly caseSequence: number;
  readonly evidenceEventId: string;
}

export interface EnterpriseStory extends Omit<Story, 'cards'> {
  readonly cards: readonly ProofCard[];
  readonly proofPath: readonly ProofStep[];
  readonly tour: readonly TourStep[];
}

export type EnterpriseEvidence =
  | { readonly status: 'loaded'; readonly events: readonly CanonicalEvent[] }
  | { readonly status: 'unavailable'; readonly reason: string };

// ── Reading events without trusting their shape ─────────────────────────────
//
// `payloadRedacted` and `correlations` are open maps by design, because
// platform services differ in what they can supply. Every read goes through
// these, so a missing key is `undefined` rather than a crash on one bad Case.

const field = (event: CanonicalEvent, key: string): string | undefined => {
  const value = (event.payloadRedacted as Record<string, unknown> | undefined)?.[key];
  return typeof value === 'string' ? value : undefined;
};

const corr = (event: CanonicalEvent, key: string): string | undefined =>
  (event.correlations as Record<string, string> | undefined)?.[key];

const ofType = (events: readonly CanonicalEvent[], type: string): CanonicalEvent[] =>
  events.filter((event) => event.type === type);

/** The four slots, in the fixed order the page renders them. */
const SLOTS = [
  { id: 'security', name: 'Input screening' },
  { id: 'warden', name: 'Warden recovery' },
  { id: 'runtime', name: 'Runtime recovery' },
  { id: 'activation', name: 'Vendor activation' },
] as const;

type SlotId = (typeof SLOTS)[number]['id'];

/** What a predicate returns when the chain holds. */
interface Proof {
  readonly claim: string;
  readonly primaryEventId: string;
  readonly detail: string;
  readonly primaryCaseSequence: number;
  readonly evidenceEventIds: readonly string[];
  readonly agentInstanceId?: string;
  readonly tone: Tone;
}

/**
 * Input screening: a block that was actually enforced.
 *
 * `armor.blocked` alone proves an input was flagged, not that the flag had any
 * effect. The rejection correlated by the same `screenedInputId` is what shows
 * enforcement, and any tool call or memory write between the two shows it was
 * NOT enforced — the work carried on regardless.
 */
function proveScreening(events: readonly CanonicalEvent[]): Proof | null {
  for (const blocked of ofType(events, 'armor.blocked')) {
    const inputId = corr(blocked, 'screenedInputId');
    if (inputId === undefined) continue;

    const rejected = ofType(events, 'memory.rejected').find(
      (event) =>
        corr(event, 'screenedInputId') === inputId && event.caseSequence > blocked.caseSequence,
    );
    if (rejected === undefined) continue;

    const leaked = events.some(
      (event) =>
        event.caseSequence > blocked.caseSequence &&
        event.caseSequence < rejected.caseSequence &&
        (event.type === 'tool.requested' || event.type === 'memory.written'),
    );
    if (leaked) continue;

    return {
      claim: 'Input screened before it reached the agent',
      detail: `${field(blocked, 'findingClass') ?? 'A finding'} on the ${field(blocked, 'channel') ?? 'input'} channel was blocked, and the memory write for the same input was rejected. Nothing ran in between.`,
      primaryCaseSequence: blocked.caseSequence,
      primaryEventId: blocked.eventId,
      evidenceEventIds: [blocked.eventId, rejected.eventId],
      tone: 'ok',
    };
  }
  return null;
}

/**
 * Warden recovery: repeated failure, an incident, a policy that permitted
 * acting, and a complete intervention lifecycle.
 *
 * The primary destination is the POLICY evaluation, not the incident: the claim
 * is that something authorized an automated action, and that is the event a
 * reviewer has to read to check it.
 */
function proveWarden(events: readonly CanonicalEvent[]): Proof | null {
  for (const policy of ofType(events, 'policy.evaluated')) {
    if (field(policy, 'disposition') !== 'auto_act') continue;
    const incidentId = corr(policy, 'incidentId');
    if (incidentId === undefined) continue;

    const incident = ofType(events, 'incident.opened').find(
      (event) => corr(event, 'incidentId') === incidentId,
    );
    if (incident === undefined) continue;

    const agentInstanceId = corr(incident, 'agentInstanceId');
    const threshold = Number(
      (incident.payloadRedacted as Record<string, unknown> | undefined)?.['threshold'] ?? 3,
    );

    // The incident claims a repeated failure. The failures have to be there,
    // for the same tool and the same agent, before the incident opened.
    const failures = ofType(events, 'tool.failed').filter(
      (event) =>
        event.caseSequence < incident.caseSequence &&
        corr(event, 'agentInstanceId') === agentInstanceId,
    );
    const byTool = new Map<string, number>();
    for (const failure of failures) {
      const tool = field(failure, 'tool');
      if (tool !== undefined) byTool.set(tool, (byTool.get(tool) ?? 0) + 1);
    }
    const repeated = [...byTool.entries()].find(([, n]) => n >= threshold);
    if (repeated === undefined) continue;

    // A lifecycle, not a step: proposed, authorized, requested, acknowledged,
    // all under one interventionId that belongs to THIS incident.
    const proposed = ofType(events, 'intervention.proposed').find(
      (event) => corr(event, 'incidentId') === incidentId,
    );
    const interventionId = proposed === undefined ? undefined : corr(proposed, 'interventionId');
    if (proposed === undefined || interventionId === undefined) continue;

    const step = (type: string) =>
      ofType(events, type).find((event) => corr(event, 'interventionId') === interventionId);
    const authorized = step('intervention.authorized');
    const requested = step('intervention.requested');
    const acknowledged = step('intervention.acknowledged');
    if (authorized === undefined || requested === undefined || acknowledged === undefined) continue;

    const resolved = ofType(events, 'incident.resolved').find(
      (event) => corr(event, 'incidentId') === incidentId,
    );
    if (resolved === undefined) continue;

    const [tool, count] = repeated;
    return {
      claim: 'Bounded retry recovered the logistics check',
      detail: `${count} failures of ${tool} opened ${incidentId}. Policy ${corr(policy, 'policyVersion') ?? 'evaluation'} permitted an automated ${field(proposed, 'operation') ?? 'action'}, which was authorized, requested and acknowledged as ${interventionId}.`,
      primaryCaseSequence: policy.caseSequence,
      primaryEventId: policy.eventId,
      evidenceEventIds: [
        incident.eventId,
        policy.eventId,
        proposed.eventId,
        authorized.eventId,
        requested.eventId,
        acknowledged.eventId,
        resolved.eventId,
      ],
      ...(agentInstanceId === undefined ? {} : { agentInstanceId }),
      tone: 'ok',
    };
  }
  return null;
}

/**
 * Runtime recovery: the action was applied AND something worked afterwards.
 *
 * "We acted" is not "it recovered". A `runtime.controlled` with no subsequent
 * success is the exact shape of a control that reported itself effective while
 * the agent stayed broken, so the retry's success is required.
 */
function proveRuntime(events: readonly CanonicalEvent[]): Proof | null {
  for (const controlled of ofType(events, 'runtime.controlled')) {
    if (field(controlled, 'result') !== 'applied') continue;
    const interventionId = corr(controlled, 'interventionId');
    if (interventionId === undefined) continue;

    const succeeded = ofType(events, 'intervention.succeeded').find(
      (event) => corr(event, 'interventionId') === interventionId,
    );
    if (succeeded === undefined) continue;

    const target = ofType(events, 'intervention.requested').find(
      (event) => corr(event, 'interventionId') === interventionId,
    );
    const agentInstanceId = target === undefined ? undefined : field(target, 'target');

    // Progress after the action, by the agent the action targeted.
    const progress = ofType(events, 'tool.succeeded').find(
      (event) =>
        event.caseSequence > controlled.caseSequence &&
        (agentInstanceId === undefined || corr(event, 'agentInstanceId') === agentInstanceId),
    );
    if (progress === undefined) continue;

    const resolved = ofType(events, 'incident.resolved').find(
      (event) =>
        corr(event, 'interventionId') === interventionId &&
        field(event, 'resolution') === 'recovered',
    );
    if (resolved === undefined) continue;

    return {
      claim: 'Runtime applied the authorized recovery',
      detail: `The ${field(controlled, 'operation') ?? 'intervention'} was applied, ${field(progress, 'tool') ?? 'the call'} then succeeded, and the incident closed as recovered.`,
      primaryCaseSequence: controlled.caseSequence,
      primaryEventId: controlled.eventId,
      evidenceEventIds: [controlled.eventId, succeeded.eventId, progress.eventId, resolved.eventId],
      ...(agentInstanceId === undefined ? {} : { agentInstanceId }),
      tone: 'ok',
    };
  }
  return null;
}

/**
 * Vendor activation: a human approved it, and the activation cited that
 * approval.
 *
 * Both halves are required and the missing halves mean different things. An
 * approval with no activation is an unfinished workflow. An activation with no
 * approval is an unauthorized write, which is the more serious finding.
 */
function proveActivation(events: readonly CanonicalEvent[]): Proof | null {
  for (const opened of ofType(events, 'human_escalation.opened')) {
    const approvalId = corr(opened, 'approvalId');
    if (approvalId === undefined) continue;

    const resolvedApproval = ofType(events, 'human_escalation.resolved').find(
      (event) =>
        corr(event, 'approvalId') === approvalId && field(event, 'decision') === 'approved',
    );
    if (resolvedApproval === undefined) continue;

    // The request must CITE the approval. Proximity in the stream is not a
    // reference, and reading it as one is how an unapproved write gets covered
    // by an unrelated approval.
    const requested = ofType(events, 'tool.requested').find(
      (event) => field(event, 'approvalId') === approvalId,
    );
    const toolCallId = requested === undefined ? undefined : corr(requested, 'toolCallId');
    if (requested === undefined || toolCallId === undefined) continue;

    const allowed = ofType(events, 'identity.allowed').find(
      (event) => corr(event, 'toolCallId') === toolCallId,
    );
    const succeeded = ofType(events, 'tool.succeeded').find(
      (event) => corr(event, 'toolCallId') === toolCallId,
    );
    if (allowed === undefined || succeeded === undefined) continue;

    const agentInstanceId = corr(requested, 'agentInstanceId');
    return {
      claim: 'Vendor activation completed under approval',
      detail: `${field(resolvedApproval, 'approver') ?? 'An approver'} approved ${approvalId}. The ${field(requested, 'tool') ?? 'activation'} call cited it, identity allowed ${field(allowed, 'requestedRole') ?? 'the role'}, and the call succeeded.`,
      primaryCaseSequence: allowed.caseSequence,
      primaryEventId: allowed.eventId,
      evidenceEventIds: [
        opened.eventId,
        resolvedApproval.eventId,
        requested.eventId,
        allowed.eventId,
        succeeded.eventId,
      ],
      ...(agentInstanceId === undefined ? {} : { agentInstanceId }),
      tone: 'ok',
    };
  }
  return null;
}

const PROVERS: Record<SlotId, (events: readonly CanonicalEvent[]) => Proof | null> = {
  security: proveScreening,
  warden: proveWarden,
  runtime: proveRuntime,
  activation: proveActivation,
};

/** The wording for a slot that is not evidenced. Never a claim verb. */
const UNPROVEN_DETAIL: Record<CardState, (name: string) => string> = {
  evidenced: () => '',
  absent: (name) =>
    `${name} is not evidenced in this recording. The required events are not present.`,
  unavailable: (name) => `${name} could not be evaluated: the evidence did not load.`,
  unsupported: (name) =>
    `${name} cannot be evaluated: this recording uses an event schema this build does not read.`,
};

const UNPROVEN_TONE: Record<CardState, Tone> = {
  evidenced: 'ok',
  absent: 'info',
  unavailable: 'warn',
  unsupported: 'warn',
};

function unprovenCard(slot: (typeof SLOTS)[number], state: CardState): ProofCard {
  return {
    id: slot.id,
    // The bare capability NAME. A skimmer must not be able to read an absence
    // as an event that happened.
    title: slot.name,
    detail: UNPROVEN_DETAIL[state](slot.name),
    state,
    tone: UNPROVEN_TONE[state],
    primaryCaseSequence: null,
    evidenceEventIds: [],
    primaryEventId: null,
  };
}

// ── The Proof Path ──────────────────────────────────────────────────────────

/**
 * Delegate → Remember → Screen → Recover → Approve → Activate.
 *
 * CHRONOLOGICAL, matching the recording: this Case delegates at sequence 3,
 * writes memory at 10, and only screens the injection at 15.
 *
 * An earlier version ordered these by narrative appeal — screening first,
 * because it is the most striking control. Drawn as a connected left-to-right
 * path that reads as a timeline, and it was lying about one: the connector says
 * "this happened, then this", so the display order has to be the real order.
 *
 * A step that was not reached keeps its slot. The path is a shape the reader
 * learns; if it reflowed when a step were missing, the missing step would
 * become invisible rather than obvious.
 */
const PATH_SPECS: readonly {
  id: string;
  title: string;
  /** The capability slot that anchors this step, when one does. */
  slot?: SlotId;
  /** Fallback for steps no capability card covers. */
  types?: readonly string[];
}[] = [
  { id: 'delegate', title: 'Delegate', types: ['agent.spawned'] },
  { id: 'remember', title: 'Remember', types: ['memory.recalled', 'memory.written'] },
  { id: 'screen', title: 'Screen', slot: 'security' },
  { id: 'recover', title: 'Recover', slot: 'runtime' },
  { id: 'approve', title: 'Approve', types: ['human_escalation.opened'] },
  { id: 'activate', title: 'Activate', slot: 'activation' },
];

/**
 * Anchor a step to its PROVEN capability wherever one exists, not to the first
 * event of a matching type.
 *
 * The difference is not cosmetic. `identity.allowed` first appears at sequence
 * 7 in CASE-1042, for a routine read 45 events before the vendor activation.
 * Anchoring "Activate" to the first event of that type put the step — and the
 * cursor behind it — in completely the wrong part of the run, while still
 * looking plausible.
 */
function proofPathFor(
  events: readonly CanonicalEvent[],
  proofs: Partial<Record<SlotId, Proof>>,
): ProofStep[] {
  return PATH_SPECS.map((spec) => {
    const anchor =
      spec.slot !== undefined
        ? proofs[spec.slot]?.primaryCaseSequence
        : events.find((event) => (spec.types ?? []).includes(event.type))?.caseSequence;

    return anchor === undefined
      ? { id: spec.id, title: spec.title, state: 'not-reached' as const, caseSequence: null }
      : { id: spec.id, title: spec.title, state: 'reached' as const, caseSequence: anchor };
  });
}

/** A path with nothing reached, for the states where nothing was read. */
const emptyProofPath = (): ProofStep[] =>
  PATH_SPECS.map((spec) => ({
    id: spec.id,
    title: spec.title,
    state: 'not-reached' as const,
    caseSequence: null,
  }));

/**
 * The step the Event Cursor is currently inside: the last REACHED step at or
 * before the cursor, or the first reached step when the cursor precedes them
 * all. A step that was never reached is never active, however close the cursor
 * sits to where it would have been.
 */
export function activeStep(
  path: readonly ProofStep[],
  caseSequence: number,
): ProofStep | undefined {
  const reached = path.filter(
    (step): step is ProofStep & { caseSequence: number } =>
      step.state === 'reached' && step.caseSequence !== null,
  );
  if (reached.length === 0) return undefined;

  // CHRONOLOGICAL, not positional. The path's display order is a narrative
  // shape and its anchors are genuinely out of order: CASE-1042 delegates at
  // sequence 3 and memorises at 10, both BEFORE it screens the injection at 15.
  // Taking the last step in display order whose anchor is at or before the
  // cursor therefore answers `delegate` while the reader is looking at the
  // screening event.
  let active: (ProofStep & { caseSequence: number }) | undefined;
  for (const step of reached) {
    if (step.caseSequence > caseSequence) continue;
    if (active === undefined || step.caseSequence > active.caseSequence) active = step;
  }
  // Before every reached step, the earliest one is what the reader is heading to.
  return active ?? reached.reduce((a, b) => (b.caseSequence < a.caseSequence ? b : a));
}

// ── The Guided Evidence Tour ────────────────────────────────────────────────

/**
 * The copy for each stop.
 *
 * Every heading is a sentence about the run, not a capability name: "A
 * logistics specialist joined the case", not "Delegation". The `why` line is
 * what turns an event into a governance claim a reader can repeat.
 */
const TOUR_COPY: Record<string, { heading: string; what: string; why: string }> = {
  delegate: {
    heading: 'A logistics specialist joined the case',
    what: 'The orchestrator spawned a second agent to check supplier lead times.',
    why: 'FleetScope records which agent version received the work and how it was routed.',
  },
  remember: {
    heading: 'The negotiated terms survived the session boundary',
    what: 'The case wrote what it had learned into scoped memory.',
    why: 'The next session recovered the same fact with provenance instead of reconstructing it.',
  },
  screen: {
    heading: 'Unsafe vendor input was stopped before use',
    what: 'A prompt injection arriving over the vendor email channel was blocked.',
    why: 'The blocked input did not become memory or trigger a tool request.',
  },
  recover: {
    heading: 'A bounded retry recovered the logistics check',
    what: 'Three timeouts opened an incident, and one allowlisted retry was applied.',
    why: 'Policy allowed one specific retry, and Runtime reported the authoritative result.',
  },
  approve: {
    heading: 'The externally visible action waited for a person',
    what: 'The run paused and asked a human before touching the vendor record.',
    why: 'The Case remained paused until approval apr-001 was recorded.',
  },
  activate: {
    heading: 'The vendor was activated under that approval',
    what: 'The activation call cited the approval and the ERP reported success.',
    why: 'Identity allowed the approved request and ERP reported success.',
  },
};

/**
 * Build the tour from the Proof Path, so the two can never disagree about where
 * a step lives. A step with no anchor is DROPPED rather than given a plausible
 * neighbour: walking a reader to the wrong event under a confident heading is
 * worse than a shorter tour.
 */
function tourFor(path: readonly ProofStep[], events: readonly CanonicalEvent[]): TourStep[] {
  const steps: TourStep[] = [];
  for (const step of path) {
    const copy = TOUR_COPY[step.id];
    if (copy === undefined || step.state !== 'reached' || step.caseSequence === null) continue;
    const event = events.find((candidate) => candidate.caseSequence === step.caseSequence);
    if (event === undefined) continue;
    steps.push({
      id: step.id,
      heading: copy.heading,
      what: copy.what,
      why: copy.why,
      status: 'Evidenced',
      icon: '✓',
      caseSequence: step.caseSequence,
      evidenceEventId: event.eventId,
    });
  }
  return steps;
}

// ── Chapters ────────────────────────────────────────────────────────────────
//
// A chapter appears only when its evidence exists. An empty chapter is omitted
// rather than shown disabled: a greyed-out chapter still advertises that the
// concept applied to this Case.

const CHAPTER_SPECS: readonly { id: string; title: string; types: readonly string[] }[] = [
  { id: 'start', title: 'Start', types: ['case.created'] },
  { id: 'screening', title: 'Screening', types: ['armor.blocked'] },
  { id: 'memory', title: 'Memory', types: ['memory.recalled', 'memory.rejected'] },
  { id: 'delegation', title: 'Delegation', types: ['agent.spawned'] },
  { id: 'failure', title: 'Failure', types: ['incident.opened'] },
  { id: 'recovery', title: 'Recovery', types: ['runtime.controlled', 'intervention.succeeded'] },
  { id: 'approval', title: 'Approval', types: ['human_escalation.opened'] },
  { id: 'activation', title: 'Activation', types: ['identity.allowed'] },
  { id: 'result', title: 'Result', types: ['runtime.completed', 'case.milestone_changed'] },
];

function chaptersFor(events: readonly CanonicalEvent[]): Chapter[] {
  const chapters: Chapter[] = [];
  for (const spec of CHAPTER_SPECS) {
    // The LAST matching event for Result, the first for everything else: a
    // reader opening "Result" wants the outcome, not the first milestone.
    const matches = events.filter((event) => spec.types.includes(event.type));
    const target = spec.id === 'result' ? matches.at(-1) : matches[0];
    if (target === undefined) continue;
    chapters.push({ id: spec.id, title: spec.title, sequence: target.caseSequence });
  }
  return chapters;
}

// ── Narrative ───────────────────────────────────────────────────────────────

function narrativeFor(events: readonly CanonicalEvent[]): Story['narrative'] {
  const failures = ofType(events, 'tool.failed');
  const byTool = new Map<string, number>();
  for (const failure of failures) {
    const tool = field(failure, 'tool');
    if (tool !== undefined) byTool.set(tool, (byTool.get(tool) ?? 0) + 1);
  }
  const worst = [...byTool.entries()].sort((a, b) => b[1] - a[1])[0];
  const denials = events.filter(
    (event) => event.type === 'identity.denied' || event.type === 'gateway.denied',
  ).length;
  const approved = ofType(events, 'human_escalation.resolved').some(
    (event) => field(event, 'decision') === 'approved',
  );
  const waits = ofType(events, 'runtime.waiting').length;

  const spell = (n: number): string =>
    ['no', 'one', 'two', 'three', 'four', 'five'][n] ?? String(n);
  /** A number can open a sentence, and then it needs a capital like any word. */
  const opening = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

  const problem =
    worst === undefined
      ? 'No tool call failed in this recording.'
      : opening(
          `${spell(worst[1])} calls to ${worst[0]} timed out in a row, which opened an incident.`,
        );

  const action = approved
    ? `The run paused for a human approval${waits > 0 ? ` and waited ${spell(waits)} ${waits === 1 ? 'time' : 'times'}` : ''}, and continued only after it was granted.`
    : 'The run continued without any human approval on record.';

  const denialNote =
    denials === 0
      ? ''
      : ` ${opening(`${spell(denials)} earlier attempts were refused before one was allowed.`)}`;
  const completed = ofType(events, 'runtime.completed').length > 0;
  const result = `${completed ? 'The run completed.' : 'The run did not record a completion.'}${denialNote}`;

  return { problem, action, result };
}

// ── The adapter ─────────────────────────────────────────────────────────────

/**
 * Build the enterprise Story.
 *
 * Four fixed slots, always four cards, one per slot: an evidenced card
 * REPLACES its unproven card rather than joining it, so the two can never be
 * on screen together.
 */
export function enterpriseStory(evidence: EnterpriseEvidence): EnterpriseStory {
  if (evidence.status === 'unavailable') {
    return {
      sourceLabel: 'Recorded Case',
      outcome: 'Evidence unavailable',
      summary: `This Case's evidence could not be loaded (${evidence.reason}), so nothing is known about its governance controls either way.`,
      cards: SLOTS.map((slot) => unprovenCard(slot, 'unavailable')),
      proofPath: emptyProofPath(),
      tour: [],
      disclosure: null,
      chapters: [],
      narrative: {
        problem: 'The recorded evidence could not be read.',
        action: 'Nothing was evaluated.',
        result: 'No conclusion can be drawn from this page.',
      },
    };
  }

  const { events } = evidence;
  const unreadable = events.some(
    (event) => !SUPPORTED_SCHEMA_VERSIONS.includes(event.schemaVersion),
  );
  if (unreadable) {
    // One unreadable event is enough: this adapter reads chains, and a chain
    // containing an event it cannot interpret cannot be judged either way.
    return {
      sourceLabel: 'Recorded Case',
      outcome: 'Recording uses an unsupported schema',
      summary:
        'This recording contains events in a schema version this build does not read, so its governance controls were not evaluated.',
      cards: SLOTS.map((slot) => unprovenCard(slot, 'unsupported')),
      proofPath: emptyProofPath(),
      tour: [],
      disclosure: null,
      chapters: [],
      narrative: {
        problem: 'The recording uses an event schema this build does not read.',
        action: 'No capability was evaluated.',
        result: 'No conclusion can be drawn from this page.',
      },
    };
  }

  const proofs: Partial<Record<SlotId, Proof>> = {};
  const cards: ProofCard[] = SLOTS.map((slot) => {
    const proof = PROVERS[slot.id](events);
    if (proof === null) return unprovenCard(slot, 'absent');
    proofs[slot.id] = proof;
    return {
      id: slot.id,
      title: proof.claim,
      detail: proof.detail,
      state: 'evidenced',
      tone: proof.tone,
      primaryCaseSequence: proof.primaryCaseSequence,
      primaryEventId: proof.primaryEventId,
      evidenceEventIds: proof.evidenceEventIds,
      ...(proof.agentInstanceId === undefined ? {} : { agentInstanceId: proof.agentInstanceId }),
    };
  });

  const path = proofPathFor(events, proofs);
  const evidencedCount = cards.filter((c) => c.state === 'evidenced').length;
  const completed = ofType(events, 'runtime.completed').length > 0;

  return {
    sourceLabel: 'Recorded Case',
    outcome: completed ? 'Case completed' : 'Case did not record a completion',
    summary: `${evidencedCount} of ${SLOTS.length} governance controls are evidenced in this recording of ${events.length} canonical events.`,
    cards,
    proofPath: path,
    tour: tourFor(path, events),
    disclosure: null,
    chapters: chaptersFor(events),
    narrative: narrativeFor(events),
  };
}
