/**
 * The launch chapter manifest.
 *
 * # Why this exists
 *
 * The launchpad carousel is a visual object, and a visual object is exactly
 * where a product starts lying: a card is cheap to draw and expensive to
 * verify, so a row of them drifts into claiming runs that never happened.
 * This module makes the manifest finite, typed and validated, so a card cannot
 * exist on screen without a provenance the build can defend.
 *
 * Three rules are enforced here rather than trusted to a template:
 *
 * 1. A card without an `eventRef` may not say an event happened. It describes
 *    a capability, not a run.
 * 2. A `live` card is withheld until a fresh capability response says the
 *    bounded live path is actually reachable. Absent proof it is not rendered
 *    as a greyed-out promise; it is simply not there.
 * 3. The carousel may repeat meshes for an infinite visual loop, but identity
 *    is the manifest id. A clone index is never an event key, a route, or a
 *    counter value.
 *
 * See docs/design/fleetscope-frontend-experience.md section 7.
 */

/** Where a chapter's claim comes from. Rendered as a word, never as a colour. */
export type ChapterProvenance = 'bundled' | 'recorded' | 'live';

/** Accent role. Decorative only — it never carries meaning on its own. */
export type ChapterAccent = 'neutral' | 'cyan' | 'violet' | 'orange';

/** A pointer into a canonical event stream. Its presence is what licenses past tense. */
export interface ChapterEventRef {
  readonly runId: string;
  readonly sequence: number;
}

export interface LaunchChapter {
  readonly id: string;
  /** Short locator shown above the row, e.g. "03 — Govern". */
  readonly label: string;
  readonly title: string;
  /** Caption revealed in focus mode. One sentence, factual. */
  readonly summary: string;
  /**
   * What the feature actually does, for a reader who wants more than the
   * caption. Held to the same rule as everything else here: without an
   * `eventRef` it describes a capability, never a run that happened.
   */
  readonly detail: string;
  readonly route: string;
  /** Card artwork. Captured from the running product by `pnpm shots`. */
  readonly src: string;
  /** Width / height. Every card is the same height and varies in width. */
  readonly aspect: number;
  readonly provenance: ChapterProvenance;
  readonly accent: ChapterAccent;
  /**
   * The agents this chapter is about, by their id in the bundled session.
   *
   * Faces are drawn from these ids, so they are as factual as everything else
   * on the card: a chapter that does not concern a specific set of agents
   * carries none rather than a decorative crowd.
   */
  readonly agents?: readonly string[];
  /** Present only when a canonical event backs the chapter's claim. */
  readonly eventRef?: ChapterEventRef;
}

/** Every card is captured at this ratio, so the row spacing is uniform. */
const CARD_ASPECT = 900 / 1160;

/**
 * The shipped manifest.
 *
 * Each card is a real route of this build, photographed by
 * `scripts/capture-product-shots.ts`. Nothing here is generated artwork or a
 * mockup: the row is the product, in the order a visitor would meet it.
 *
 * Titles are factual. `bundled` means the artifact is in this build;
 * `recorded` means it is a fixture of a run that was captured. Neither is a
 * live claim, and no card carries `live` provenance because this build cannot
 * prove one.
 */
export const LAUNCH_CHAPTERS: readonly LaunchChapter[] = [
  {
    id: 'viewer',
    label: 'FleetScope',
    title: 'Watch agent work become evidence',
    summary:
      'A local Gemini or Antigravity session, projected in your browser. The file never leaves this machine.',
    detail:
      'Point it at a session file already on disk and it draws the run: which agents started, what each called, where a tool returned nothing. Reading is all it does — it cannot start an agent, cannot retry a call, and never uploads the file.',
    route: '/viewer',
    src: '/product/viewer.png',
    aspect: CARD_ASPECT,
    agents: ['coordinator', 'flight_search', 'hotel_search', 'itinerary_writer'],
    provenance: 'bundled',
    accent: 'cyan',
  },
  {
    id: 'dashboard',
    label: '01 — Setup',
    title: 'What this browser can actually check',
    summary:
      'The runtime and the formats it loaded are probed. Installing the CLI and picking a session are marked manual, never inferred.',
    detail:
      'It reports only what this browser can be asked directly: the runtime it is on and the session formats it can parse. Anything it cannot verify from here — whether the CLI is installed, which session you mean — is listed as a step for you, not guessed at and shown as a status.',
    route: '/dashboard',
    src: '/product/dashboard.png',
    aspect: CARD_ASPECT,
    provenance: 'bundled',
    accent: 'cyan',
  },
  {
    id: 'observe',
    label: '02 — Observe',
    title: 'Four agents, twenty events, one graph',
    summary:
      'Detection, parsing and the fold are one Rust core. The terminal and this browser run the same projection.',
    detail:
      'Detection, parsing and the fold live in one Rust core compiled to WebAssembly, so the terminal and this page are not two implementations that agree by luck. The same bytes produce the same graph in both, which is what makes a screenshot worth anything as evidence.',
    route: '/viewer',
    src: '/product/viewer.png',
    aspect: CARD_ASPECT,
    agents: ['coordinator', 'flight_search', 'hotel_search', 'itinerary_writer'],
    provenance: 'bundled',
    accent: 'violet',
  },
  {
    id: 'cases',
    label: '03 — Cases',
    title: 'Every run that has been recorded',
    summary: 'A Case is a run plus the evidence behind it. Open one to follow what happened.',
    detail:
      'A Case is one run together with the events behind it, kept as a unit so a claim and its evidence cannot drift apart. Open one and you are reading the record, not a summary written over it.',
    route: '/cases',
    src: '/product/cases.png',
    aspect: CARD_ASPECT,
    provenance: 'recorded',
    accent: 'neutral',
  },
  {
    id: 'govern',
    label: '04 — Govern',
    title: 'Every claim points at an event',
    summary:
      'The recorded recovery, with each governance step linked to the canonical event that evidences it.',
    detail:
      'Each governance step carries the id of the event that licenses it. Where no event backs a step, the step is absent rather than shown as pending — a gap you can see beats a status you cannot check.',
    route: '/cockpit/CASE-1042',
    src: '/product/cockpit.png',
    aspect: CARD_ASPECT,
    agents: ['coordinator', 'flight_search', 'hotel_search', 'itinerary_writer'],
    provenance: 'recorded',
    accent: 'orange',
    eventRef: { runId: 'CASE-1042', sequence: 1 },
  },
  {
    id: 'approvals',
    label: '05 — Approvals',
    title: 'Decisions that needed a person',
    summary: 'An approval is event-backed or it is not shown. There is no implied consent here.',
    detail:
      'An approval appears only when a canonical event records a person making it. Silence, a timeout, or a default is not consent, and none of them will render here as one.',
    route: '/approvals',
    src: '/product/approvals.png',
    aspect: CARD_ASPECT,
    provenance: 'recorded',
    accent: 'orange',
  },
  {
    id: 'catalog',
    label: '06 — Catalog',
    title: 'Which agent version may be launched',
    summary: 'A catalog entry records an approved version. It is not proof that anything ran.',
    detail:
      'An entry records that a version was approved for launch. That is a permission and nothing more: it is not evidence that the version ran, and this page will not imply otherwise.',
    route: '/catalog',
    src: '/product/catalog.png',
    aspect: CARD_ASPECT,
    provenance: 'recorded',
    accent: 'neutral',
  },
  {
    id: 'audit',
    label: '07 — Audit',
    title: 'Reconstruct the whole record',
    summary:
      'A read-only projection of every canonical event in the Case. Replay causes no side effects.',
    detail:
      'A read-only projection of every canonical event in the Case, in order, with nothing collapsed. Replaying it computes a view and writes nothing back, so an investigation cannot change what it is investigating.',
    route: '/audit/CASE-1042',
    src: '/product/audit.png',
    aspect: CARD_ASPECT,
    agents: ['coordinator', 'flight_search', 'hotel_search', 'itinerary_writer'],
    provenance: 'recorded',
    accent: 'violet',
    eventRef: { runId: 'CASE-1042', sequence: 60 },
  },
];

/** Human-readable provenance label. Colour never carries this meaning alone. */
export function provenanceLabel(provenance: ChapterProvenance): string {
  switch (provenance) {
    case 'bundled':
      return 'Bundled';
    case 'recorded':
      return 'Recorded';
    case 'live':
      return 'Live';
  }
}

/**
 * Whether a chapter is allowed to describe something that already happened.
 *
 * Without an event reference the copy must stay in the present tense of a
 * capability. This is the single check that keeps a decorative card from
 * becoming an unbacked assertion.
 */
export function claimsPastEvent(chapter: LaunchChapter): boolean {
  return chapter.eventRef !== undefined;
}

export interface ManifestProblem {
  readonly chapterId: string;
  readonly problem: string;
}

/**
 * Validate a manifest. Pure and total: it reports every problem rather than
 * throwing on the first, so a build surfaces the whole list at once.
 */
export function validateChapters(chapters: readonly LaunchChapter[]): readonly ManifestProblem[] {
  const problems: ManifestProblem[] = [];
  const seen = new Set<string>();

  for (const chapter of chapters) {
    if (seen.has(chapter.id)) {
      problems.push({ chapterId: chapter.id, problem: 'duplicate id' });
    }
    seen.add(chapter.id);

    if (chapter.id.trim() === '') {
      problems.push({ chapterId: chapter.id, problem: 'empty id' });
    }
    if (chapter.title.trim() === '') {
      problems.push({ chapterId: chapter.id, problem: 'empty title' });
    }
    if (chapter.summary.trim() === '') {
      problems.push({ chapterId: chapter.id, problem: 'empty summary' });
    }
    if (!chapter.route.startsWith('/')) {
      problems.push({ chapterId: chapter.id, problem: 'route must be a site-relative path' });
    }
    if (!chapter.src.startsWith('/')) {
      problems.push({ chapterId: chapter.id, problem: 'src must be a site-relative path' });
    }
    if (!Number.isFinite(chapter.aspect) || chapter.aspect <= 0) {
      problems.push({ chapterId: chapter.id, problem: 'aspect must be a positive number' });
    }
    if (chapter.label.trim() === '') {
      problems.push({ chapterId: chapter.id, problem: 'empty label' });
    }
    // A live claim is the one provenance a static build can never satisfy on
    // its own, so the manifest may not hardcode one.
    if (chapter.provenance === 'live' && chapter.eventRef === undefined) {
      problems.push({ chapterId: chapter.id, problem: 'live provenance requires an eventRef' });
    }
    if (chapter.eventRef !== undefined && !Number.isInteger(chapter.eventRef.sequence)) {
      problems.push({ chapterId: chapter.id, problem: 'eventRef.sequence must be an integer' });
    }
    if (chapter.eventRef !== undefined && chapter.eventRef.sequence < 0) {
      problems.push({ chapterId: chapter.id, problem: 'eventRef.sequence must not be negative' });
    }
  }

  return problems;
}

/**
 * The chapters a visitor may actually see.
 *
 * A `live` chapter is admitted only while a capability response says the
 * bounded path is reachable. When it is not, the card is removed rather than
 * disabled: a dimmed control still advertises a capability the build cannot
 * demonstrate.
 */
export function visibleChapters(
  chapters: readonly LaunchChapter[],
  options: { readonly liveVerified: boolean },
): readonly LaunchChapter[] {
  return chapters.filter((chapter) => chapter.provenance !== 'live' || options.liveVerified);
}
