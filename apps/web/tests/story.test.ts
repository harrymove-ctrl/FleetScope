import { describe, expect, it } from 'vitest';
import {
  absenceDisclosure,
  chaptersFrom,
  localStory,
  type StoryCapabilities,
  type StoryFacts,
} from '../src/features/story/story';

/**
 * Story Mode's whole risk is saying something the session cannot evidence.
 * These tests are the guard: a local session must never produce a governance
 * claim, and its limits must be stated once rather than dressed as content.
 */

const NONE: StoryCapabilities = {
  hasSecurityEvidence: false,
  hasWardenEvidence: false,
  hasActivationEvidence: false,
  hasRuntimeRecovery: false,
};

const demo: StoryFacts = {
  agentCount: 4,
  completedCount: 3,
  failedCount: 1,
  unreportedCount: 0,
  eventCount: 20,
  errorCount: 2,
  unansweredCallCount: 1,
  failedAgent: 'hotel_search',
  failureDetail: 'search_hotels: upstream rate limit',
  capabilities: NONE,
};

/** Words that assert something happened. None may appear anywhere local. */
const CLAIM_WORDS = [
  'blocked',
  'recovered',
  'activated',
  'retried',
  'authorized',
  'confirmed',
  'sanitized',
  'approved',
];

describe('the local session story', () => {
  const story = localStory(demo, []);

  it('labels its source instead of leaving it to the URL', () => {
    expect(story.sourceLabel).toBe('Local Session');
  });

  it('answers what happened in the headline and one sentence', () => {
    expect(story.outcome).toBe('Session completed with 1 failed agent');
    expect(story.summary).toContain('hotel_search failed');
  });

  it('produces exactly the four evidenced cards from real counts', () => {
    expect(story.cards.map((card) => card.title)).toEqual([
      '4 agents ran',
      'hotel_search failed',
      '1 call did not return',
      '3 of 4 completed',
    ]);
    expect(story.cards.every((card) => card.state === 'evidenced')).toBe(true);
  });

  it('states its limit once rather than as four cards', () => {
    // Four "not present" cards were honest but gave absences the same visual
    // weight as facts and doubled the card count. One line says the same thing
    // without competing for attention.
    expect(story.disclosure).toBe(
      'Local session only — enterprise security and recovery controls are not part of this recording.',
    );
  });

  it('NEVER claims or names a governance outcome anywhere', () => {
    // The failure this module exists to prevent. A local session records no
    // screening, no policy, no runtime control and no activation.
    const everything = `${story.outcome} ${story.summary} ${story.disclosure ?? ''} ${story.cards
      .map((card) => `${card.title} ${card.detail}`)
      .join(' ')} ${Object.values(story.narrative).join(' ')}`.toLowerCase();
    for (const word of CLAIM_WORDS) {
      expect(everything, `the local story claims "${word}"`).not.toContain(word);
    }
    for (const forbidden of ['warden', 'model armor', 'vendor activation']) {
      expect(everything, `the local story names "${forbidden}"`).not.toContain(forbidden);
    }
  });

  it('does not claim FleetScope acted on the run', () => {
    // The viewer observes a local session. Saying it recovered anything would
    // be the same overclaim as a Warden card.
    expect(story.narrative.action).toContain('did not start, control or recover');
  });

  it('reads correctly when nothing failed', () => {
    const healthy = localStory(
      {
        ...demo,
        failedCount: 0,
        errorCount: 0,
        unansweredCallCount: 0,
        failedAgent: null,
        failureDetail: null,
        completedCount: 4,
      },
      [],
    );
    expect(healthy.outcome).toBe('Session completed');
    expect(healthy.narrative.problem).toBe('No agent reported a failure.');
    expect(healthy.cards.some((card) => card.id === 'failure')).toBe(false);
  });

  it('uses singular and plural correctly', () => {
    const one = localStory({ ...demo, agentCount: 1, completedCount: 1, eventCount: 1 }, []);
    expect(one.cards[0]?.title).toBe('1 agent ran');
    expect(one.cards[0]?.detail).toBe('1 event recorded');
  });
});

describe('the capability disclosure', () => {
  it('appears when the route cannot evidence governance', () => {
    expect(absenceDisclosure(NONE)).toContain('Local session only');
  });

  it('disappears once every capability is evidenced', () => {
    // The enterprise adapter passes true for all four, and the line goes away
    // rather than becoming a permanent caveat on a route that can prove itself.
    expect(
      absenceDisclosure({
        hasSecurityEvidence: true,
        hasWardenEvidence: true,
        hasActivationEvidence: true,
        hasRuntimeRecovery: true,
      }),
    ).toBeNull();
  });
});

describe('chapters', () => {
  const events = [
    { sequence: 0, agentId: 'coordinator' },
    { sequence: 3, agentId: 'coordinator/flight' },
    { sequence: 9, agentId: 'coordinator/hotel' },
    { sequence: 19, agentId: 'coordinator' },
  ];
  const agents = [
    { id: 'coordinator', label: 'coordinator' },
    { id: 'coordinator/flight', label: 'flight' },
    { id: 'coordinator/hotel', label: 'hotel' },
  ];

  it('opens on the first event and closes on the last', () => {
    const chapters = chaptersFrom(events, agents);
    expect(chapters.at(0)).toEqual({ id: 'start', title: 'Start', sequence: 0 });
    expect(chapters.at(-1)).toEqual({ id: 'result', title: 'Result', sequence: 19 });
  });

  it('gives every chapter a canonical sequence to seek by', () => {
    // Not an array index. Chapters seek the same way a timeline row does.
    expect(chaptersFrom(events, agents).map((c) => c.sequence)).toEqual([0, 3, 9, 19]);
  });

  it('is empty for a session with no events', () => {
    expect(chaptersFrom([], agents)).toEqual([]);
  });
});
