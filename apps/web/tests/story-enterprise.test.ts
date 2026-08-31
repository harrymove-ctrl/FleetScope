import { describe, expect, it } from 'vitest';
import type { CanonicalEvent } from '@fleetscope/event-schema';
import { loadCanonicalEvents } from '@fleetscope/fixtures/node';
import { activeStep, enterpriseStory, type ProofCard } from '../src/features/story/enterprise';

/**
 * The enterprise adapter, against the real CASE-1042 recording.
 *
 * # What these tests are actually defending
 *
 * A governance card must claim only what the recording proves. The failure this
 * suite exists to catch is a card that reads as satisfied because a control was
 * CONFIGURED — a policy installed, a scanner enabled, a role granted — when no
 * event shows that control acting.
 *
 * So every capability has a removal test: delete one required event and the
 * card must fall to `absent`. A predicate that cannot be broken is not
 * evidence, it is decoration.
 */

const events = loadCanonicalEvents('CASE-1042');

const card = (story: { cards: readonly ProofCard[] }, id: string): ProofCard => {
  const found = story.cards.find((c) => c.id === id);
  if (found === undefined) throw new Error(`no card ${id}`);
  return found;
};

const loaded = (list: readonly CanonicalEvent[]) =>
  enterpriseStory({ status: 'loaded', events: list });

/** The recording minus every event matching `predicate`. */
const without = (predicate: (event: CanonicalEvent) => boolean): CanonicalEvent[] =>
  events.filter((event) => !predicate(event));

const byId = (id: string) => (event: CanonicalEvent) => event.eventId === id;

/** Replace one event, so a chain can be broken by CORRUPTION, not only deletion. */
const patch = (id: string, change: (event: CanonicalEvent) => CanonicalEvent): CanonicalEvent[] =>
  events.map((event) => (event.eventId === id ? change(event) : event));

describe('the recorded CASE-1042 evidence', () => {
  it('evidences all four governance capabilities', () => {
    const story = loaded(events);
    expect(story.cards).toHaveLength(4);
    expect(story.cards.map((c) => c.state)).toEqual([
      'evidenced',
      'evidenced',
      'evidenced',
      'evidenced',
    ]);
  });

  // caseSequence is 0-based: evt-0053 is the 53rd event and sequence 52. An
  // off-by-one here seeks the cursor to the wrong event, which is how a reader
  // ends up reading `identity.denied` as the activation's identity check.
  it('points each card at the canonical event a reviewer must verify', () => {
    const story = loaded(events);
    expect(card(story, 'security').primaryCaseSequence).toBe(15);
    expect(card(story, 'warden').primaryCaseSequence).toBe(30);
    expect(card(story, 'runtime').primaryCaseSequence).toBe(35);
    expect(card(story, 'activation').primaryCaseSequence).toBe(52);
  });

  it('names the events that back each claim, so the claim can be checked', () => {
    const story = loaded(events);
    expect(card(story, 'security').evidenceEventIds).toContain('evt-0016');
    expect(card(story, 'security').evidenceEventIds).toContain('evt-0018');
    expect(card(story, 'warden').evidenceEventIds).toContain('evt-0031');
    expect(card(story, 'runtime').evidenceEventIds).toContain('evt-0036');
    expect(card(story, 'activation').evidenceEventIds).toContain('evt-0053');
  });

  it('attributes a capability to an agent only when the events name one', () => {
    const story = loaded(events);
    expect(card(story, 'warden').agentInstanceId).toBe('agent-logistics-1');
    // Screening is about an input, not an agent. Inventing an owner here would
    // put a graph selection behind a card that has no agent.
    expect(card(story, 'security').agentInstanceId).toBeUndefined();
  });
});

describe('a broken proof chain renders absent, never satisfied', () => {
  it('screening: without the memory rejection, the block alone proves nothing', () => {
    // armor.blocked says an input was flagged. It does not say the flag had any
    // effect. The rejection is what shows the block was enforced.
    expect(card(loaded(without(byId('evt-0018'))), 'security').state).toBe('absent');
  });

  it('screening: a rejection for a different input is not this input"s evidence', () => {
    const corrupted = patch('evt-0018', (event) => ({
      ...event,
      correlations: { ...event.correlations, screenedInputId: 'input-999' },
    }));
    expect(card(loaded(corrupted), 'security').state).toBe('absent');
  });

  it('screening: a tool call between block and rejection means it was not enforced', () => {
    const leaked: CanonicalEvent[] = [
      ...events.slice(0, 16),
      {
        ...events[16]!,
        eventId: 'evt-leak',
        caseSequence: 16,
        type: 'tool.requested',
        payloadRedacted: { tool: 'Vendor.email.read', argumentsRedacted: '[redacted]' },
        correlations: { caseId: 'CASE-1042', screenedInputId: 'input-101' },
      },
      ...events.slice(16),
    ];
    expect(card(loaded(leaked), 'security').state).toBe('absent');
  });

  it('warden: without the auto_act policy, the intervention had no authority', () => {
    expect(card(loaded(without(byId('evt-0031'))), 'warden').state).toBe('absent');
  });

  it('warden: a policy that did not authorize acting is not authority to act', () => {
    const advisory = patch('evt-0031', (event) => ({
      ...event,
      payloadRedacted: { ...event.payloadRedacted, disposition: 'advise_only' },
    }));
    expect(card(loaded(advisory), 'warden').state).toBe('absent');
  });

  it('warden: an incomplete intervention lifecycle is absent', () => {
    // Proposed and requested, never authorized.
    expect(card(loaded(without(byId('evt-0033'))), 'warden').state).toBe('absent');
  });

  it('warden: an intervention belonging to another incident does not close this one', () => {
    const mismatched = patch('evt-0032', (event) => ({
      ...event,
      correlations: { ...event.correlations, incidentId: 'inc-999' },
    }));
    expect(card(loaded(mismatched), 'warden').state).toBe('absent');
  });

  it('warden: an incident that was never resolved is not a recovery', () => {
    // Proposed, authorized, requested, acknowledged — and the incident left
    // open. Every step of the intervention happened and nothing was fixed.
    expect(card(loaded(without(byId('evt-0040'))), 'warden').state).toBe('absent');
  });

  it('warden: two failures are below the threshold the incident recorded', () => {
    expect(card(loaded(without(byId('evt-0029'))), 'warden').state).toBe('absent');
  });

  it('runtime: an applied action with no subsequent progress is not recovery', () => {
    // The retry was applied and then nothing succeeded. "We acted" is not
    // "it worked", and this is the distinction the card exists to make.
    expect(card(loaded(without(byId('evt-0039'))), 'runtime').state).toBe('absent');
  });

  it('runtime: without runtime.controlled, nothing shows the action reached the runtime', () => {
    expect(card(loaded(without(byId('evt-0036'))), 'runtime').state).toBe('absent');
  });

  it('runtime: an incident closed as anything but recovered is not recovery', () => {
    const abandoned = patch('evt-0040', (event) => ({
      ...event,
      payloadRedacted: { ...event.payloadRedacted, resolution: 'abandoned' },
    }));
    expect(card(loaded(abandoned), 'runtime').state).toBe('absent');
  });

  it('activation: activation without an approval is absent, and is the serious case', () => {
    expect(card(loaded(without(byId('evt-0047'))), 'activation').state).toBe('absent');
  });

  it('activation: an approval that was refused does not authorize anything', () => {
    const refused = patch('evt-0047', (event) => ({
      ...event,
      payloadRedacted: { ...event.payloadRedacted, decision: 'rejected' },
    }));
    expect(card(loaded(refused), 'activation').state).toBe('absent');
  });

  it('activation: approval without a referencing activation is absent', () => {
    expect(card(loaded(without(byId('evt-0054'))), 'activation').state).toBe('absent');
  });

  it('activation: a request that cites no approval is not covered by one', () => {
    const uncited = patch('evt-0052', (event) => {
      const rest = { ...(event.payloadRedacted as Record<string, unknown>) };
      delete rest['approvalId'];
      return { ...event, payloadRedacted: rest };
    });
    expect(card(loaded(uncited), 'activation').state).toBe('absent');
  });

  it('activation: an identity decision for a different call does not cover this one', () => {
    const otherCall = patch('evt-0053', (event) => ({
      ...event,
      correlations: { ...event.correlations, toolCallId: 'tc-999' },
    }));
    expect(card(loaded(otherCall), 'activation').state).toBe('absent');
  });

  it('breaking one chain leaves the other three evidenced', () => {
    // A capability is evaluated on its own evidence. One missing chain must not
    // cascade into a page that looks uniformly broken.
    const story = loaded(without(byId('evt-0018')));
    expect(card(story, 'security').state).toBe('absent');
    for (const id of ['warden', 'runtime', 'activation']) {
      expect(card(story, id).state).toBe('evidenced');
    }
  });
});

describe('an absent card makes no claim', () => {
  it('replaces the evidenced card in the same slot rather than joining it', () => {
    const story = loaded(without(byId('evt-0018')));
    // Four fixed slots, one card each, in a stable order.
    expect(story.cards).toHaveLength(4);
    expect(story.cards.filter((c) => c.id === 'security')).toHaveLength(1);
    expect(story.cards.map((c) => c.id)).toEqual(['security', 'warden', 'runtime', 'activation']);
  });

  it('carries no destination, because there is nothing to seek to', () => {
    const absent = card(loaded(without(byId('evt-0018'))), 'security');
    expect(absent.primaryCaseSequence).toBeNull();
    expect(absent.evidenceEventIds).toEqual([]);
  });

  it('names the capability without a claim verb a skimmer would read as an event', () => {
    const absent = card(loaded(without(byId('evt-0018'))), 'security');
    expect(absent.title).toBe('Input screening');
    expect(absent.title).not.toMatch(/blocked|screened|enforced|prevented/i);
  });
});

describe('not knowing is different from knowing there is nothing', () => {
  it('reports unavailable when evidence could not be loaded', () => {
    const story = enterpriseStory({ status: 'unavailable', reason: 'projection failed' });
    expect(story.cards.map((c) => c.state)).toEqual([
      'unavailable',
      'unavailable',
      'unavailable',
      'unavailable',
    ]);
  });

  it('never reports absent when nothing was read', () => {
    // "We looked and it is not there" and "we could not look" lead a reviewer
    // to different actions. Collapsing them is the whole bug.
    const story = enterpriseStory({ status: 'unavailable', reason: 'projection failed' });
    expect(story.cards.some((c) => c.state === 'absent')).toBe(false);
    expect(story.outcome).toMatch(/could not|unavailable/i);
  });

  it('reports unsupported when the stream uses a schema it cannot evaluate', () => {
    const future = events.map((event) => ({ ...event, schemaVersion: '9.9.9' }));
    const story = loaded(future);
    expect(story.cards.map((c) => c.state)).toEqual([
      'unsupported',
      'unsupported',
      'unsupported',
      'unsupported',
    ]);
  });

  it('does not read an unsupported schema as an absence', () => {
    const future = events.map((event) => ({ ...event, schemaVersion: '9.9.9' }));
    expect(loaded(future).cards.some((c) => c.state === 'absent')).toBe(false);
  });
});

describe('the narrative reports the recording, including what went wrong', () => {
  it('names the three failed logistics calls rather than only the recovery', () => {
    const story = loaded(events);
    const text = `${story.summary} ${story.narrative.problem} ${story.narrative.action} ${story.narrative.result}`;
    expect(text).toMatch(/three|3/i);
    expect(text).toMatch(/Logistics\.leadtime\.check/);
  });

  it('names the human approval wait', () => {
    const story = loaded(events);
    const text = `${story.narrative.problem} ${story.narrative.action} ${story.narrative.result}`;
    expect(text).toMatch(/approval|approved/i);
  });

  it('never claims the recording is live', () => {
    const story = loaded(events);
    const text = JSON.stringify(story).toLowerCase();
    expect(text).not.toMatch(/\blive\b|executing now|in progress right now/);
    expect(story.sourceLabel).toMatch(/recorded/i);
  });

  it('includes only chapters whose evidence exists', () => {
    const story = loaded(events);
    const ids = story.chapters.map((c) => c.id);
    expect(ids).toContain('screening');
    expect(ids).toContain('recovery');
    // Every chapter offered must be seekable; a chapter with no event is not
    // shown greyed out, it is omitted.
    expect(story.chapters.every((c) => c.sequence !== null)).toBe(true);
  });

  it('drops the screening chapter when there is no screening evidence', () => {
    const story = loaded(without((e) => e.type === 'armor.blocked'));
    expect(story.chapters.map((c) => c.id)).not.toContain('screening');
  });
});

describe('the Proof Path', () => {
  it('names the six steps in the order the case actually ran', () => {
    const path = loaded(events).proofPath;
    expect(path.map((step) => step.id)).toEqual([
      'delegate',
      'remember',
      'screen',
      'recover',
      'approve',
      'activate',
    ]);
  });

  it('gives every reached step a canonical event to seek to', () => {
    const path = loaded(events).proofPath;
    for (const step of path.filter((s) => s.state === 'reached')) {
      expect(step.caseSequence).not.toBeNull();
    }
  });

  it('reaches every step in the recorded case', () => {
    const path = loaded(events).proofPath;
    expect(path.every((step) => step.state === 'reached')).toBe(true);
  });

  it('marks a step not-reached rather than inventing a destination', () => {
    // Remove the approval entirely: the step must go dark AND lose its
    // destination, because seeking to "roughly where it would have been" is
    // how a reader ends up reading an unrelated event as the approval.
    const story = loaded(without((event) => event.type === 'human_escalation.opened'));
    const approve = story.proofPath.find((step) => step.id === 'approve');
    expect(approve?.state).toBe('not-reached');
    expect(approve?.caseSequence).toBeNull();
  });

  it('keeps the step order stable when a step is not reached', () => {
    // The path is a shape the reader learns. It must not reflow when one step
    // is missing, or the missing step becomes invisible instead of obvious.
    const story = loaded(without((event) => event.type === 'human_escalation.opened'));
    expect(story.proofPath.map((step) => step.id)).toEqual([
      'delegate',
      'remember',
      'screen',
      'recover',
      'approve',
      'activate',
    ]);
  });

  it('reports no reached step when evidence is unavailable', () => {
    const story = enterpriseStory({ status: 'unavailable', reason: 'projection failed' });
    expect(story.proofPath.every((step) => step.state === 'not-reached')).toBe(true);
    expect(story.proofPath.every((step) => step.caseSequence === null)).toBe(true);
  });

  it('labels each step with a verb a reader can follow without the vocabulary', () => {
    const path = loaded(events).proofPath;
    expect(path.map((step) => step.title)).toEqual([
      'Delegate',
      'Remember',
      'Screen',
      'Recover',
      'Approve',
      'Activate',
    ]);
  });
});

describe('the active step follows the Event Cursor', () => {
  it('is the last step at or before the cursor', () => {
    const path = loaded(events).proofPath;
    // Cursor on the activation identity check: every earlier step is done.
    expect(activeStep(path, 52)?.id).toBe('activate');
    // Cursor in the middle of the recovery.
    expect(activeStep(path, 36)?.id).toBe('recover');
  });

  it('is the EARLIEST step when the cursor sits before every step', () => {
    // Earliest by sequence. At sequence 0 nothing has been reached yet, and the
    // next thing that happens in this Case is the delegation at sequence 3.
    const path = loaded(events).proofPath;
    expect(activeStep(path, 0)?.id).toBe('delegate');
  });

  it('never selects a step that was not reached', () => {
    const story = loaded(without((event) => event.type === 'human_escalation.opened'));
    const active = activeStep(story.proofPath, 46);
    expect(active?.id).not.toBe('approve');
  });
});

describe('the Proof Path reads as a narrative, but the cursor is chronological', () => {
  it('displays its steps in the order they actually happened', () => {
    // A connected left-to-right path reads as a timeline, so it has to BE one.
    // Anything else is a claim about chronology that the recording contradicts.
    const path = loaded(events).proofPath;
    const anchors = path.map((step) => step.caseSequence!);
    for (let i = 1; i < anchors.length; i += 1) {
      expect(anchors[i]).toBeGreaterThan(anchors[i - 1]!);
    }
  });

  it('picks the active step by sequence, not by position in the path', () => {
    // Now that display order matches chronology these agree, but the rule must
    // stay chronological: it is what keeps the two from silently diverging if a
    // step is ever re-ordered for storytelling again.
    const path = loaded(events).proofPath;
    expect(activeStep(path, 15)?.id).toBe('screen');
    expect(activeStep(path, 10)?.id).toBe('remember');
    expect(activeStep(path, 3)?.id).toBe('delegate');
  });

  it('stays on the latest reached step when the cursor runs past all of them', () => {
    const path = loaded(events).proofPath;
    expect(activeStep(path, 59)?.id).toBe('activate');
  });
});

describe('a card opens the evidence it points at', () => {
  it('names the event AT the destination, not the first link of the chain', () => {
    const story = loaded(events);
    // The Warden chain opens with the incident (evt-0030) but the card points
    // at the policy that authorized acting (evt-0031). Opening the drawer on
    // the first link would show the wrong end of the proof.
    expect(card(story, 'warden').primaryEventId).toBe('evt-0031');
    expect(card(story, 'warden').evidenceEventIds[0]).toBe('evt-0030');

    expect(card(story, 'security').primaryEventId).toBe('evt-0016');
    expect(card(story, 'runtime').primaryEventId).toBe('evt-0036');
    expect(card(story, 'activation').primaryEventId).toBe('evt-0053');
  });

  it('has no evidence to open when the card is not evidenced', () => {
    expect(card(loaded(without(byId('evt-0018'))), 'security').primaryEventId).toBeNull();
  });
});

describe('the Guided Evidence Tour', () => {
  it('walks the six steps in the order the Case ran them', () => {
    const tour = loaded(events).tour;
    expect(tour.map((step) => step.id)).toEqual([
      'delegate',
      'remember',
      'screen',
      'recover',
      'approve',
      'activate',
    ]);
  });

  it('lands each step on the canonical event it talks about', () => {
    const tour = loaded(events).tour;
    const at = (id: string) => tour.find((step) => step.id === id)?.caseSequence;
    expect(at('screen')).toBe(15);
    expect(at('recover')).toBe(35);
    expect(at('activate')).toBe(52);
    // Every destination is a real event in the recording.
    for (const step of tour) {
      expect(events.some((event) => event.caseSequence === step.caseSequence)).toBe(true);
    }
  });

  it('advances monotonically, so Next never goes backwards', () => {
    const tour = loaded(events).tour;
    for (let i = 1; i < tour.length; i += 1) {
      expect(tour[i]!.caseSequence).toBeGreaterThan(tour[i - 1]!.caseSequence);
    }
  });

  it('says what happened and why it matters, in plain language', () => {
    for (const step of loaded(events).tour) {
      expect(step.heading.length).toBeGreaterThan(10);
      expect(step.what.length).toBeGreaterThan(10);
      expect(step.why.length).toBeGreaterThan(10);
      // A heading a reader can act on, not a schema name.
      expect(step.heading).not.toMatch(/[a-z]+\.[a-z_]+/);
    }
  });

  it('carries the evidence event each step claims', () => {
    const tour = loaded(events).tour;
    const at = (id: string) => tour.find((step) => step.id === id)?.evidenceEventId;
    expect(at('screen')).toBe('evt-0016');
    expect(at('recover')).toBe('evt-0036');
    expect(at('activate')).toBe('evt-0053');
  });

  it('states each step status in words, not colour alone', () => {
    for (const step of loaded(events).tour) {
      expect(step.status.length).toBeGreaterThan(0);
      expect(step.icon.length).toBeGreaterThan(0);
    }
  });

  it('offers no tour when the evidence could not be read', () => {
    // A tour through nothing would walk a reader past six confident headings
    // with no evidence behind any of them.
    expect(enterpriseStory({ status: 'unavailable', reason: 'x' }).tour).toEqual([]);
  });

  it('drops a step whose evidence is missing rather than inventing a stop', () => {
    const story = loaded(without((event) => event.type === 'human_escalation.opened'));
    expect(story.tour.map((step) => step.id)).not.toContain('approve');
    // And the rest still advances monotonically.
    for (let i = 1; i < story.tour.length; i += 1) {
      expect(story.tour[i]!.caseSequence).toBeGreaterThan(story.tour[i - 1]!.caseSequence);
    }
  });
});
