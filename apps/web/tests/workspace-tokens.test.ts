import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * V1 from the Agent Workspace visual system.
 *
 * The token file is safe because of two scopes at once: it is imported by one
 * route, and its declarations sit on `.aw`. Either alone is one mistake from
 * failing — a stray import would reach every route if the tokens were on
 * `:root`, and a stray `.aw` elsewhere would resolve tokens if the file were
 * global. Neither failure produces an error or a visual warning at the point of
 * the change, which is why it is checked here instead of being remembered.
 *
 * The design document specifies these as grep checks. They are run against the
 * file with comments stripped: the header comment *describes* the rules, so it
 * contains the very strings a raw grep would trip on.
 */

const FILE = join(process.cwd(), 'apps/web/src/styles/workspace.css');
const source = readFileSync(FILE, 'utf8');
const code = source.replace(/\/\*[\s\S]*?\*\//g, '');

describe('workspace.css scope rules', () => {
  it('declares nothing on :root, html or body', () => {
    // These are the only selectors that can escape the subtree.
    expect(code).not.toMatch(/:root/);
    expect(code).not.toMatch(/^\s*html\b/m);
    expect(code).not.toMatch(/^\s*body\b/m);
  });

  it('declares no --fs- name', () => {
    // It may read them freely; redeclaring one would create a second place for
    // a single value to drift.
    expect(code).not.toMatch(/^\s*--fs-[a-z0-9-]*\s*:/m);
  });

  it('begins every rule with .aw', () => {
    // A bare element rule inside .aw is safe; the habit produces an unsafe one
    // later, so the file forbids the habit.
    const selectors = code
      .split('}')
      .map((block) => block.split('{')[0]?.trim() ?? '')
      .filter((selector) => selector !== '' && !selector.startsWith('@'))
      .flatMap((selector) => selector.split(',').map((part) => part.trim()))
      .filter((selector) => selector !== '');

    for (const selector of selectors) {
      expect(selector.startsWith('.aw')).toBe(true);
    }
  });

  it('carries the thirteen tokens the global stylesheet is missing', () => {
    const expected = [
      '--aw-cyan',
      '--aw-violet',
      '--aw-orange',
      '--aw-cyan-bg',
      '--aw-violet-bg',
      '--aw-orange-bg',
      '--aw-space-7',
      '--aw-space-8',
      '--aw-measure-sentence',
      '--aw-measure-body',
      '--aw-motion-fast',
      '--aw-motion-state',
      '--aw-ease',
    ];
    for (const token of expected) {
      expect(code).toContain(`${token}:`);
    }
  });

  it('uses the documented hue values', () => {
    // The contrast ratios in the design were computed against these exact
    // values on --fs-bg: cyan 9.72, violet 7.01, orange 8.18. Changing a hex
    // here invalidates that arithmetic.
    expect(code).toContain('--aw-cyan: #5cc8d8');
    expect(code).toContain('--aw-violet: #a78bfa');
    expect(code).toContain('--aw-orange: #e8975c');
  });
});

describe('workspace.css is loaded by one route only', () => {
  it('is imported by /live and nowhere else', () => {
    const routes = ['live', 'viewer', 'dashboard', 'index'];
    const importing = routes.filter((route) => {
      const path = join(process.cwd(), `apps/web/src/pages/${route}.astro`);
      return readFileSync(path, 'utf8').includes('workspace.css');
    });
    expect(importing).toEqual(['live']);
  });

  it('is not imported by either layout', () => {
    // The mistake the two-scope design guards against: an import added to a
    // layout reaches every route it serves.
    for (const layout of ['BaseLayout', 'LaunchLayout']) {
      const path = join(process.cwd(), `apps/web/src/layouts/${layout}.astro`);
      expect(readFileSync(path, 'utf8')).not.toContain('workspace.css');
    }
  });
});
