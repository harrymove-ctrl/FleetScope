/**
 * Acceptance gate for the public launchpad.
 *
 * # Why this exists as a script
 *
 * The launchpad's design system is defined mostly by prohibitions — no gradient
 * text, no weight above 600, no second accent, no body overflow, one `h1`, a
 * pinned section that must not pin on a phone. Those are exactly the rules that
 * a later "small tweak" breaks silently, and none of them are visible in a unit
 * test because they are properties of the rendered page.
 *
 * So each rule below is checked against a real browser at each committed
 * viewport. A failure names the rule, not just the symptom.
 *
 * Usage:
 *   pnpm dev:web                       # in one terminal
 *   pnpm qa:landing                    # in another
 *   FLEETSCOPE_QA_BASE_URL=… pnpm qa:landing
 *   FLEETSCOPE_QA_SHOTS=dir pnpm qa:landing   # also writes one frame per section
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright';

const BASE_URL = process.env['FLEETSCOPE_QA_BASE_URL'] ?? 'http://localhost:4321';
/** Optional: write a frame per section so the page can be reviewed by eye. */
const SHOTS = process.env['FLEETSCOPE_QA_SHOTS'] ?? null;

/** Kept in step with the launch manifest. */
const EXPECTED_CHAPTERS = 8;

const VIEWPORTS = [
  { name: '375x812', width: 375, height: 812, desktop: false },
  { name: '768x1024', width: 768, height: 1024, desktop: false },
  // 1024 is BELOW the 1025 gate, so the carousel must not boot here.
  { name: '1024x800', width: 1024, height: 800, desktop: false },
  { name: '1440x900', width: 1440, height: 900, desktop: true },
  { name: '2560x1440', width: 2560, height: 1440, desktop: true },
] as const;

let failures = 0;

function check(viewport: string, rule: string, ok: boolean, detail = ''): void {
  const status = ok ? 'ok  ' : 'FAIL';
  if (!ok) failures += 1;
  process.stdout.write(`  ${status} ${viewport} · ${rule}${detail ? ` — ${detail}` : ''}\n`);
}

/** Let the entry choreography finish, then settle. */
async function settle(page: Page): Promise<void> {
  await page
    .waitForFunction(() => document.querySelector<HTMLElement>('[data-stage]')?.dataset['mode'], {
      timeout: 10_000,
    })
    .catch(() => undefined);
  // The entry runs delay 0.5s + grow 2.15s; wait past it so the chrome has
  // revealed and the row has settled onto its first card.
  await page.waitForTimeout(4_200);
}

async function run(): Promise<void> {
  /*
   * Default (hardware) GL, deliberately.
   *
   * Forcing SwiftShader makes full-page screenshots composite the WebGL layer,
   * which is convenient — but software rendering cannot hold the lens's frame
   * budget, so the lens correctly disables itself and the run stops testing
   * what a reader would actually get. Hardware GL is representative; the
   * trade is that the lens has to be captured from its own element, and its
   * state is reported in the log rather than inferred from a picture.
   */
  const browser = await chromium.launch();

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await settle(page);

    const report = await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>('[data-stage]');
      const chapters = Array.from(document.querySelectorAll('.chapter'));
      // Everything painted, not just the launchpad column. The peel footer
      // renders outside `.ap`, and a rule that stops at `.ap` would have
      // nothing to say about it — which is exactly where an 800-weight or a
      // shouting label would survive.
      const textNodes = Array.from(document.querySelectorAll<HTMLElement>('body *')).filter(
        (node) => !node.tagName.startsWith('ASTRO-'),
      );

      const heaviest = textNodes.reduce((max, node) => {
        const weight = Number.parseInt(getComputedStyle(node).fontWeight, 10);
        return Number.isFinite(weight) && weight > max ? weight : max;
      }, 0);

      const gradientText = Array.from(document.querySelectorAll('h1, h2')).filter((node) => {
        const style = getComputedStyle(node);
        return (
          style.backgroundImage !== 'none' &&
          (style.webkitTextFillColor === 'rgba(0, 0, 0, 0)' || style.color === 'rgba(0, 0, 0, 0)')
        );
      }).length;

      // Uppercase is allowed only on eyebrow-class micro-labels.
      const EYEBROWS = ['locator', 'chapter__label', 'cursor'];
      const uppercaseOffenders = textNodes
        .filter((node) => {
          if (getComputedStyle(node).textTransform !== 'uppercase') return false;
          return !EYEBROWS.some((name) => node.classList.contains(name));
        })
        .map((node) => `${node.tagName.toLowerCase()}.${node.className || '(no class)'}`);

      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        h1Count: document.querySelectorAll('h1').length,
        stageMode: stage?.dataset['mode'] ?? 'none',
        stageReason: stage?.dataset['reason'] ?? '',
        locator: document.querySelector('[data-locator]')?.textContent?.trim() ?? '',
        counter: document.querySelector('[data-counter]')?.textContent?.trim() ?? '',
        chapters: chapters.length,
        chaptersWithLink: chapters.filter((node) => node.querySelector('a[href]')).length,
        chaptersWithHeading: chapters.filter((node) => node.querySelector('h2')).length,
        heaviest,
        gradientText,
        uppercaseOffenders,
        accentFills: textNodes.filter(
          (node) => getComputedStyle(node).backgroundColor === 'rgb(41, 151, 255)',
        ).length,
      };
    });

    const name = viewport.name;
    check(name, 'no body overflow', report.overflow === 0, `${report.overflow}px`);
    check(name, 'exactly one h1', report.h1Count === 1, `${report.h1Count}`);
    check(name, 'no font weight above 600', report.heaviest <= 600, `heaviest ${report.heaviest}`);
    check(name, 'no gradient text on a heading', report.gradientText === 0);
    check(
      name,
      'uppercase only on eyebrow-class labels',
      report.uppercaseOffenders.length === 0,
      report.uppercaseOffenders.join(', '),
    );
    check(name, 'accent is used sparingly', report.accentFills <= 3, `${report.accentFills} fills`);

    /*
     * The content is the card list, in every state. The canvas is aria-hidden
     * decoration, so if this list were ever incomplete the page would have
     * nothing a screen reader or a no-WebGL visitor could read.
     */
    check(
      name,
      'every chapter is present',
      report.chapters === EXPECTED_CHAPTERS,
      `${report.chapters}`,
    );
    check(name, 'every chapter has a link', report.chaptersWithLink === report.chapters);
    check(name, 'every chapter has a heading', report.chaptersWithHeading === report.chapters);

    // The carousel is a desktop enhancement. Below the gate the list is the
    // page — deliberately not a "desktop only" holding screen.
    if (viewport.desktop) {
      check(
        name,
        'carousel runs above the gate',
        report.stageMode === 'canvas',
        report.stageMode === 'list' ? `fell back: ${report.stageReason}` : report.stageMode,
      );
      check(name, 'locator names a chapter', report.locator !== '');
      check(name, 'counter is present', report.counter.includes('/'), report.counter);
    } else {
      check(name, 'carousel is not booted below the gate', report.stageMode === 'list');
    }

    if (SHOTS !== null && viewport.desktop) {
      mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: join(SHOTS, `stage-${viewport.name}.png`) });
      process.stdout.write(`  wrote ${viewport.name} frame to ${SHOTS}\n`);
    }

    await context.close();
  }

  await browser.close();

  process.stdout.write(
    failures === 0 ? '\nlanding QA: all checks passed\n' : `\nlanding QA: ${failures} failed\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

await run();
