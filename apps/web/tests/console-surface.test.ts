import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');

describe('judge Cloud Console', () => {
  it('is a feature-surface page that never starts Vertex', () => {
    const page = read('apps/web/src/pages/console.astro');
    const nav = read('apps/web/src/components/Nav.astro');
    const plan = read('apps/web/src/components/AssistantPlan.astro');
    expect(page).toContain('data-gcp-console');
    expect(page).toContain('data-console-tab="run"');
    expect(page).toContain('data-console-tab="storage"');
    expect(page).toContain('data-console-tab="session"');
    expect(page).toContain('data-console-tab="invoke"');
    expect(page).not.toContain('--run');
    expect(page).toContain('Do not run it from this page');
    expect(nav).toContain("href: '/console'");
    expect(plan).toContain('Open judge Cloud Console');
    expect(plan).toContain('CONSOLE_APP_PATH');
  });

  it('keeps the web snapshot aligned with the API evidence', () => {
    const api = read('apps/api/src/cloud/evidence.ts');
    const web = read('apps/web/src/features/console/evidence.ts');
    for (const token of [
      'fleetscope.cloud-console.v1',
      'e-d9651b51-1d27-4991-b314-5fe77e4c8e2e',
      'e-04e1149b-7b8b-4529-951d-9029e6c7bfdb',
      'fleetscope-web-00001-g4s',
      'fleetscope-api-00001-qtm',
      'gemini-3.7-flash',
      'fleetscope-sessions-project-ac0c5f88-868b-46b9-a2e',
    ]) {
      expect(api).toContain(token);
      expect(web).toContain(token);
    }
  });
});
