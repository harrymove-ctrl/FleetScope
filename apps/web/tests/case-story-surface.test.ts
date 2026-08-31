import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(join(process.cwd(), 'apps/web/src/pages/cases/[caseId].astro'), 'utf8');

describe('the simplified Case story', () => {
  it('explains the product value before exposing technical evidence', () => {
    expect(page).toContain('The agent says “done.”');
    expect(page).toContain('FleetScope shows what still needs attention.');
    expect(page).toContain('“Completed” is not the whole story.');
    expect(page.indexOf('Why this is useful')).toBeLessThan(page.indexOf('Show technical details'));
  });

  it('keeps every important claim connected to the recorded Case', () => {
    expect(page).toContain('summary.sessionCount');
    expect(page).toContain('openIncidents.length');
    expect(page).toContain('summary.eventCount');
    expect(page).toContain('data-evidence-open={primaryIncidentEvent.eventId}');
  });

  it('removes the old dashboard-style information wall', () => {
    expect(page).not.toContain('Where this Case stands');
    expect(page).not.toContain('What milestone are we at?');
    expect(page).not.toContain('Recent activity');
    expect(page).not.toContain('Recorded totals');
  });
});
