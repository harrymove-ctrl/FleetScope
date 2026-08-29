/**
 * The Story surface, driven in a real browser against a real API and a real
 * MCP-governed agent call.
 *
 * # Why this is separate from `qa:browser`
 *
 * Every other browser check loads a static page. This one needs three live
 * processes (the preview, the API, the MCP server) and drives a governed tool
 * call between them, so it owns its own harness rather than complicating the
 * static suite.
 *
 * # Cost
 *
 * Zero. The API runs with no Gemini credential, and the allowlisted read is
 * answered from a recorded fixture.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium, type Browser, type Page } from 'playwright';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKER_DIR = join(REPO_ROOT, 'apps/adk-worker');
const WORKER_PYTHON = join(WORKER_DIR, '.venv/bin/python');

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'narrow', width: 480, height: 900 },
];

let pass = 0;
let fail = 0;

function check(name: string, ok: boolean, detail = ''): void {
  const suffix = detail === '' ? '' : `  ::  ${detail}`;
  console.log(`   ${ok ? 'PASS' : 'FAIL'}  ${name}${suffix}`);
  if (ok) pass += 1;
  else fail += 1;
}

function freePort(): Promise<number> {
  return new Promise((ok, no) => {
    const probe = createServer();
    probe.on('error', no);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (address === null || typeof address === 'string') return no(new Error('no port'));
      const { port } = address;
      probe.close(() => ok(port));
    });
  });
}

async function waitFor(url: string, child: ChildProcess, label: string): Promise<void> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`${label} exited (${child.exitCode})`);
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not listening yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  child.kill('SIGKILL');
  throw new Error(`${label} did not start`);
}

/** Call the governed tool the way the developer's CLI agent would. */
function callGovernedTool(apiBase: string, target: string): Promise<string> {
  return new Promise((done, no) => {
    const child = spawn(
      WORKER_PYTHON,
      [
        '-c',
        'import sys;from fleetscope_worker.mcp_server import HttpRunApi,handle_call;' +
          'print(handle_call(HttpRunApi(sys.argv[1]), sys.argv[2], client="antigravity-cli"))',
        apiBase,
        target,
      ],
      {
        cwd: WORKER_DIR,
        env: {
          PATH: process.env['PATH'] ?? '',
          PYTHONPATH: join(WORKER_DIR, 'src'),
          FLEETSCOPE_WORKER_OFFLINE: 'true',
        },
      },
    );
    let out = '';
    child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString()));
    child.stderr.resume();
    child.once('error', no);
    child.once('close', () => done(out.trim()));
  });
}

const stateOf = (page: Page): Promise<string> =>
  page
    .locator('#live-root')
    .getAttribute('data-state')
    .then((value) => value ?? '');

async function waitForState(page: Page, wanted: string, ms = 20_000): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if ((await stateOf(page)) === wanted) return true;
    await page.waitForTimeout(150);
  }
  return false;
}

const beatStatus = (page: Page, id: string): Promise<string | null> =>
  page.locator(`[data-beat="${id}"]`).getAttribute('data-status');

async function main(): Promise<number> {
  const apiPort = await freePort();
  const previewPort = await freePort();
  const apiBase = `http://127.0.0.1:${apiPort}`;
  const previewBase = `http://localhost:${previewPort}`;
  const ledger = join(mkdtempSync(join(tmpdir(), 'fleetscope-qa-live-')), 'runs.jsonl');

  const api = spawn('pnpm', ['--filter', '@fleetscope/api', 'start'], {
    env: {
      ...process.env,
      PORT: String(apiPort),
      API_LOG_LEVEL: 'silent',
      FLEETSCOPE_RUN_LEDGER: ledger,
      FLEETSCOPE_RUN_DRIVER: 'mcp',
      LIVE_MODE: 'true',
      // No Gemini credential: the MCP driver must not need one.
      GEMINI_MODEL: '',
      GEMINI_API_KEY: '',
      // The browser calls the API cross-origin, and the allowlist fails closed.
      WEB_ORIGINS: previewBase,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  api.stdout.resume();
  api.stderr.resume();

  const preview = spawn(
    'pnpm',
    ['--filter', '@fleetscope/web', 'exec', 'astro', 'preview', '--port', String(previewPort)],
    { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  preview.stdout.resume();
  preview.stderr.resume();

  let browser: Browser | null = null;
  try {
    await waitFor(`${apiBase}/health`, api, 'the API');
    await waitFor(previewBase, preview, 'the preview server');
    browser = await chromium.launch();

    for (const viewport of VIEWPORTS) {
      console.log(`\n== /live @ ${viewport.name} (${viewport.width}x${viewport.height})`);
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();
      const consoleErrors: string[] = [];
      const notFound: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('response', (response) => {
        if (response.status() === 404) notFound.push(response.url());
      });

      const url = `${previewBase}/live/?api=${encodeURIComponent(apiBase)}`;
      const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
      check(
        `${viewport.name}: the page loads`,
        response?.ok() === true,
        `HTTP ${response?.status()}`,
      );

      // ── ready ───────────────────────────────────────────────────────────
      check(
        `${viewport.name}: reaches ready`,
        await waitForState(page, 'ready'),
        await stateOf(page),
      );
      const cta = page.locator('#live-start');
      check(
        `${viewport.name}: the primary CTA is the one the plan names`,
        (await cta.textContent())?.trim() === 'Run live recovery demo',
      );
      check(`${viewport.name}: the CTA is enabled`, await cta.isEnabled());
      check(
        `${viewport.name}: delegation is not claimed before anything ran`,
        (await page.locator('#live-delegation').textContent())?.includes(
          'Unknown / not observable in this runtime',
        ) === true,
      );

      // ── awaiting_agent ──────────────────────────────────────────────────
      await cta.click();
      check(
        `${viewport.name}: the CTA admits a run and waits for the agent`,
        await waitForState(page, 'awaiting_agent'),
        await stateOf(page),
      );
      const waiting = await page.locator('#live-awaiting').textContent();
      check(
        `${viewport.name}: the waiting copy explains who acts next`,
        waiting?.includes('Your Gemini/Antigravity agent is ready to call FleetScope.') === true &&
          waiting.includes('FleetScope is governing the tool and recovery policy.'),
      );
      check(
        `${viewport.name}: nothing is claimed done while waiting`,
        (await beatStatus(page, 'fault')) === 'pending' &&
          (await beatStatus(page, 'result')) === 'pending',
      );

      // ── the agent calls the governed tool ───────────────────────────────
      const answer = await callGovernedTool(apiBase, 'google/adk-python');
      check(
        `${viewport.name}: the agent received the authoritative result`,
        answer.includes('Apache-2.0'),
        answer.slice(0, 48),
      );

      check(
        `${viewport.name}: the page advances to completed on its own`,
        await waitForState(page, 'completed'),
        await stateOf(page),
      );

      // ── the story is visible ────────────────────────────────────────────
      for (const id of ['start', 'read', 'fault', 'retry', 'result']) {
        check(`${viewport.name}: beat ${id} is done`, (await beatStatus(page, id)) === 'done');
      }
      const faultLabel = await page.locator('[data-beat="fault"] .live-beat__status').textContent();
      check(
        `${viewport.name}: the fault is labelled Controlled Fault`,
        faultLabel?.trim() === 'Controlled Fault',
        faultLabel?.trim(),
      );
      check(
        `${viewport.name}: the Warden retry is visible`,
        ((await page.locator('#live-policy').textContent()) ?? '').length > 0 &&
          (await page.locator('#live-policy').textContent()) !== 'none',
      );
      check(
        `${viewport.name}: the incident reason is visible`,
        ((await page.locator('#live-incident').textContent()) ?? '').includes('Controlled Fault'),
      );
      check(
        `${viewport.name}: the result is visible`,
        (await page.locator('#live-result').textContent())?.trim() === 'succeeded',
      );
      const cursor = Number((await page.locator('#live-cursor').textContent()) ?? '0');
      check(`${viewport.name}: the canonical cursor advanced`, cursor >= 8, String(cursor));
      check(
        `${viewport.name}: the budget is shown`,
        ((await page.locator('#live-budget').textContent()) ?? '').includes('model calls'),
      );
      check(
        `${viewport.name}: delegation stays unknown, because it was never observed`,
        (await page.locator('#live-delegation').getAttribute('data-observed')) === 'false',
      );

      // ── replay is read-only ─────────────────────────────────────────────
      const beforeReplay = await page.evaluate(() =>
        fetch(`${new URLSearchParams(location.search).get('api')}/runs/active`).then((r) =>
          r.json(),
        ),
      );
      await page.locator('#live-replay').click();
      check(
        `${viewport.name}: replay enters historical replay`,
        await waitForState(page, 'historical_replay'),
        await stateOf(page),
      );
      check(
        `${viewport.name}: replay states that it costs nothing`,
        ((await page.locator('#live-replay-note').textContent()) ?? '').includes(
          'zero model, tool and Warden calls',
        ),
      );
      const afterCursor = Number((await page.locator('#live-cursor').textContent()) ?? '0');
      check(
        `${viewport.name}: replay added no events`,
        afterCursor === cursor,
        `${cursor} -> ${afterCursor}`,
      );
      check(
        `${viewport.name}: replay started no run`,
        JSON.stringify(beforeReplay) === JSON.stringify({ run: null }),
      );

      // ── hygiene ─────────────────────────────────────────────────────────
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      check(`${viewport.name}: no horizontal body overflow`, overflow <= 0, `${overflow}px`);
      check(
        `${viewport.name}: no console errors`,
        consoleErrors.length === 0,
        consoleErrors[0] ?? '',
      );
      check(`${viewport.name}: no 404 requests`, notFound.length === 0, notFound[0] ?? '');

      await context.close();
    }

    // ── the cockpit 404 the static suite reports, identified ──────────────
    console.log('\n== diagnosing the cockpit 404 reported by qa:browser');
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const missing: string[] = [];
    page.on('response', (r) => {
      if (r.status() === 404) missing.push(new URL(r.url()).pathname);
    });
    await page.goto(`${previewBase}/cockpit/CASE-1042/`, { waitUntil: 'domcontentloaded' });
    console.log(
      missing.length === 0
        ? '   (no 404 observed on this run)'
        : `   404 requests: ${[...new Set(missing)].join(', ')}`,
    );
    await context.close();
  } finally {
    await browser?.close();
    for (const child of [api, preview]) {
      child.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 200));
      if (child.exitCode === null) child.kill('SIGKILL');
    }
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  return fail === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`\nqa:live aborted: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  },
);
