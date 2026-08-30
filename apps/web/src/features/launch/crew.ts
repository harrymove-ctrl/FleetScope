/**
 * The bundled session's crew, as a track rather than a row of faces.
 *
 * A presence avatar normally answers "who is here now" with a coloured dot.
 * Nothing here is here now: this session was recorded and shipped with the
 * build, and `AgentIdentity` exists precisely so a recorded agent can never
 * look online. So presence is read from the record instead — when each agent
 * held the run, for how long, and where one of them failed.
 *
 * The numbers are transcribed from the session file the cards already cite,
 * and `launch-crew.test.ts` recomputes them from that file, so they cannot
 * drift from it silently. They are literals rather than a build-time read
 * because this module is bundled for the browser, which has no `node:fs`.
 */
export interface CrewMember {
  readonly id: string;
  /** Seconds after the session's first event. */
  readonly start: number;
  readonly end: number;
  /** The recorded failure, in the words the run itself used. */
  readonly fault?: string;
}

export interface CrewRun {
  readonly runSeconds: number;
  readonly members: readonly CrewMember[];
}

export const BUNDLED_CREW: CrewRun = {
  runSeconds: 49.5,
  members: [
    { id: 'coordinator', start: 1.2, end: 49.5 },
    { id: 'flight_search', start: 3.4, end: 7.5 },
    {
      id: 'hotel_search',
      start: 9.1,
      end: 43.0,
      fault: 'search_hotels did not return within 30s',
    },
    { id: 'itinerary_writer', start: 45.8, end: 48.9 },
  ],
};

export function heldSeconds(member: CrewMember): number {
  return Math.max(0, member.end - member.start);
}

function fraction(value: number, runSeconds: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(runSeconds) || runSeconds <= 0) return 0;
  return Math.min(1, Math.max(0, value / runSeconds));
}

/**
 * Where a member's bar starts, as a percentage of the track.
 */
export function trackOffset(member: CrewMember, runSeconds: number): number {
  return fraction(member.start, runSeconds) * 100;
}

/**
 * How wide that bar is.
 *
 * Floored so an agent that answered instantly still leaves a mark — a bar of
 * zero width would read as "did not run", which is a different claim — and
 * clamped so the floor can never push it past the end of the track.
 */
export function trackWidth(member: CrewMember, runSeconds: number, floor = 1.5): number {
  const offset = trackOffset(member, runSeconds);
  const room = Math.max(0, 100 - offset);
  const held = fraction(heldSeconds(member), runSeconds) * 100;
  return Math.min(room, Math.max(Math.min(floor, room), held));
}
