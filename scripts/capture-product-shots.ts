/**
 * Capture the product shots the launchpad uses.
 *
 * # Why a script rather than hand-made images
 *
 * The launchpad's visual language is "the product is the only decoration". That
 * means the images on it must actually be the product — not a mockup, not a
 * fabricated UI drawn in markup, and not a stale PNG someone exported once and
 * forgot. Generating them from the running app keeps the front door honest: if
 * the viewer changes, re-running this updates what the landing page claims it
 * looks like.
 *
 * Usage:
 *   pnpm dev:web                      # in one terminal
 *   pnpm shots                        # in another
 *   FLEETSCOPE_SHOTS_BASE_URL=… pnpm shots
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = process.env['FLEETSCOPE_SHOTS_BASE_URL'] ?? 'http://localhost:4321';
const OUT_DIR = join(repoRoot, 'apps/web/public/product');

/*
 * Portrait cards.
 *
 * The carousel gives every card the same height and derives its width from the
 * aspect, so a landscape shot becomes a very wide card and only one and a half
 * fit on screen — which reads as a slideshow rather than a row. A narrower
 * viewport gives a portrait card, three of which fit at once, and the product
 * pages are responsive so they still look like themselves at this width.
 */
const WIDTH = 900;
const HEIGHT = 1160;

interface Shot {
  readonly name: string;
  readonly path: string;
  /** Run before the screenshot, to put the page into the state worth showing. */
  readonly prepare?: (page: Page) => Promise<void>;
}

const SHOTS: readonly Shot[] = [
  {
    name: 'viewer',
    path: '/viewer',
    prepare: async (page) => {
      // The bundled recording, so the shot shows a real projected session
      // rather than an empty shell.
      await page.click('[data-load-demo]');
      await page.waitForFunction(
        () => document.querySelector('[data-position]')?.textContent?.includes('event') === true,
        undefined,
        { timeout: 15_000 },
      );
      // Let the renderer settle its layout before the frame is taken.
      await page.waitForTimeout(1_200);
    },
  },
  {
    name: 'dashboard',
    path: '/dashboard',
    prepare: async (page) => {
      await page.waitForFunction(
        () => document.querySelector('[data-state-panel]')?.getAttribute('data-state') === 'ready',
        undefined,
        { timeout: 15_000 },
      );
      await page.waitForTimeout(400);
    },
  },
  { name: 'cockpit', path: '/cockpit/CASE-1042' },
  { name: 'cases', path: '/cases' },
  { name: 'catalog', path: '/catalog' },
  { name: 'approvals', path: '/approvals' },
  { name: 'audit', path: '/audit/CASE-1042' },
  { name: 'live', path: '/live' },
];

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    // The shots are stills. Anything mid-transition photographs as a smear.
    reducedMotion: 'reduce',
  });

  let failed = false;
  try {
    for (const shot of SHOTS) {
      const page = await context.newPage();
      try {
        await page.goto(`${BASE_URL}${shot.path}`, { waitUntil: 'networkidle' });
        if (shot.prepare) await shot.prepare(page);
        else await page.waitForTimeout(900);
        const file = join(OUT_DIR, `${shot.name}.png`);
        await page.screenshot({ path: file });
        process.stdout.write(`captured ${shot.name} -> ${file}\n`);
      } catch (error) {
        failed = true;
        process.stdout.write(`FAILED ${shot.name}: ${String(error)}\n`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  if (failed) process.exitCode = 1;
}

await main();
