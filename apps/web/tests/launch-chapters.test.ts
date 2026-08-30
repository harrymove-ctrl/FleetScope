import { describe, expect, it } from 'vitest';
import {
  LAUNCH_CHAPTERS,
  claimsPastEvent,
  provenanceLabel,
  validateChapters,
  visibleChapters,
  type LaunchChapter,
} from '../src/features/launch/chapters';

/**
 * A carousel card is cheap to draw and expensive to verify, which is why the
 * manifest is validated rather than trusted. These tests are the difference
 * between a decorative row and a row that cannot assert a run that never
 * happened.
 */

const base: LaunchChapter = {
  id: 'observe',
  label: '01 — Observe',
  title: 'Observe',
  summary: 'Open a local session.',
  route: '/viewer',
  src: '/product/viewer.png',
  aspect: 1.6,
  provenance: 'bundled',
  accent: 'cyan',
};

describe('the shipped manifest', () => {
  it('is valid', () => {
    expect(validateChapters(LAUNCH_CHAPTERS)).toEqual([]);
  });

  it('ships no live card, because a static build cannot prove one', () => {
    expect(LAUNCH_CHAPTERS.some((chapter) => chapter.provenance === 'live')).toBe(false);
  });

  it('has a unique id per chapter', () => {
    const ids = new Set(LAUNCH_CHAPTERS.map((chapter) => chapter.id));
    expect(ids.size).toBe(LAUNCH_CHAPTERS.length);
  });

  it('only lets a chapter with an event reference speak in the past tense', () => {
    for (const chapter of LAUNCH_CHAPTERS) {
      if (claimsPastEvent(chapter)) continue;
      // No eventRef means no completed-run vocabulary anywhere in the copy.
      expect(chapter.summary.toLowerCase()).not.toMatch(/\b(recovered|resolved|completed)\b/);
    }
  });

  it('gives every card artwork and a uniform aspect', () => {
    // The row's spacing is derived from the aspect, so one odd card would
    // silently misalign every card after it.
    const aspects = new Set(LAUNCH_CHAPTERS.map((chapter) => chapter.aspect));
    expect(aspects.size).toBe(1);
    for (const chapter of LAUNCH_CHAPTERS) {
      expect(chapter.src.startsWith('/product/')).toBe(true);
    }
  });

  it('gives every card a locator label', () => {
    for (const chapter of LAUNCH_CHAPTERS) {
      expect(chapter.label.trim()).not.toBe('');
    }
  });
});

describe('validateChapters', () => {
  it('rejects a duplicate id', () => {
    const problems = validateChapters([base, { ...base, title: 'Other' }]);
    expect(problems).toContainEqual({ chapterId: 'observe', problem: 'duplicate id' });
  });

  it('rejects an off-site route', () => {
    const problems = validateChapters([{ ...base, route: 'https://example.com' }]);
    expect(problems).toContainEqual({
      chapterId: 'observe',
      problem: 'route must be a site-relative path',
    });
  });

  it('rejects a live card with no event behind it', () => {
    const problems = validateChapters([{ ...base, provenance: 'live' }]);
    expect(problems).toContainEqual({
      chapterId: 'observe',
      problem: 'live provenance requires an eventRef',
    });
  });

  it('rejects card artwork that is not a site-relative path', () => {
    const problems = validateChapters([{ ...base, src: 'https://example.com/x.png' }]);
    expect(problems).toContainEqual({
      chapterId: 'observe',
      problem: 'src must be a site-relative path',
    });
  });

  it('rejects a non-positive aspect', () => {
    expect(validateChapters([{ ...base, aspect: 0 }])).toHaveLength(1);
    expect(validateChapters([{ ...base, aspect: Number.NaN }])).toHaveLength(1);
  });

  it('rejects a non-integer or negative sequence', () => {
    expect(validateChapters([{ ...base, eventRef: { runId: 'r', sequence: 1.5 } }])).toHaveLength(
      1,
    );
    expect(validateChapters([{ ...base, eventRef: { runId: 'r', sequence: -1 } }])).toHaveLength(1);
  });

  it('reports every problem rather than the first', () => {
    const problems = validateChapters([{ ...base, title: '  ', summary: '', route: 'nope' }]);
    expect(problems.length).toBeGreaterThanOrEqual(3);
  });
});

describe('visibleChapters', () => {
  const live: LaunchChapter = {
    ...base,
    id: 'live',
    provenance: 'live',
    eventRef: { runId: 'run-1', sequence: 4 },
  };

  it('withholds a live card until a capability response verifies it', () => {
    expect(visibleChapters([base, live], { liveVerified: false })).toEqual([base]);
  });

  it('admits the live card once verified', () => {
    expect(visibleChapters([base, live], { liveVerified: true })).toHaveLength(2);
  });

  it('never removes a bundled or recorded card', () => {
    // The offline path has to survive every capability answer.
    const recorded: LaunchChapter = { ...base, id: 'govern', provenance: 'recorded' };
    expect(visibleChapters([base, recorded], { liveVerified: false })).toHaveLength(2);
  });
});

describe('provenanceLabel', () => {
  it('gives every provenance a word, so colour is never the only signal', () => {
    expect(provenanceLabel('bundled')).toBe('Bundled');
    expect(provenanceLabel('recorded')).toBe('Recorded');
    expect(provenanceLabel('live')).toBe('Live');
  });
});
