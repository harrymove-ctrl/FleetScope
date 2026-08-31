import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BUNDLED_CREW,
  heldSeconds,
  trackOffset,
  trackWidth,
  type CrewMember,
} from '../src/features/launch/crew';

/**
 * `BUNDLED_CREW` is transcribed rather than read, because the module is
 * bundled for the browser. Transcription is where numbers rot, so this
 * recomputes every one of them from the session file the cards cite.
 */
interface SessionEvent {
  readonly author: string;
  readonly timestamp: number;
  readonly errorCode?: string;
  readonly errorMessage?: string;
}

const events: SessionEvent[] = readFileSync(
  new URL(
    '../../../crates/fleetscope-cli/tests/fixtures/gemini-multi-agent/session.jsonl',
    import.meta.url,
  ),
  'utf8',
)
  .split('\n')
  .filter((line) => line.trim().length > 0)
  .map((line) => JSON.parse(line) as SessionEvent);

const origin = Math.min(...events.map((event) => event.timestamp));
const round = (value: number) => Math.round(value * 10) / 10;

describe('the bundled crew is the session on disk', () => {
  it('spans the run the session actually took', () => {
    const last = Math.max(...events.map((event) => event.timestamp));
    expect(BUNDLED_CREW.runSeconds).toBeCloseTo(round(last - origin), 5);
  });

  it('gives every member the window it actually held', () => {
    for (const member of BUNDLED_CREW.members) {
      const mine = events.filter((event) => event.author === member.id);
      expect(mine.length).toBeGreaterThan(0);
      expect(member.start).toBeCloseTo(
        round(Math.min(...mine.map((event) => event.timestamp)) - origin),
        5,
      );
      expect(member.end).toBeCloseTo(
        round(Math.max(...mine.map((event) => event.timestamp)) - origin),
        5,
      );
    }
  });

  it('claims a fault only where the run recorded one, in its own words', () => {
    for (const member of BUNDLED_CREW.members) {
      const failure = events.find((event) => event.author === member.id && event.errorCode);
      if (failure) expect(member.fault).toBe(failure.errorMessage);
      else expect(member.fault).toBeUndefined();
    }
  });

  it('names no agent the session does not contain', () => {
    const authors = new Set(events.map((event) => event.author));
    for (const member of BUNDLED_CREW.members) expect(authors.has(member.id)).toBe(true);
  });
});

describe('track geometry', () => {
  const run = BUNDLED_CREW.runSeconds;

  it('keeps every bar inside the track', () => {
    for (const member of BUNDLED_CREW.members) {
      const offset = trackOffset(member, run);
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset + trackWidth(member, run)).toBeLessThanOrEqual(100.0001);
    }
  });

  it('leaves a mark for an agent that answered instantly', () => {
    const instant: CrewMember = { id: 'x', start: 10, end: 10 };
    expect(heldSeconds(instant)).toBe(0);
    expect(trackWidth(instant, run)).toBeGreaterThan(0);
  });

  it('does not let the floor push a late bar past the end', () => {
    const atTheEnd: CrewMember = { id: 'x', start: run, end: run };
    expect(trackOffset(atTheEnd, run) + trackWidth(atTheEnd, run)).toBeLessThanOrEqual(100.0001);
  });

  it('orders the bars by how long each agent held the run', () => {
    const widest = [...BUNDLED_CREW.members].sort((a, b) => heldSeconds(b) - heldSeconds(a));
    expect(widest[0]?.id).toBe('coordinator');
    // The point of the whole component: the stall is the second-widest bar.
    expect(widest[1]?.id).toBe('hotel_search');
    expect(widest[1]?.fault).toBeDefined();
  });

  it('survives a degenerate run without dividing by zero', () => {
    const member: CrewMember = { id: 'x', start: 0, end: 0 };
    expect(trackOffset(member, 0)).toBe(0);
    expect(Number.isFinite(trackWidth(member, 0))).toBe(true);
  });
});
