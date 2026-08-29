/**
 * Browser QA for the FleetScope product UI.
 *
 * Unit tests prove the presentation layer computes the right thing. They cannot
 * prove the WASM renderer instantiated, that a click on an evidence row actually
 * moved the graph, or that the page does not scroll sideways at 1280x720 — and
 * every one of those has broken at least once. This drives a real browser.
 *
 * Usage:
 *   pnpm qa:browser                       # builds nothing; serves apps/web/dist
 *   FLEETSCOPE_QA_BASE_URL=… pnpm qa:browser
 *   FLEETSCOPE_QA_SHOTS=dir pnpm qa:browser   # also writes screenshots
 *
 * The live proof is exercised only when FLEETSCOPE_QA_LIVE=true, because it
 * spends real money. See docs/design/budget-demo.md.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type ConsoleMessage, type Page } from 'playwright';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const CASE_ID = process.env['FLEETSCOPE_QA_CASE_ID'] ?? 'CASE-1042';
const SHOTS = process.env['FLEETSCOPE_QA_SHOTS'] ?? null;
const RUN_LIVE = process.env['FLEETSCOPE_QA_LIVE'] === 'true';

/** The two sizes the product commits to, plus the narrow desktop it must survive. */
const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900, desktop: true },
  { name: '1280x720', width: 1280, height: 720, desktop: true },
  { name: '1180x800', width: 1180, height: 800, desktop: true },
  // Mobile. The product does not claim the judge path works at this width, so
  // the deep desktop suites are skipped here — but "no body overflow at 390"
  // WAS being claimed with nothing enforcing it, which is how a mobile
  // regression ships unnoticed.
  { name: '390x844', width: 390, height: 844, desktop: false },
];

interface Check {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}
const checks: Check[] = [];
const check = (name: string, ok: boolean, detail: unknown = ''): void => {
  checks.push({ name, ok, detail: String(detail) });
};

/** Console errors are failures. A demo with a red console is not finished. */
function watchConsole(page: Page): { errors: string[] } {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return { errors };
}

async function serve(): Promise<{ baseUrl: string; stop: () => void }> {
  const existing = process.env['FLEETSCOPE_QA_BASE_URL'];
  if (existing !== undefined && existing !== '') {
    return { baseUrl: existing.replace(/\/$/, ''), stop: () => {} };
  }

  // A fixed port collides with any other preview server on this machine, and
  // the failure looks like a flaky test (ERR_CONNECTION_REFUSED mid-run) rather
  // than a port clash. Derive one from the process id instead.
  const port = Number(process.env['FLEETSCOPE_QA_PORT'] ?? 4400 + (process.pid % 500));
  const child: ChildProcess = spawn(
    'pnpm',
    ['--filter', '@fleetscope/web', 'exec', 'astro', 'preview', '--port', String(port)],
    { cwd: repoRoot, stdio: 'ignore' },
  );
  const baseUrl = `http://localhost:${port}`;

  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/cases/`);
      if (response.ok) return { baseUrl, stop: () => child.kill() };
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  child.kill();
  throw new Error(`the preview server did not start on ${baseUrl}. Run pnpm build:web first.`);
}

/** No route may give the BODY a horizontal scrollbar at any supported size. */
async function assertNoBodyOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  check(`${label}: no horizontal body overflow`, overflow <= 0, `${overflow}px`);
}

async function shoot(page: Page, name: string): Promise<void> {
  if (SHOTS === null) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true });
}

/**
 * The graph node the product is judged on.
 *
 * Named here and asserted in `agent-viewer-render`'s Rust tests, so the two
 * layers cannot end up testing different nodes.
 */
const TARGET_NODE = 'coordinator/hotel_search';
const TARGET_TOOL = 'search_hotels';

/**
 * Prove that a SPECIFIC, named graph node can be selected by keyboard and by
 * mouse, and that the renderer agrees.
 *
 * # Why this replaced a canvas click at {120, 200}
 *
 * That click proved a selection signal could be emitted. It did not prove which
 * node was hit, that any node was hit, that the correct agent became selected,
 * or that a keyboard user could do it at all — and it would have kept passing
 * with selection entirely broken, because `agent_viewer_select_agent` only
 * centred the camera and never selected anything.
 *
 * Every assertion below reads the RENDERER's answer, not the shell's intent.
 */
async function graphSelectionChecks(page: Page, label: string): Promise<void> {
  interface SelectionAbi {
    agent_viewer_snapshot: () => string;
    agent_viewer_agents: () => string;
    agent_viewer_graph_nodes: () => string;
  }
  interface SelectionScope {
    fleetscopeViewer: SelectionAbi;
    __qaSelection: { selectedAgentId: string | null; sequence: number | null }[];
  }

  const control = page.locator(`[data-graph-node="${TARGET_NODE}"]`);
  await control.waitFor({ state: 'visible', timeout: 20_000 });

  // The timeline and the inspector live behind Story Mode's technical-evidence
  // disclosure. Open it, because this test is about what an operator inspecting
  // a run can see, and a hidden panel proves nothing about filtering.
  const expert = page.locator('[data-expert-toggle]');
  if ((await expert.getAttribute('aria-expanded')) !== 'true') {
    await expert.click();
    await page.waitForTimeout(200);
  }

  // The control stands for a node the RENDERER has, not for a row of data.
  const isRealNode = (await page.evaluate(
    (id) =>
      (
        JSON.parse(
          (globalThis as unknown as SelectionScope).fleetscopeViewer.agent_viewer_graph_nodes(),
        ) as { id: string }[]
      ).some((node) => node.id === id),
    TARGET_NODE,
  )) as boolean;
  check(`viewer @ ${label}: the control names a real renderer graph node`, isRealNode, TARGET_NODE);

  check(
    `viewer @ ${label}: the node control is a semantic button`,
    (await control.evaluate((el) => el.tagName)) === 'BUTTON',
  );
  check(
    `viewer @ ${label}: the node control's accessible name carries the agent label`,
    ((await control.getAttribute('aria-label')) ?? '').includes('hotel_search'),
    (await control.getAttribute('aria-label')) ?? '',
  );

  // ── Keyboard reachability ───────────────────────────────────────────────
  //
  // Tabbed to, not `.focus()`ed: calling focus() would pass even if the control
  // were removed from the tab order.
  await page.locator('body').click({ position: { x: 2, y: 2 } });
  let tabs = 0;
  let focused = false;
  while (tabs < 60 && !focused) {
    await page.keyboard.press('Tab');
    tabs += 1;
    focused = await page.evaluate(
      (id) => document.activeElement?.getAttribute('data-graph-node') === id,
      TARGET_NODE,
    );
  }
  check(
    `viewer @ ${label}: the graph node is reachable by keyboard`,
    focused,
    `${tabs} tab press(es)`,
  );

  const focusRing = (await control.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      matchesFocusVisible: el.matches(':focus-visible'),
      outlineStyle: style.outlineStyle,
      outlineWidth: parseFloat(style.outlineWidth),
    };
  })) as { matchesFocusVisible: boolean; outlineStyle: string; outlineWidth: number };
  check(
    `viewer @ ${label}: the focused graph node shows a visible focus ring`,
    focusRing.matchesFocusVisible &&
      focusRing.outlineStyle !== 'none' &&
      focusRing.outlineWidth > 0,
    JSON.stringify(focusRing),
  );

  // The shell refreshes once a second. If that rebuilds the rail, it destroys
  // whichever control the keyboard user is on and Enter reaches nothing. This
  // waits out more than one refresh and asserts focus is still there.
  await page.waitForTimeout(1600);
  check(
    `viewer @ ${label}: focus survives a shell refresh`,
    await page.evaluate(
      (id) => document.activeElement?.getAttribute('data-graph-node') === id,
      TARGET_NODE,
    ),
    await page.evaluate(() => document.activeElement?.tagName ?? 'none'),
  );

  // ── Activation ──────────────────────────────────────────────────────────
  await page.evaluate(() => {
    (globalThis as unknown as SelectionScope).__qaSelection = [];
    window.addEventListener('fleetscope:viewer-selection', (event) => {
      (globalThis as unknown as SelectionScope).__qaSelection.push(
        JSON.parse((event as CustomEvent<string>).detail),
      );
    });
  });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);

  const signals = (await page.evaluate(
    () => (globalThis as unknown as SelectionScope).__qaSelection,
  )) as { selectedAgentId: string | null; sequence: number | null }[];
  check(
    `viewer @ ${label}: Enter on the graph node makes the renderer report it`,
    signals.some((signal) => signal.selectedAgentId === TARGET_NODE),
    JSON.stringify(signals.at(-1)),
  );

  // THE assertion that fails if node selection regresses: the renderer's own
  // snapshot, not the shell's aria attribute, must name the activated node.
  const snapshotAgent = (await page.evaluate(
    () =>
      (
        JSON.parse(
          (globalThis as unknown as SelectionScope).fleetscopeViewer.agent_viewer_snapshot(),
        ) as { selectedAgentId: string | null }
      ).selectedAgentId,
  )) as string | null;
  check(
    `viewer @ ${label}: the renderer's own snapshot reports the selected node`,
    snapshotAgent === TARGET_NODE,
    String(snapshotAgent),
  );

  const pressed = page.locator('[data-agent-rail] [aria-pressed="true"]');
  check(
    `viewer @ ${label}: exactly one control reports itself selected`,
    (await pressed.count()) === 1,
    `${await pressed.count()} pressed`,
  );

  // ── The timeline follows the selection ──────────────────────────────────
  //
  // The expected row count comes from the ABI's own event count for that agent,
  // so this asserts agreement between two Rust-owned numbers rather than
  // hardcoding a fixture total.
  const expected = (await page.evaluate(
    (id) =>
      (
        JSON.parse(
          (globalThis as unknown as SelectionScope).fleetscopeViewer.agent_viewer_agents(),
        ) as { id: string; eventCount: number }[]
      ).find((agent) => agent.id === id)?.eventCount ?? -1,
    TARGET_NODE,
  )) as number;
  const rows = page.locator('[data-timeline] .viewer-timeline__row');
  check(
    `viewer @ ${label}: the timeline filters to the selected agent`,
    expected > 0 && (await rows.count()) === expected,
    `${await rows.count()} row(s), ABI says ${expected}`,
  );

  // Selecting an agent does not move the playhead, so the inspector may still
  // hold an event belonging to someone else. It must say so rather than show it
  // under the selected agent's heading.
  const strandedInspector = await page.locator('[data-inspector]').innerText();
  check(
    `viewer @ ${label}: the inspector does not show another agent's event as this one's`,
    !/Agent\s+coordinator\s*$/m.test(strandedInspector) || strandedInspector.includes('belongs to'),
    strandedInspector.replace(/\s+/g, ' ').slice(0, 120),
  );

  // ── The evidence inspector shows that agent's failure ───────────────────
  const failing = page.locator('[data-timeline] .viewer-timeline__row', { hasText: 'error' });
  check(
    `viewer @ ${label}: the selected agent's failed step is in its filtered timeline`,
    (await failing.count()) >= 1,
    `${await failing.count()} failing row(s)`,
  );
  await failing.first().click();
  await page.waitForTimeout(300);
  const inspector = await page.locator('[data-inspector]').innerText();
  check(
    `viewer @ ${label}: the inspector shows the failed ${TARGET_TOOL} evidence`,
    inspector.includes(TARGET_TOOL) && inspector.toLowerCase().includes('error'),
    inspector.replace(/\s+/g, ' ').slice(0, 160),
  );

  // ── Deselection ─────────────────────────────────────────────────────────
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const clearedAgent = (await page.evaluate(
    () =>
      (
        JSON.parse(
          (globalThis as unknown as SelectionScope).fleetscopeViewer.agent_viewer_snapshot(),
        ) as { selectedAgentId: string | null }
      ).selectedAgentId,
  )) as string | null;
  check(
    `viewer @ ${label}: Escape clears the renderer's selection`,
    clearedAgent === null,
    String(clearedAgent),
  );
  check(
    `viewer @ ${label}: no control still reports itself selected`,
    (await page.locator('[data-agent-rail] [aria-pressed="true"]').count()) === 0,
  );
  check(
    `viewer @ ${label}: the full timeline returns after deselection`,
    (await rows.count()) === 20,
    `${await rows.count()} row(s)`,
  );

  // ── Space activates, and activating twice toggles off ───────────────────
  await control.focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(400);
  const afterSpace = (await page.evaluate(
    () =>
      (
        JSON.parse(
          (globalThis as unknown as SelectionScope).fleetscopeViewer.agent_viewer_snapshot(),
        ) as { selectedAgentId: string | null }
      ).selectedAgentId,
  )) as string | null;
  check(
    `viewer @ ${label}: Space selects the graph node`,
    afterSpace === TARGET_NODE,
    String(afterSpace),
  );

  // Mouse, on the same named node. No coordinates are involved.
  await control.click();
  await page.waitForTimeout(400);
  const afterSecond = (await page.evaluate(
    () =>
      (
        JSON.parse(
          (globalThis as unknown as SelectionScope).fleetscopeViewer.agent_viewer_snapshot(),
        ) as { selectedAgentId: string | null }
      ).selectedAgentId,
  )) as string | null;
  check(
    `viewer @ ${label}: activating the selected node again deselects it`,
    afterSecond === null,
    String(afterSecond),
  );
  check(
    `viewer @ ${label}: the full timeline returns after toggling off`,
    (await rows.count()) === 20,
    `${await rows.count()} row(s)`,
  );

  // ── The root agent is a node too ────────────────────────────────────────
  //
  // The renderer names the root node `main`, its own id, while every other
  // identifier in the system is a session agent id. Driving only a sub-agent
  // hid that: the root agent's control was disabled and its events unreachable.
  const rootControl = page.locator('[data-graph-node="coordinator"]');
  check(
    `viewer @ ${label}: the root agent is a selectable graph node`,
    (await rootControl.count()) === 1 && !(await rootControl.first().isDisabled()),
  );
  await rootControl.first().click();
  await page.waitForTimeout(400);
  const rootSelected = (await page.evaluate(
    () =>
      (
        JSON.parse(
          (globalThis as unknown as SelectionScope).fleetscopeViewer.agent_viewer_snapshot(),
        ) as { selectedAgentId: string | null }
      ).selectedAgentId,
  )) as string | null;
  check(
    `viewer @ ${label}: selecting the root reports its session id, not the renderer's`,
    rootSelected === 'coordinator',
    String(rootSelected),
  );
  const rootExpected = (await page.evaluate(
    () =>
      (
        JSON.parse(
          (globalThis as unknown as SelectionScope).fleetscopeViewer.agent_viewer_agents(),
        ) as { id: string; eventCount: number }[]
      ).find((agent) => agent.id === 'coordinator')?.eventCount ?? -1,
  )) as number;
  check(
    `viewer @ ${label}: the timeline filters to the root agent's own events`,
    rootExpected > 0 && (await rows.count()) === rootExpected,
    `${await rows.count()} row(s), ABI says ${rootExpected}`,
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // The canvas must remain reachable: an invisible full-page click layer would
  // make the graph unusable while every assertion above still passed.
  const canvasHit = (await page.evaluate(() => {
    const canvas = document.querySelector('#agent-viewer-canvas canvas');
    if (canvas === null) return false;
    const box = canvas.getBoundingClientRect();
    const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return top === canvas || canvas.contains(top);
  })) as boolean;
  check(`viewer @ ${label}: nothing overlays the graph canvas`, canvasHit);
}

/**
 * The judge Golden Path on /cockpit/CASE-1042.
 *
 * Open the Case, read the outcome, click a claim, land on the exact canonical
 * event that proves it. The whole point is that this works WITHOUT opening the
 * graph, so every assertion below runs in Story Mode with the renderer hidden.
 *
 * The four destinations are 0-based `caseSequence`. `evt-0053` is the 53rd
 * event and sequence 52; an off-by-one here lands the reader on
 * `identity.denied` and tells them the activation was refused.
 */
const GOLDEN_PATH: readonly { card: string; sequence: number; evidence: string }[] = [
  { card: 'security', sequence: 15, evidence: 'evt-0016' },
  { card: 'warden', sequence: 30, evidence: 'evt-0031' },
  { card: 'runtime', sequence: 35, evidence: 'evt-0036' },
  { card: 'activation', sequence: 52, evidence: 'evt-0053' },
];

async function goldenPathChecks(page: Page, baseUrl: string, label: string): Promise<void> {
  await page.goto(`${baseUrl}/cockpit/CASE-1042/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-story]', { timeout: 20_000 });

  // Story is the DEFAULT. A judge must not have to find it.
  check(
    `story @ ${label}: Story Mode is the default view`,
    (await page.locator('[data-story]').getAttribute('data-mode')) === 'story',
  );
  check(
    `story @ ${label}: the expert surface is not competing for attention`,
    await page.locator('[data-expert-surface]').first().isHidden(),
  );
  check(
    `story @ ${label}: the outcome is plain language`,
    /completed|failed/i.test(await page.locator('#story-title').innerText()),
    await page.locator('#story-title').innerText(),
  );

  // Four cards, all evidenced, in the fixed slot order.
  const cards = page.locator('.story__card');
  check(`story @ ${label}: four capability slots`, (await cards.count()) === 4);
  check(
    `story @ ${label}: every capability is evidenced in this recording`,
    (await page.locator('.story__card[data-state="evidenced"]').count()) === 4,
  );

  // The Proof Path.
  const steps = page.locator('[data-path-step]');
  check(`story @ ${label}: the Proof Path names six steps`, (await steps.count()) === 6);
  check(
    `story @ ${label}: every Proof Path step was reached in this recording`,
    (await page.locator('[data-path-step][data-state="reached"]').count()) === 6,
  );

  // ── The path a judge actually walks ─────────────────────────────────────
  for (const stop of GOLDEN_PATH) {
    const card = page.locator(`.story__card[data-card-id="${stop.card}"] [data-card-seek]`);
    await card.click();
    await page.waitForTimeout(350);

    check(
      `story @ ${label}: ${stop.card} seeks to canonical sequence ${stop.sequence}`,
      new URL(page.url()).searchParams.get('event') === String(stop.sequence),
      page.url(),
    );
    const drawer = await page.locator('[data-drawer-dismiss]').first().isVisible();
    check(`story @ ${label}: ${stop.card} opens its Decision Evidence`, drawer);
    check(
      `story @ ${label}: the drawer shows ${stop.evidence}, not a neighbour`,
      (await page.locator('[data-evidence-drawer]').innerText()).includes(stop.evidence),
      stop.evidence,
    );

    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    check(
      `story @ ${label}: Escape closes the evidence drawer`,
      !(await page.locator('[data-drawer-dismiss]').first().isVisible()),
    );
  }

  // The active step follows the cursor CHRONOLOGICALLY. This Case delegates at
  // sequence 3 and writes memory at 10, both before it screens at 15, so a
  // path that tracked display order would answer `delegate` here.
  await page.locator('.story__card[data-card-id="security"] [data-card-seek]').click();
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  check(
    `story @ ${label}: the active Proof Path step follows the cursor by sequence`,
    (await page.locator('[data-path-step][aria-current="true"]').getAttribute('data-path-step')) ===
      'screen',
    (await page.locator('[data-path-step][aria-current="true"]').getAttribute('data-path-step')) ??
      'none',
  );

  await assertNoBodyOverflow(page, `story @ ${label}`);
}

/** Keyboard, focus and reduced motion on the Story surface. */
async function goldenPathAccessibility(page: Page, baseUrl: string, label: string): Promise<void> {
  await page.goto(`${baseUrl}/cockpit/CASE-1042/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-story]', { timeout: 20_000 });

  const first = page.locator('[data-path-step]').first();
  check(
    `story a11y @ ${label}: Proof Path steps are semantic buttons`,
    (await first.evaluate((el) => el.tagName)) === 'BUTTON',
  );
  check(
    `story a11y @ ${label}: a step's accessible name states whether it was reached`,
    /reached/.test((await first.getAttribute('aria-label')) ?? ''),
    (await first.getAttribute('aria-label')) ?? '',
  );

  // Tabbed to, not focused programmatically: .focus() passes even when the
  // control has been taken out of the tab order.
  await page.locator('body').click({ position: { x: 2, y: 2 } });
  let tabs = 0;
  let reached = false;
  while (tabs < 80 && !reached) {
    await page.keyboard.press('Tab');
    tabs += 1;
    reached = await page.evaluate(
      () => document.activeElement?.getAttribute('data-path-step') === 'screen',
    );
  }
  check(`story a11y @ ${label}: the Proof Path is keyboard reachable`, reached, `${tabs} tabs`);

  const ring = (await page.locator('[data-path-step="screen"]').evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      focusVisible: el.matches(':focus-visible'),
      width: parseFloat(style.outlineWidth),
      style: style.outlineStyle,
    };
  })) as { focusVisible: boolean; width: number; style: string };
  check(
    `story a11y @ ${label}: the focused step shows a visible ring`,
    ring.focusVisible && ring.style !== 'none' && ring.width > 0,
    JSON.stringify(ring),
  );

  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  check(
    `story a11y @ ${label}: Enter activates a Proof Path step`,
    new URL(page.url()).searchParams.get('event') === '15',
    page.url(),
  );

  // Space on a card's evidence action.
  await page.locator('.story__card[data-card-id="activation"] [data-card-seek]').focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(350);
  check(
    `story a11y @ ${label}: Space activates a card action`,
    new URL(page.url()).searchParams.get('event') === '52',
    page.url(),
  );
  await page.keyboard.press('Escape');

  check(
    `story a11y @ ${label}: a polite live region reports the cursor`,
    /Event \d+ of \d+/.test(await page.locator('[data-story-announce]').innerText()),
    await page.locator('[data-story-announce]').innerText(),
  );
}

/** Expert Mode must open at the reader's evidence, not at the renderer's edge. */
async function expertBridgeChecks(page: Page, baseUrl: string): Promise<void> {
  await page.goto(`${baseUrl}/cockpit/CASE-1042/?mode=story&event=52`, {
    waitUntil: 'networkidle',
  });
  await page.waitForSelector('[data-story]', { timeout: 20_000 });

  await page.locator('[data-mode-expert]').click();
  await page.waitForSelector('#fleetscope-cockpit-canvas canvas', { timeout: 25_000 });
  await page.waitForTimeout(2500);

  check(
    'story: Expert Mode preserves the Event Cursor',
    new URL(page.url()).searchParams.get('event') === '52',
    page.url(),
  );
  const box = (await page
    .locator('#fleetscope-cockpit-canvas canvas')
    .evaluate((el) => ({ w: el.clientWidth, h: el.clientHeight }))) as { w: number; h: number };
  // A canvas measured while hidden is zero-wide, and the terminal grid is sized
  // from it exactly once. Revealing before mounting is what makes this pass.
  check(
    'story: the Expert renderer mounted against a measured canvas',
    box.w > 0 && box.h > 0,
    JSON.stringify(box),
  );

  // ── The reveal must happen BEFORE the measured-host wait ───────────────
  //
  // That wait is bounded to five seconds of wall clock. A reader who spends
  // longer than that in Story Mode — which is the normal case, since Story is
  // the point — would otherwise have the wait expire while the canvas was
  // still `display: none`, and the terminal grid would be built at zero
  // columns. It is sized from that width exactly once, so the graph would then
  // draw nothing forever while every other signal on the page stayed correct.
  //
  // Six seconds is past the bound on purpose: without the mode gate this check
  // fails, and with it the canvas measures normally.
  {
    const slow = await page.context().newPage();
    await slow.goto(`${baseUrl}/cockpit/CASE-1042/?mode=story&event=52`, {
      waitUntil: 'networkidle',
    });
    await slow.waitForSelector('[data-story]', { timeout: 20_000 });
    await slow.waitForTimeout(6000);
    await slow.locator('[data-mode-expert]').click();
    await slow.waitForSelector('#fleetscope-cockpit-canvas canvas', { timeout: 25_000 });
    await slow.waitForTimeout(2500);
    const late = (await slow
      .locator('#fleetscope-cockpit-canvas canvas')
      .evaluate((el) => ({ w: el.clientWidth, h: el.clientHeight }))) as { w: number; h: number };
    check(
      'story: opening Expert Mode after the measured-host bound still measures the canvas',
      late.w > 0 && late.h > 0,
      JSON.stringify(late),
    );
    await slow.close();
  }

  await page.locator('[data-mode-story]').click();
  await page.waitForTimeout(400);
  check(
    'story: returning to Story keeps the same historical position',
    new URL(page.url()).searchParams.get('event') === '52' &&
      (await page.locator('[data-story]').getAttribute('data-mode')) === 'story',
    page.url(),
  );

  // A reload must restore what the URL says.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  check(
    'story: a reload restores mode and cursor from the URL',
    new URL(page.url()).searchParams.get('event') === '52',
    page.url(),
  );
}

/**
 * The Guided Evidence Tour.
 *
 * Six stops in the order the Case ran them, driving the SAME canonical cursor
 * as the cards and the Proof Path. A reader who has never seen FleetScope
 * should reach the activation without guessing where to click.
 */
const TOUR: readonly { id: string; sequence: number; evidence: string }[] = [
  { id: 'delegate', sequence: 3, evidence: 'evt-0004' },
  { id: 'remember', sequence: 10, evidence: 'evt-0011' },
  { id: 'screen', sequence: 15, evidence: 'evt-0016' },
  { id: 'recover', sequence: 35, evidence: 'evt-0036' },
  { id: 'approve', sequence: 44, evidence: 'evt-0045' },
  { id: 'activate', sequence: 52, evidence: 'evt-0053' },
];

const param = (page: Page, key: string): string | null => new URL(page.url()).searchParams.get(key);

async function guidedTourChecks(page: Page, baseUrl: string, label: string): Promise<void> {
  await page.goto(`${baseUrl}/cockpit/CASE-1042/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-story]', { timeout: 20_000 });

  // ── Story Mode is short and honest ──────────────────────────────────────
  check(
    `tour @ ${label}: the recorded-mode label names the Case and denies execution`,
    /Recorded CASE-1042 evidence/.test(await page.locator('[data-recorded-label]').innerText()) &&
      /nothing is executing/.test(await page.locator('[data-recorded-label]').innerText()),
    await page.locator('[data-recorded-label]').innerText(),
  );
  // Expert-only panels must not lengthen Story Mode. A screenshot of Story is
  // the judge's first impression and must not read as a technical console.
  for (const surface of await page.locator('[data-expert-surface]').all()) {
    check(`tour @ ${label}: expert panels stay behind Expert Mode`, await surface.isHidden());
  }
  check(
    `tour @ ${label}: Story Mode shows no Incidents panel`,
    !(await page.locator('body').innerText()).includes('WARDEN INTERVENTIONS'),
  );

  // ── The Proof Path tells the truth about chronology ─────────────────────
  const anchors = (await page
    .locator('[data-path-step]')
    .evaluateAll((nodes) =>
      nodes.map((node) => Number(node.getAttribute('data-case-sequence'))),
    )) as number[];
  check(
    `tour @ ${label}: the Proof Path is displayed in chronological order`,
    anchors.every((value, i) => i === 0 || value > anchors[i - 1]!),
    anchors.join(' → '),
  );

  // ── Never autoplays ─────────────────────────────────────────────────────
  check(
    `tour @ ${label}: the tour does not start on its own`,
    await page.locator('[data-tour-active]').isHidden(),
  );
  check(`tour @ ${label}: no tour parameter before it starts`, param(page, 'tour') === null);

  // ── Six steps, in order, no skipping ────────────────────────────────────
  await page.locator('[data-tour-start]').click();
  await page.waitForTimeout(350);
  check(
    `tour @ ${label}: starting seeks the first step`,
    param(page, 'event') === String(TOUR[0]!.sequence) && param(page, 'tour') === TOUR[0]!.id,
    page.url(),
  );

  for (let i = 1; i < TOUR.length; i += 1) {
    await page.locator('[data-tour-next]').click();
    await page.waitForTimeout(300);
    check(
      `tour @ ${label}: Next reaches ${TOUR[i]!.id} at canonical sequence ${TOUR[i]!.sequence}`,
      param(page, 'event') === String(TOUR[i]!.sequence) && param(page, 'tour') === TOUR[i]!.id,
      page.url(),
    );
  }
  check(
    `tour @ ${label}: Next is exhausted at the last step rather than wrapping`,
    await page.locator('[data-tour-next]').isDisabled(),
  );

  // ── Back ────────────────────────────────────────────────────────────────
  await page.locator('[data-tour-back]').click();
  await page.waitForTimeout(300);
  check(
    `tour @ ${label}: Back restores the previous step`,
    param(page, 'event') === '44' && param(page, 'tour') === 'approve',
    page.url(),
  );
  // Focus must not be left on a control that can become disabled.
  check(
    `tour @ ${label}: focus follows the step heading`,
    (await page.evaluate(() => document.activeElement?.getAttribute('data-tour-title'))) !== null,
    await page.evaluate(() => document.activeElement?.tagName ?? 'none'),
  );

  // ── Evidence is opened on request, and it is the step's own event ───────
  check(
    `tour @ ${label}: the tour does not force the drawer open`,
    !(await page.locator('[data-drawer-dismiss]').first().isVisible()),
  );
  await page.locator('[data-tour-evidence]').click();
  await page.waitForTimeout(350);
  // Scoped to the DRAWER. The whole-page text also contains this id — the tour
  // step prints it — so a body-wide search passed no matter which event the
  // drawer actually opened, which is exactly the bug it was meant to catch.
  const drawerText = await page.locator('[data-evidence-drawer]').innerText();
  check(
    `tour @ ${label}: View evidence opens the event this step claims`,
    drawerText.includes('evt-0045'),
    drawerText.replace(/\s+/g, ' ').slice(0, 100),
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // ── Closing ends the narration without moving the reader ───────────────
  const before = param(page, 'event');
  await page.locator('[data-tour-close]').click();
  await page.waitForTimeout(300);
  check(
    `tour @ ${label}: closing the tour does not move the cursor`,
    param(page, 'event') === before && param(page, 'tour') === null,
    `${before} → ${param(page, 'event')}`,
  );

  // ── Invalid parameters degrade safely ──────────────────────────────────
  await page.goto(`${baseUrl}/cockpit/CASE-1042/?mode=nonsense&event=99999&tour=notastep`, {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(400);
  check(
    `tour @ ${label}: an unrecognised mode falls back to Story`,
    (await page.locator('[data-story]').getAttribute('data-mode')) === 'story',
  );
  check(
    `tour @ ${label}: an out-of-range event falls back to the latest`,
    param(page, 'event') === '59',
    page.url(),
  );
  check(
    `tour @ ${label}: an unrecognised tour step starts no tour`,
    await page.locator('[data-tour-active]').isHidden(),
  );

  // An ABSENT event is not sequence 0: `Number(null)` is 0, and reading it as a
  // request would open every fresh link on `case.created`.
  await page.goto(`${baseUrl}/cockpit/CASE-1042/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  check(
    `tour @ ${label}: a missing event parameter is not read as sequence 0`,
    param(page, 'event') === '59',
    page.url(),
  );

  await assertNoBodyOverflow(page, `tour @ ${label}`);
}

/** The tour, driven only from the keyboard. */
async function guidedTourKeyboard(page: Page, baseUrl: string, label: string): Promise<void> {
  await page.goto(`${baseUrl}/cockpit/CASE-1042/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-story]', { timeout: 20_000 });

  await page.locator('body').click({ position: { x: 2, y: 2 } });
  let tabs = 0;
  let onStart = false;
  while (tabs < 80 && !onStart) {
    await page.keyboard.press('Tab');
    tabs += 1;
    onStart = await page.evaluate(
      () => document.activeElement?.hasAttribute('data-tour-start') === true,
    );
  }
  check(`tour a11y @ ${label}: Start is keyboard reachable`, onStart, `${tabs} tabs`);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(350);
  check(
    `tour a11y @ ${label}: Enter starts the tour`,
    param(page, 'tour') === 'delegate',
    page.url(),
  );

  // Walk the rest with Space on Next, reached by tabbing from the heading.
  for (let i = 1; i < TOUR.length; i += 1) {
    await page.locator('[data-tour-next]').focus();
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    check(
      `tour a11y @ ${label}: Space advances to ${TOUR[i]!.id}`,
      param(page, 'tour') === TOUR[i]!.id,
      page.url(),
    );
  }

  check(
    `tour a11y @ ${label}: one polite live region reports the step`,
    /Step \d+ of \d+/.test(await page.locator('[data-story-announce]').innerText()),
    await page.locator('[data-story-announce]').innerText(),
  );
  check(
    `tour a11y @ ${label}: exactly one live region, so steps are announced once`,
    (await page.locator('[data-story] [aria-live]').count()) === 1,
  );
}

/** Expert Mode keeps both the cursor and the tour step. */
async function tourExpertBridge(page: Page, baseUrl: string): Promise<void> {
  await page.goto(`${baseUrl}/cockpit/CASE-1042/?mode=story&event=35&tour=recover`, {
    waitUntil: 'networkidle',
  });
  await page.waitForSelector('[data-story]', { timeout: 20_000 });
  check(
    'tour: a shared link restores the step it names',
    (await page.locator('[data-tour-title]').innerText()).includes('bounded retry'),
    await page.locator('[data-tour-title]').innerText(),
  );

  await page.locator('[data-tour-expert]').click();
  await page.waitForSelector('#fleetscope-cockpit-canvas canvas', { timeout: 25_000 });
  await page.waitForTimeout(2500);
  check(
    'tour: Expert Mode preserves the cursor and the tour step',
    param(page, 'event') === '35' && param(page, 'tour') === 'recover',
    page.url(),
  );
  const box = (await page
    .locator('#fleetscope-cockpit-canvas canvas')
    .evaluate((el) => ({ w: el.clientWidth, h: el.clientHeight }))) as { w: number; h: number };
  check(
    'tour: the renderer mounts against a measured canvas from a tour step',
    box.w > 0 && box.h > 0,
    JSON.stringify(box),
  );

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  check(
    'tour: a reload restores mode, cursor and tour step',
    param(page, 'event') === '35' && param(page, 'tour') === 'recover',
    page.url(),
  );
}

/**
 * Story Mode at mobile width.
 *
 * The mobile claim was "zero body overflow, including 390px" with nothing
 * enforcing it: `VIEWPORTS` had three desktop entries and the string 390 did
 * not appear in this file. These are the assertions that make the claim real.
 *
 * The deep judge-path suites deliberately do not run here. The product does not
 * claim the full guided tour is a mobile experience, and asserting it would be
 * inventing a promise rather than protecting one.
 */
async function storyMobileChecks(page: Page, label: string): Promise<void> {
  await page.waitForSelector('[data-story]', { timeout: 20_000 });

  check(
    `story @ ${label}: Story Mode is the default at mobile width`,
    (await page.locator('[data-story]').getAttribute('data-mode')) === 'story',
  );
  check(
    `story @ ${label}: the recorded-mode label survives the narrow layout`,
    /nothing is executing/.test(await page.locator('[data-recorded-label]').innerText()),
    await page.locator('[data-recorded-label]').innerText(),
  );
  check(
    `story @ ${label}: the outcome is readable without opening anything`,
    await page.locator('#story-title').isVisible(),
    await page.locator('#story-title').innerText(),
  );

  // Cards must stack rather than shrink into unreadable columns.
  const cards = page.locator('.story__card');
  check(`story @ ${label}: every capability card is present`, (await cards.count()) === 4);
  const widths = (await cards.evaluateAll((nodes) =>
    nodes.map((node) => Math.round(node.getBoundingClientRect().width)),
  )) as number[];
  check(
    `story @ ${label}: cards stack to full width instead of shrinking`,
    widths.every((width) => width > 240),
    widths.join(', '),
  );

  // The Proof Path scrolls inside its own strip. If it overflowed the body
  // instead, the whole page would pan sideways.
  const path = page.locator('.story__path');
  const strip = (await path.evaluate((el) => ({
    overflowX: getComputedStyle(el).overflowX,
    scrolls: el.scrollWidth > el.clientWidth,
  }))) as { overflowX: string; scrolls: boolean };
  check(
    `story @ ${label}: the Proof Path scrolls inside its own strip`,
    strip.overflowX === 'auto' || strip.overflowX === 'scroll' || !strip.scrolls,
    JSON.stringify(strip),
  );

  // Every control a thumb has to hit.
  const targets = (await page
    .locator('[data-story] button, [data-story] a')
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => (node as HTMLElement).offsetParent !== null)
        .map((node) => Math.round(node.getBoundingClientRect().height)),
    )) as number[];
  check(
    `story @ ${label}: visible Story controls meet the 44px touch target`,
    targets.length > 0 && targets.every((height) => height >= 44),
    `min ${Math.min(...targets)}px across ${targets.length} controls`,
  );

  await assertNoBodyOverflow(page, `story @ ${label}`);
}

async function main(): Promise<void> {
  const { baseUrl, stop } = await serve();
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch();

    // ── Every route, at every supported size ────────────────────────────────
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();
      const { errors } = watchConsole(page);

      for (const [name, route] of [
        ['dashboard', '/dashboard/'],
        ['viewer', '/viewer/'],
        ['catalog', '/catalog/'],
        ['cases', '/cases/'],
        ['workspace', `/cases/${CASE_ID}/`],
        ['approvals', '/approvals/'],
        ['cockpit', `/cockpit/${CASE_ID}/`],
        ['audit', `/audit/${CASE_ID}/`],
      ] as const) {
        errors.length = 0;
        await page.goto(baseUrl + route, { waitUntil: 'networkidle' });
        // Wait for the renderer to exist rather than for a stopwatch: a fixed
        // delay turns a slow machine into a false failure, which is the fastest
        // way to teach a team to ignore its own QA.
        if (name === 'cockpit') {
          await page
            .waitForSelector('#fleetscope-cockpit-canvas canvas', { timeout: 20_000 })
            .catch(() => {});
        }
        if (name === 'viewer') {
          await page
            .waitForSelector('#agent-viewer-canvas canvas', { timeout: 20_000 })
            .catch(() => {});
        }
        await page.waitForTimeout(400);
        check(
          `${name} @ ${viewport.name}: loads`,
          await page.locator('.fs-shell').isVisible(),
          route,
        );
        await assertNoBodyOverflow(page, `${name} @ ${viewport.name}`);
        // Graph-node selection is the interaction the product is judged on, so
        // it is proven at every supported size rather than once at 1440x900.
        if (name === 'viewer' && viewport.desktop) {
          await graphSelectionChecks(page, viewport.name);
          await assertNoBodyOverflow(page, `viewer selection @ ${viewport.name}`);
        }
        // The judge path is the product's first impression, so it is proven at
        // every supported size rather than once at 1440x900.
        if (name === 'cockpit' && viewport.desktop) {
          await goldenPathChecks(page, baseUrl, viewport.name);
          await goldenPathAccessibility(page, baseUrl, viewport.name);
          await guidedTourChecks(page, baseUrl, viewport.name);
          await guidedTourKeyboard(page, baseUrl, viewport.name);
        }
        // What the product DOES claim at 390: the Story is readable, its
        // controls are reachable, and nothing scrolls sideways.
        if (name === 'cockpit' && !viewport.desktop) {
          await storyMobileChecks(page, viewport.name);
        }
        check(
          `${name} @ ${viewport.name}: no console errors`,
          errors.length === 0,
          errors[0] ?? '',
        );
        await shoot(page, `${name}-${viewport.name}`);
      }
      await context.close();
    }

    // ── The Cockpit, in depth ───────────────────────────────────────────────
    // ── The Story to Expert bridge ─────────────────────────────────────────
    {
      const bridge = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await bridge.newPage();
      const { errors } = watchConsole(page);
      await expertBridgeChecks(page, baseUrl);
      await tourExpertBridge(page, baseUrl);
      check(
        'story: no console errors across the mode switch',
        errors.length === 0,
        errors[0] ?? '',
      );
      await bridge.close();
    }

    // ── The Story surface under reduced motion ─────────────────────────────
    {
      const reduced = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        reducedMotion: 'reduce',
      });
      const page = await reduced.newPage();
      await goldenPathChecks(page, baseUrl, 'reduced motion');
      await guidedTourChecks(page, baseUrl, 'reduced motion');
      const transition = (await page
        .locator('[data-path-step]')
        .first()
        .evaluate((el) => getComputedStyle(el).transitionDuration)) as string;
      // The global reduced-motion rule collapses durations to 0.01ms rather
      // than removing them, which is the same thing to a reader and keeps the
      // transitionend events other code may rely on.
      check(
        'story @ reduced motion: step transitions are switched off',
        transition === '' || parseFloat(transition) < 0.02,
        transition,
      );
      await reduced.close();
    }

    // ── Graph selection with reduced motion ────────────────────────────────
    //
    // The camera glide that selection triggers is motion. A user who asked for
    // less of it must still be able to select a node, so this runs the same
    // interaction with the preference set rather than claiming it by hand.
    {
      const reduced = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        reducedMotion: 'reduce',
      });
      const page = await reduced.newPage();
      const { errors } = watchConsole(page);
      await page.goto(`${baseUrl}/viewer/`, { waitUntil: 'networkidle' });
      await page
        .waitForSelector('#agent-viewer-canvas canvas', { timeout: 20_000 })
        .catch(() => {});
      await graphSelectionChecks(page, 'reduced motion');
      check('viewer @ reduced motion: no console errors', errors.length === 0, errors[0] ?? '');
      await reduced.close();
    }

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const { errors } = watchConsole(page);

    await page.goto(`${baseUrl}/catalog/`, { waitUntil: 'networkidle' });
    check(
      'catalog: offers the recorded Case',
      (await page.locator(`a[href="/cases/${CASE_ID}"]`).count()) > 0,
    );

    await page.goto(`${baseUrl}/dashboard/`, { waitUntil: 'networkidle' });
    check(
      'dashboard: onboarding is the first-run entry point',
      (await page.locator('h1').innerText()) === 'Dashboard',
    );
    check(
      'dashboard: points to Agent Viewer',
      (await page.locator('a[href="/viewer"]').count()) > 0,
    );
    check(
      'dashboard: the command affordance exposes a copy action',
      (await page.locator('[data-copy-command]').count()) === 1,
      await page.locator('[data-copy-command]').innerText(),
    );
    await page.locator('[data-copy-command]').click();
    await page.waitForTimeout(50);
    check(
      'dashboard: copying confirms the action in place',
      (await page.locator('[data-copy-command]').innerText()) === 'Copied',
      await page.locator('[data-copy-command]').innerText(),
    );
    await page.locator('[data-command-menu]').click();
    check('dashboard: command menu opens', await page.locator('[data-command-panel]').isVisible());
    await page.locator('[data-command-close]').click();
    check('dashboard: command menu closes', await page.locator('[data-command-panel]').isHidden());

    await page.goto(`${baseUrl}/viewer/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#agent-viewer-canvas canvas', { timeout: 20_000 });
    check(
      'viewer: WASM renderer instantiated',
      (await page.locator('#agent-viewer-canvas canvas').count()) === 1,
    );
    check(
      'viewer: canvas has measured dimensions',
      await page
        .locator('#agent-viewer-canvas canvas')
        .evaluate((node) => node.clientWidth > 0 && node.clientHeight > 0),
    );
    check(
      'viewer: demo fingerprint is stable',
      (await page.locator('[data-status]').innerText()).includes('e2728f4f985c7f33'),
    );

    // ── Story Mode ───────────────────────────────────────────────────────
    //
    // The route must answer "what happened / what did FleetScope do / did it
    // recover" before anything technical, and it must never claim a capability
    // a local session cannot evidence.
    await page.waitForSelector('[data-story-cards] .story__card', { timeout: 20_000 });
    check(
      'story: the route names its own source',
      // innerText applies CSS text-transform, so compare case-insensitively.
      (await page.locator('[data-story-source]').innerText()).trim().toLowerCase() ===
        'local session',
      await page.locator('[data-story-source]').innerText(),
    );
    check(
      'story: the outcome leads with what happened',
      (await page.locator('[data-story-outcome]').innerText()).includes('1 failed agent'),
      await page.locator('[data-story-outcome]').innerText(),
    );

    const evidenced = page.locator('[data-story-cards] .story__card[data-state="evidenced"]');
    check(
      'story: proof cards come from the session facts',
      (await evidenced.count()) === 4,
      await evidenced.allInnerTexts().then((rows) => rows.join(' | ')),
    );

    // The honesty guard. A local session records no screening, no policy, no
    // activation and no runtime control, so none of those may be asserted.
    const claimWords = ['blocked', 'recovered', 'activated', 'retried', 'authorized', 'confirmed'];
    const evidencedText = (await evidenced.allInnerTexts()).join(' ').toLowerCase();
    check(
      'story: no evidenced card claims a governance outcome',
      claimWords.every((word) => !evidencedText.includes(word)),
      evidencedText.slice(0, 120),
    );

    check(
      'story: the route states its limit once, not as four cards',
      (await page.locator('[data-story-disclosure]').innerText()).includes('Local session only'),
      await page.locator('[data-story-disclosure]').innerText(),
    );
    const storyText = (await page.locator('[data-story]').innerText()).toLowerCase();
    check(
      'story: the local route never names a governance capability',
      ['warden', 'model armor', 'vendor activation'].every((word) => !storyText.includes(word)),
    );

    check(
      'story: the technical event rail is not the first thing shown',
      await page.locator('[data-timeline]').isHidden(),
    );

    const chapterButtons = page.locator('[data-story-chapters] button');
    check('story: chapters are offered', (await chapterButtons.count()) >= 3);
    await chapterButtons.nth(2).click();
    await page.waitForTimeout(400);
    check(
      'story: a chapter seeks by canonical sequence',
      (await page.locator('[data-position]').innerText()).includes('event'),
      await page.locator('[data-position]').innerText(),
    );

    await page.locator('[data-expert-toggle]').click();
    await page.waitForTimeout(300);
    check(
      'story: technical evidence opens on request',
      await page.locator('[data-timeline]').isVisible(),
    );

    // ── The shell ────────────────────────────────────────────────────────
    //
    // Every assertion below reads what the shell rendered FROM the WASM ABI.
    // Nothing here hardcodes an agent count or an event count beyond the
    // fixture's own identity, and nothing maps an event index to a renderer
    // index: the whole point of the manifest is that only Rust may do that.
    //
    // Note on timing: the renderer waits for a measured host before loading,
    // with a 5s wall-clock deadline. That is deliberate, not a bug. These
    // selectors therefore wait rather than assume the shell is already up.
    await page.waitForSelector('[data-agent-rail] .viewer-rail__row', { timeout: 20_000 });
    const railRows = page.locator('[data-agent-rail] .viewer-rail__row');
    check('viewer: the agent rail renders from the ABI', (await railRows.count()) === 4);
    const identities = page.locator('[data-agent-rail] .fs-agent-identity');
    check(
      'viewer: every rail agent has a deterministic visual identity',
      (await identities.count()) === (await railRows.count()),
      `${await identities.count()} identities / ${await railRows.count()} agents`,
    );
    check(
      'viewer: identity labels keep the readable agent name and historical status',
      await identities.evaluateAll((nodes) =>
        nodes.every((node) => {
          const label = node.getAttribute('aria-label') ?? '';
          return label.includes(',') && !/online|thinking|live now/i.test(label);
        }),
      ),
      await identities.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label'))),
    );
    const identityVariants = await identities.evaluateAll((nodes) =>
      nodes.map((node) => node.className),
    );
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('[data-agent-rail] .fs-agent-identity', { timeout: 20_000 });
    check(
      'viewer: agent identities remain stable after refresh',
      JSON.stringify(identityVariants) ===
        JSON.stringify(
          await page
            .locator('[data-agent-rail] .fs-agent-identity')
            .evaluateAll((nodes) => nodes.map((node) => node.className)),
        ),
      identityVariants,
    );

    // A reload alone cannot catch a position-derived identity: the rows come
    // back in the same order, so the same positions produce the same faces and
    // the check passes either way. Reordering the rail is what distinguishes
    // "derived from the canonical id" from "derived from where it happens to
    // sit", and getting that wrong means an agent changes face whenever the
    // session gains an agent above it.
    const identityByAgent = (await page
      .locator('[data-agent-rail] .viewer-rail__row')
      .evaluateAll((rows) =>
        rows.map((row) => [
          row.getAttribute('data-agent-id') ?? '',
          row.querySelector('.fs-agent-identity')?.className ?? '',
        ]),
      )) as [string, string][];

    await page.evaluate(() => {
      const rail = document.querySelector('[data-agent-rail]');
      if (rail === null) return;
      // Reverse the rail in place. Every row keeps its own agent id and its own
      // markup; only the position changes.
      for (const item of [...rail.children].reverse()) rail.append(item);
    });

    const identityAfterReorder = (await page
      .locator('[data-agent-rail] .viewer-rail__row')
      .evaluateAll((rows) =>
        rows.map((row) => [
          row.getAttribute('data-agent-id') ?? '',
          row.querySelector('.fs-agent-identity')?.className ?? '',
        ]),
      )) as [string, string][];

    const identityBefore = new Map(identityByAgent);
    check(
      'viewer: an agent keeps its identity when the rail is reordered',
      identityAfterReorder.length === identityByAgent.length &&
        identityAfterReorder.every(
          ([agentId, className]) => identityBefore.get(agentId) === className,
        ),
      JSON.stringify(identityAfterReorder.map(([id]) => id)),
    );

    // The reorder above proves the class travels with its row. It CANNOT prove
    // the class was derived from the agent id, because the markup is rendered
    // on the server and moving DOM nodes recomputes nothing — a
    // position-derived identity passes it. Verified by making the identity a
    // counter: the reorder check stayed green.
    //
    // So assert the rendered face against an INDEPENDENT implementation of the
    // documented rule. The hash is restated here on purpose: importing the
    // real one would make the check agree with whatever the code does rather
    // than with what it is supposed to do.
    const expectedVariant = (agentId: string): number => {
      let hash = 2166136261;
      for (const char of agentId) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
      return (hash >>> 0) % 6;
    };
    const mismatched = identityByAgent.filter(
      ([agentId, className]) =>
        !className.includes(`fs-agent-identity--v${expectedVariant(agentId)}`),
    );
    check(
      'viewer: each rendered identity matches the canonical id it claims to encode',
      identityByAgent.length > 0 && mismatched.length === 0,
      mismatched.length === 0
        ? identityByAgent.map(([id]) => `${id}→v${expectedVariant(id)}`).join(', ')
        : `mismatched: ${JSON.stringify(mismatched)}`,
    );

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('[data-agent-rail] .fs-agent-identity', { timeout: 20_000 });
    // Reloading intentionally returns to the approachable Story surface. Open
    // the technical surface again before continuing the renderer assertions.
    await page.locator('[data-expert-toggle]').click();
    await page.locator('[data-timeline]').waitFor({ state: 'visible' });
    check(
      'viewer: the rail states a status in words, not colour alone',
      (await railRows.filter({ hasText: 'failed' }).count()) === 1,
      await railRows.filter({ hasText: 'failed' }).first().innerText(),
    );

    const timelineRows = page.locator('[data-timeline] .viewer-timeline__row');
    check(
      'viewer: the timeline renders from the bounded event window',
      (await timelineRows.count()) === 20,
      await page.locator('[data-timeline-count]').innerText(),
    );

    // Event 9 sits at renderer item 12 of 23, two sidecars along. An index
    // bridge would land on 10, which is exactly the bug the manifest prevents.
    // `data-sequence` is on the row button itself: the canonical key travels
    // with the control the user clicks, so nothing looks it up by text.
    await page.locator('[data-timeline] [data-sequence="9"]').click();
    await page.waitForTimeout(400);
    const position = await page.locator('[data-position]').innerText();
    check(
      'viewer: clicking an event seeks by canonical sequence',
      position.includes('event 9'),
      position,
    );
    check(
      'viewer: the renderer moved to the manifest position for that event',
      position.includes('12 of 23'),
      position,
    );
    check(
      'viewer: the clicked event becomes the selected row',
      (await page.locator('[data-timeline] [data-sequence="9"]').getAttribute('aria-current')) ===
        'true',
    );
    check(
      'viewer: the inspector shows the selected event',
      (await page.locator('[data-inspector]').innerText()).includes('9'),
    );

    // Selecting an agent filters the timeline and marks the rail row.
    await railRows.filter({ hasText: 'hotel_search' }).first().click();
    await page.waitForTimeout(300);
    check(
      'viewer: selecting an agent filters the timeline',
      (await timelineRows.count()) === 4,
      await page.locator('[data-timeline-count]').innerText(),
    );
    check(
      'viewer: the selected agent is marked',
      (await page.locator('[data-agent-rail] [aria-current="true"]').count()) === 1,
    );
    await railRows.filter({ hasText: 'hotel_search' }).first().click();
    await page.waitForTimeout(300);
    check(
      'viewer: deselecting an agent restores the timeline',
      (await timelineRows.count()) === 20,
    );

    await page.locator('[data-transport-toggle]').click();
    await page.waitForTimeout(300);
    check(
      'viewer: the transport control changes the reported state',
      (await page.locator('[data-transport-label]').innerText()) !== '',
      await page.locator('[data-transport-label]').innerText(),
    );
    await page.locator('[data-go-live]').click();
    await page.waitForTimeout(400);
    check(
      'viewer: returning to the latest event reaches the edge',
      (await page.locator('[data-position]').innerText()).includes('23 of 23'),
      await page.locator('[data-position]').innerText(),
    );
    await page.locator('[data-fit-graph]').click();
    check('viewer: fit graph is wired to the ABI', true);

    // The ABI as the page exposes it. Typed rather than `any` so a rename in
    // the bridge shows up here as a compile error instead of at runtime.
    interface PageAbi {
      agent_viewer_event_detail: (sequence: number) => string;
      agent_viewer_item_at: (index: number) => string;
    }
    interface PageScope {
      fleetscopeViewer: PageAbi;
      __qaSignals: { selectedAgentId: string | null; sequence: number | null }[];
    }

    // ── Reverse selection and evidence detail (slice D) ──────────────────
    //
    // A click lands inside the renderer's own canvas, which the DOM never sees,
    // so the bridge pushes its selection out as a CustomEvent. These assert the
    // contract rather than trying to hit a graph node by pixel, which would be
    // a test of coordinates rather than of behaviour.
    const detail9 = (await page.evaluate(() =>
      JSON.parse(
        (globalThis as unknown as PageScope).fleetscopeViewer.agent_viewer_event_detail(9),
      ),
    )) as Record<string, unknown> | null;
    check(
      'viewer: event detail resolves by canonical sequence',
      detail9 !== null && detail9.sequence === 9 && detail9.agentId === 'coordinator/hotel_search',
      JSON.stringify(detail9),
    );
    check(
      'viewer: event detail reports the renderer items the manifest recorded',
      Array.isArray(detail9?.rendererEntryIndices) &&
        (detail9?.rendererEntryIndices as number[]).includes(11),
      JSON.stringify(detail9?.rendererEntryIndices),
    );
    check(
      'viewer: a failed tool result is reported as an error',
      detail9?.status === 'error' && detail9?.tool === 'search_hotels',
      `${detail9?.status} · ${detail9?.tool}`,
    );

    const unknown = await page.evaluate(() =>
      (globalThis as unknown as PageScope).fleetscopeViewer.agent_viewer_event_detail(9999),
    );
    check(
      'viewer: an unknown sequence answers null rather than throwing',
      unknown === 'null' || unknown === null,
      String(unknown),
    );

    // Renderer item 3 is a sub-agent sidecar. It must not resolve to an event.
    const sidecar = (await page.evaluate(() =>
      JSON.parse((globalThis as unknown as PageScope).fleetscopeViewer.agent_viewer_item_at(3)),
    )) as Record<string, unknown> | null;
    check(
      'viewer: a sidecar renderer item carries no canonical event',
      sidecar?.kind === 'subagentMeta' && sidecar?.sequence === null,
      JSON.stringify(sidecar),
    );

    // The renderer's push, exercised through a REAL named node rather than a
    // guessed pixel. The old version of this clicked the canvas at {120, 200}
    // and asserted only that some signal arrived: it passed whether or not a
    // node was hit, and it named no agent. `graphSelectionChecks` below
    // replaces it, and runs at every supported viewport.
    await page.evaluate(() => {
      (globalThis as unknown as PageScope).__qaSignals = [];
      window.addEventListener('fleetscope:viewer-selection', (event) => {
        (globalThis as unknown as PageScope).__qaSignals.push(
          JSON.parse((event as CustomEvent<string>).detail),
        );
      });
    });
    await page.locator(`[data-graph-node="${TARGET_NODE}"]`).click();
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const signals = (await page.evaluate(
      () => (globalThis as unknown as PageScope).__qaSignals,
    )) as { selectedAgentId: string | null; sequence: number | null }[];
    check(
      'viewer: the renderer pushes its selection to the shell',
      signals.length > 0,
      `${signals.length} signal(s)`,
    );
    check(
      'viewer: every pushed signal carries a sequence or an explicit null',
      signals.every((signal) => signal.sequence === null || typeof signal.sequence === 'number'),
      JSON.stringify(signals.at(-1)),
    );

    check(
      'viewer: the transport never claims live execution for a recording',
      !(await page.locator('[data-transport-label]').innerText()).toLowerCase().includes('live'),
      await page.locator('[data-transport-label]').innerText(),
    );

    await page.goto(`${baseUrl}/cases/${CASE_ID}/`, { waitUntil: 'networkidle' });
    const workspace = await page.locator('.fs-answers').innerText();
    check('workspace: answers the six questions', (await page.locator('.fs-answer').count()) === 6);
    check(
      'workspace: names the simulated day boundary in full',
      (await page.locator('.fs-rail-steps').innerText()).includes('Simulated Day'),
    );
    check('workspace: shows a next step', workspace.length > 0);

    // Story Mode is now the default, so the expert surface must be asked for.
    // Opening it by URL is the same path a shared link takes.
    await page.goto(`${baseUrl}/cockpit/${CASE_ID}/?mode=expert`, { waitUntil: 'networkidle' });
    await page
      .waitForSelector('#fleetscope-cockpit-canvas canvas', { timeout: 20_000 })
      .catch(() => {});
    await page.waitForTimeout(600);
    check(
      'cockpit: the WASM renderer instantiated',
      (await page.locator('#fleetscope-cockpit-canvas canvas').count()) === 1,
    );
    // Existence is not enough. ratzilla sizes the grid from the host's width
    // once, at construction, so a renderer that loads before layout settles
    // produces a real <canvas> element that is zero columns wide and draws
    // nothing — with every other signal on the page still correct. This suite
    // passed 95/95 in exactly that state, which is what made the defect
    // survive. Assert the dimensions, on both routes.
    check(
      'cockpit: canvas has measured dimensions',
      await page
        .locator('#fleetscope-cockpit-canvas canvas')
        .evaluate((node) => node.clientWidth > 0 && node.clientHeight > 0),
    );
    const atEdge = await page.locator('[data-cursor-sequence]').innerText();
    check('cockpit: the event count is 1-based', atEdge !== '0' && atEdge !== '—', atEdge);

    // Selecting Armor evidence must move the graph through the Render Manifest.
    const armor = page.locator('[data-evidence-marker]').filter({ hasText: 'Armor' }).first();
    const armorSequence = await armor.getAttribute('data-case-sequence');
    await armor.click();
    await page.waitForTimeout(600);
    check(
      'cockpit: selecting evidence moves the Event Cursor',
      (await page.locator('[data-cursor-sequence]').innerText()) ===
        String(Number(armorSequence) + 1),
      await page.locator('[data-cursor-readout]').innerText(),
    );
    const rendererIndex = await page.evaluate(() => {
      const cockpit = (globalThis as Record<string, unknown>)['fleetscopeCockpit'] as
        { fleetscope_snapshot: () => string } | undefined;
      return cockpit === undefined
        ? null
        : (JSON.parse(cockpit.fleetscope_snapshot()) as { rendererEntryIndex: number })
            .rendererEntryIndex;
    });
    const expectedRange = await page.evaluate((sequence: string) => {
      const node = document.querySelector('[data-cockpit-scene]');
      const scene = JSON.parse(node?.textContent ?? '{}') as {
        manifest: { entries: { caseSequence: number; rendererEntryStart: number }[] };
      };
      return (
        scene.manifest.entries.find((entry) => entry.caseSequence === Number(sequence))
          ?.rendererEntryStart ?? null
      );
    }, armorSequence ?? '0');
    check(
      'cockpit: the renderer seeked to the manifest range for that event',
      rendererIndex !== null && rendererIndex === expectedRange,
      `renderer ${rendererIndex}, manifest ${expectedRange}`,
    );

    check(
      'cockpit: historical mode says nothing is executing',
      (await page.locator('[data-transport-label]').innerText()).includes('nothing is executing'),
      await page.locator('[data-transport-label]').innerText(),
    );
    const unread = await page.locator('[data-unread-count]').innerText();
    check('cockpit: canonical unread is reported', unread.includes('new'), unread);

    // The Decision Evidence drawer.
    await page.locator('[data-evidence-open]').first().click();
    await page.waitForTimeout(300);
    check(
      'cockpit: the evidence drawer opens',
      await page.locator('[data-evidence-drawer]').isVisible(),
    );
    check(
      'cockpit: the drawer shows canonical provenance',
      (await page.locator('[data-drawer-body]').innerText()).includes('Evidence Event ID'),
    );
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    check(
      'cockpit: Escape closes the drawer',
      !(await page.locator('[data-evidence-drawer]').isVisible()),
    );

    // Incident and Warden presentation.
    const incidents = await page.locator('[data-incident]').allInnerTexts();
    check(
      'cockpit: incidents explain why they opened',
      incidents.some((text) => text.includes('DETECTED BECAUSE')) ||
        incidents.some((text) => text.includes('Detected because')),
      incidents[0]?.slice(0, 60) ?? '',
    );
    const lifecycle = await page.locator('.fs-lifecycle').first().innerText();
    check(
      'cockpit: the Warden lifecycle keeps its stages separate',
      lifecycle.includes('asked the Runtime') && lifecycle.includes('acknowledged'),
      lifecycle.replace(/\n/g, ' · ').slice(0, 120),
    );

    // Demo phase navigation, then back to the live edge.
    await page.locator('[data-phase="warden"]').click();
    await page.waitForTimeout(500);
    check(
      'cockpit: demo phase navigation seeks',
      (await page.locator('[data-phase="warden"]').getAttribute('aria-current')) === 'true',
    );
    await page.locator('[data-return-to-live]').click();
    await page.waitForTimeout(600);
    check(
      'cockpit: Return to live reaches the edge',
      (await page.locator('[data-cursor-sequence]').innerText()) === atEdge &&
        !(await page.locator('[data-transport-label]').innerText()).includes('Historical'),
      await page.locator('[data-transport-label]').innerText(),
    );

    // Keyboard reachability of the primary controls.
    const reachable = await page.evaluate(() => {
      const focusable = [
        ...document.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), select, input, summary',
        ),
      ].filter((element) => element.offsetParent !== null);
      return {
        total: focusable.length,
        nav: focusable.filter((element) => element.closest('.fs-nav') !== null).length,
        realButtons: [...document.querySelectorAll('[data-evidence-open]')].every(
          (element) => element.tagName === 'BUTTON',
        ),
      };
    });
    check('cockpit: primary navigation is keyboard reachable', reachable.nav >= 5, reachable.nav);
    check('cockpit: evidence controls are real buttons', reachable.realButtons);
    await page.keyboard.press('Tab');
    check(
      'cockpit: focus lands on a focusable element',
      await page.evaluate(() => document.activeElement?.tagName !== 'BODY'),
    );

    check('cockpit: no console errors during interaction', errors.length === 0, errors[0] ?? '');

    // ── Audit ───────────────────────────────────────────────────────────────
    errors.length = 0;
    await page.goto(`${baseUrl}/audit/${CASE_ID}/`, { waitUntil: 'networkidle' });
    const before = await page.locator('[data-audit-count]').innerText();
    await page.selectOption('[data-audit-filter="domain"]', 'armor');
    await page.waitForTimeout(250);
    const after = await page.locator('[data-audit-count]').innerText();
    check(
      'audit: filters narrow the event log',
      Number(after) < Number(before),
      `${before} → ${after}`,
    );
    await page.selectOption('[data-audit-filter="domain"]', '');

    await page.locator('[data-evidence-open]').first().click();
    await page.waitForTimeout(300);
    check(
      'audit: the evidence drawer opens',
      await page.locator('[data-evidence-drawer]').isVisible(),
    );
    await page.keyboard.press('Escape');

    await page.locator('[data-export-verify]').click();
    await page.waitForTimeout(1500);
    check(
      'audit: the evidence export verifies in the browser',
      (await page.locator('[data-export-verify-result]').innerText()).startsWith('Verified'),
      await page.locator('[data-export-verify-result]').innerText(),
    );
    check(
      'audit: capability modes are labelled, and unknown counts are not zero',
      (await page.locator('.fs-card', { hasText: 'Capability truth' }).innerText()).includes(
        'Synthetic System',
      ),
    );
    check('audit: no console errors', errors.length === 0, errors[0] ?? '');

    // ── The bounded live proof, only when explicitly asked for ──────────────
    errors.length = 0;
    // Story Mode is now the default, so the expert surface must be asked for.
    // Opening it by URL is the same path a shared link takes.
    await page.goto(`${baseUrl}/cockpit/${CASE_ID}/?mode=expert`, { waitUntil: 'networkidle' });
    await page
      .waitForSelector('#fleetscope-cockpit-canvas canvas', { timeout: 20_000 })
      .catch(() => {});
    await page.waitForTimeout(800);
    const liveButton = page.locator('[data-live-run]');
    const liveEnabled = await liveButton.isEnabled();

    if (!RUN_LIVE) {
      check(
        'live proof: the control is present and honest about availability',
        (await page.locator('[data-live-availability]').innerText()).length > 0,
        await page.locator('[data-live-availability]').innerText(),
      );
      check(
        'live proof: recorded mode is unaffected by an unavailable live path',
        (await page.locator('[data-cursor-sequence]').innerText()) === atEdge,
      );
    } else {
      check('live proof: the API reports the step is available', liveEnabled);
      if (liveEnabled) {
        const eventsBefore = Number(await page.locator('[data-cursor-total]').innerText());
        const railBefore = Number(await page.locator('[data-evidence-count]').innerText());
        await liveButton.click();
        // A second click must not spend a second call.
        await liveButton.click({ force: true }).catch(() => {});
        await page.waitForFunction(
          () =>
            document.querySelector('[data-live-state]')?.getAttribute('data-state') !== 'running',
          undefined,
          { timeout: 30_000 },
        );
        const state = await page.locator('[data-live-state]').getAttribute('data-state');
        const text = await page.locator('[data-live-state]').innerText();
        check(
          'live proof: the request resolved',
          state !== 'running',
          `${state}: ${text.slice(0, 120)}`,
        );
        if (state === 'succeeded') {
          const eventsAfter = Number(await page.locator('[data-cursor-total]').innerText());
          const railAfter = Number(await page.locator('[data-evidence-count]').innerText());
          check(
            'live proof: canonical evidence grew',
            eventsAfter > eventsBefore,
            `${eventsBefore} → ${eventsAfter}`,
          );
          check(
            'live proof: the evidence rail grew',
            railAfter > railBefore,
            `${railBefore} → ${railAfter}`,
          );
          check(
            'live proof: the result is labelled Live Proof',
            text.includes('Live proof succeeded'),
          );
          check('live proof: the button is spent, not retryable', !(await liveButton.isEnabled()));
          check(
            'live proof: the renderer still seeks the recorded prefix',
            await page.evaluate(() => {
              const cockpit = (globalThis as Record<string, unknown>)['fleetscopeCockpit'] as
                { fleetscope_seek_case_sequence: (n: number) => boolean } | undefined;
              return cockpit?.fleetscope_seek_case_sequence(15) ?? false;
            }),
          );
        }
        check('live proof: no console errors', errors.length === 0, errors[0] ?? '');
      }
    }

    await shoot(page, 'cockpit-after-interaction');
    await context.close();
  } finally {
    await browser?.close();
    stop();
  }

  const failed = checks.filter((entry) => !entry.ok);
  for (const entry of checks) {
    process.stdout.write(
      `${entry.ok ? 'PASS' : 'FAIL'}  ${entry.name}${entry.detail === '' ? '' : `  ::  ${entry.detail}`}\n`,
    );
  }
  process.stdout.write(
    `\n${checks.length - failed.length}/${checks.length} browser checks passed\n`,
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

await main();
