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
 * # Photograph the build, not the workstation
 *
 * Shoot a production preview, not the dev server. The dev server mounts this
 * machine's `.fleetscope/sessions`, so `/viewer` and `/demo` fill with the
 * operator's own runs — which puts local session ids on a public page and
 * gives every machine a different picture of the same product. The preview
 * serves what visitors actually get.
 *
 * Usage:
 *   pnpm build:web                                          # dist/
 *   pnpm --filter @fleetscope/web preview --port 4321       # in one terminal
 *   pnpm shots                                              # in another
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

/*
 * A safety net for anyone who points this at a dev server anyway.
 *
 * None of these exist in a preview build. Astro's dev toolbar is not the
 * product and sat baked into the bottom of every previous shot; the two local
 * panels are the product, but they only appear on a machine that happens to
 * have `.fleetscope/sessions` populated, and photographing them would publish
 * the operator's own session ids.
 */
const NOT_IN_THE_BUILD = `
  astro-dev-toolbar { display: none !important; }
  .viewer-sessions { display: none !important; }
  .live-tui { display: none !important; }
`;

interface Shot {
  readonly name: string;
  readonly path: string;
  /**
   * The skin the route actually ships.
   *
   * Feature routes follow the system scheme and ship light; evidence routes
   * are pinned dark in BaseLayout. Capturing every route dark photographed a
   * product that no longer exists, which is the exact failure this script is
   * supposed to prevent.
   */
  readonly scheme: 'light' | 'dark';
  /** Run before the screenshot, to put the page into the state worth showing. */
  readonly prepare?: (page: Page) => Promise<void>;
}

/** Bring an element to the top of the frame, so the shot opens on it. */
async function frame(page: Page, selector: string): Promise<void> {
  await page.locator(selector).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
}

const SHOTS: readonly Shot[] = [
  { name: 'demo', path: '/demo', scheme: 'light' },
  {
    name: 'dashboard',
    path: '/dashboard',
    scheme: 'light',
    prepare: async (page) => {
      await page.waitForFunction(
        () => document.querySelector('[data-state-panel]')?.getAttribute('data-state') !== null,
        undefined,
        { timeout: 15_000 },
      );
      await page.waitForTimeout(600);
    },
  },
  {
    name: 'console',
    path: '/console',
    scheme: 'light',
    prepare: async (page) => {
      // Overview is four short cards and half a page of white. The Vertex/ADK
      // panel is the thing the console exists to show: the producer, the
      // observed model, the agent chain and the READY decision behind it.
      await page.click('[data-console-tab="session"]');
      await page.waitForTimeout(600);
    },
  },
  {
    name: 'viewer',
    path: '/viewer',
    scheme: 'light',
    prepare: async (page) => {
      // Only a dev server has this control, and leaving it on would follow
      // whichever session this machine wrote last instead of the bundled one.
      await page.evaluate(() => {
        const newest = document.querySelector<HTMLInputElement>('[data-follow-newest]');
        if (newest?.checked) {
          newest.checked = false;
          newest.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });

      await page.click('[data-load-demo]');
      await page.waitForFunction(
        () => document.querySelector('[data-position]')?.textContent?.includes('event') === true,
        undefined,
        { timeout: 15_000 },
      );
      // Let the renderer settle its layout before the frame is taken.
      await page.waitForTimeout(1_500);
      await frame(page, '.viewer-shell');
    },
  },
  { name: 'cockpit', path: '/cockpit/CASE-1042', scheme: 'dark' },
  { name: 'cases', path: '/cases', scheme: 'dark' },
  { name: 'catalog', path: '/catalog', scheme: 'dark' },
  {
    name: 'approvals',
    path: '/approvals',
    scheme: 'light',
    prepare: async (page) => {
      // The launch-readiness gate is an embed, and an embed caught mid-mount
      // photographs as a black slab where the gate should be.
      await page.waitForTimeout(2_500);
    },
  },
  { name: 'audit', path: '/audit/CASE-1042', scheme: 'dark' },
  { name: 'live', path: '/live', scheme: 'dark' },
];

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    // The shots are stills. Anything mid-transition photographs as a smear.
    reducedMotion: 'reduce',
  });

  let failed = false;
  try {
    for (const shot of SHOTS) {
      const page = await context.newPage();
      try {
        await page.emulateMedia({ colorScheme: shot.scheme, reducedMotion: 'reduce' });
        await page.goto(`${BASE_URL}${shot.path}`, { waitUntil: 'networkidle' });
        await page.addStyleTag({ content: NOT_IN_THE_BUILD });
        // A shot taken mid-swap photographs the fallback face.
        await page.evaluate(() => document.fonts.ready);
        if (shot.prepare) await shot.prepare(page);
        else await page.waitForTimeout(900);
        const file = join(OUT_DIR, `${shot.name}.png`);
        await page.screenshot({ path: file });
        process.stdout.write(`captured ${shot.name} (${shot.scheme}) -> ${file}\n`);
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
