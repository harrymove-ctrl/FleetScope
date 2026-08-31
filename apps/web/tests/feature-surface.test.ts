import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');

const viewer = read('apps/web/src/pages/viewer.astro');
const demo = read('apps/web/src/pages/demo.astro');
const sessionGraphs = read('apps/web/src/components/SessionGraphs.astro');
const readingsStyles = read('apps/web/src/styles/feature-readings.css');
const viewerLoader = read('apps/web/src/components/ViewerLoader.astro');
const nav = read('apps/web/src/components/Nav.astro');
const approvals = read('apps/web/src/pages/approvals.astro');
const approvalCard = read('apps/web/src/components/ApprovalCard.astro');
const viewerLoaderParams = read('apps/web/src/features/viewer/wild-type/params.ts');
const viewerLoaderEngine = read('apps/web/src/features/viewer/wild-type/engine.ts');
const dashboard = read('apps/web/src/pages/dashboard.astro');
const techWall = read('apps/web/src/components/TechWall.astro');
const index = read('apps/web/src/pages/index.astro');
const launchLayout = read('apps/web/src/layouts/LaunchLayout.astro');
const feature = read('apps/web/src/styles/feature.css');
const viewerStyles = read('apps/web/src/styles/feature-viewer.css');
const dashboardStyles = read('apps/web/src/styles/feature-dashboard.css');
const consoleStyles = read('apps/web/src/styles/feature-console.css');

describe('the feature-detail visual surface', () => {
  it('is enabled only by Viewer, Dashboard, and Cloud Console', () => {
    const consolePage = read('apps/web/src/pages/console.astro');
    expect(viewer).toContain('surface="feature" theme="adaptive"');
    expect(dashboard).toContain('surface="feature" theme="adaptive"');
    expect(consolePage).toContain('surface="feature" theme="adaptive"');
    expect(index).not.toContain('surface="feature"');
  });

  it('does not enter the landing layout', () => {
    expect(index).toContain("import LaunchLayout from '../layouts/LaunchLayout.astro'");
    expect(launchLayout).not.toContain('feature.css');
    expect(launchLayout).not.toContain('ThemeControl');
  });

  it('keeps every feature rule behind the explicit surface', () => {
    for (const source of [feature, viewerStyles, dashboardStyles, consoleStyles]) {
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '');
      expect(code).toContain("[data-surface='feature']");
      expect(code).not.toMatch(/(^|\n)\s*:root\s*\{/);
      expect(code).not.toContain('.ap__');
    }
  });

  it('keeps the Apple light neutrals as the light ground', () => {
    for (const token of ['#ffffff', '#f5f5f7', '#1d1d1f', '#6e6e73', '#d2d2d7']) {
      expect(feature).toContain(token);
    }
  });

  /*
   * The accents name a vendor, so they are pinned rather than left to taste.
   *
   * This surface reads Gemini and Antigravity sessions, and its palette used
   * to be a warm green/amber/coral set that read as a different lab's brand.
   * The hues below are Gemini's own, sampled from public/brand/google-gemini.svg
   * and carried at Google's dark-theme luminance; every one clears 4.5:1 on the
   * ground it sits on.
   */
  it('pins the Gemini accents on both grounds', () => {
    for (const token of ['#06070c', '#8ab4f8', '#c58af9', '#fdd663', '#f28b82']) {
      expect(feature).toContain(token);
    }
    for (const token of ['#1a73e8', '#8430ce', '#8a6100', '#c5221f']) {
      expect(feature).toContain(token);
    }
  });

  it('keeps no trace of the palette it replaced', () => {
    for (const token of ['#9bcf95', '#79bdb4', '#d3aa68', '#dc8982', '#070908']) {
      expect(feature).not.toContain(token);
    }
  });

  it('uses AI-style onboarding primitives with progressive disclosure', () => {
    expect(dashboard).toContain('class="fs-dashboard__prompt"');
    expect(dashboard).toContain('class="fs-dashboard__suggestions"');
    expect(dashboard).toContain('class="fs-dashboard__task"');
    expect(dashboard).not.toContain('class="fs-dashboard__disclosures"');
    expect(dashboard).not.toContain('class="fs-dashboard__setup-card"');
    expect(dashboardStyles).toContain('.fs-dashboard__prompt');
    expect(dashboardStyles).toContain('.fs-dashboard__task');
    expect(viewerStyles).toContain('.viewer-inspector dt');
    expect(viewerStyles).toContain('.viewer-inspector dd');
  });

  it('onboards from the local CLI, not a file upload', () => {
    expect(dashboard).toContain('data-prompt-copy');
    expect(dashboard).toContain('data-cli-command');
    expect(dashboard).toContain('Antigravity session');
    expect(dashboard).toContain('Example only (gemini-session)');
    expect(dashboard).toContain('fs-dashboard__cli-steps');
    const planData = read('apps/web/src/features/dashboard/launch-plan.ts');
    expect(planData).toContain('cargo run -p fleetscope-cli');
    expect(planData).toContain('.fleetscope/sessions/antigravity-live-cu');
    expect(planData).toContain('examples/gemini-session --follow');
    expect(planData).not.toMatch(/fleetscope ~\/sessions\/my-run/);
    expect(dashboard).toContain('SUPPORT_AGY_COMMAND');
    expect(dashboard).toContain('SUPPORT_CLI_COMMAND');
    expect(dashboard).not.toContain('data-upload-dropzone');
    expect(dashboard).not.toContain('data-session-file-input');
    expect(dashboard).not.toContain('data-approval-card');
    expect(dashboard).not.toContain('DASHBOARD_HANDOFF_KEY');
    expect(dashboard).not.toContain('Browse a folder');
    expect(viewer).not.toContain('takeDashboardHandoff');
    expect(viewer).not.toContain('fleetscope:dashboard-upload');
    expect(viewer).toContain('agent_viewer_load_demo');
  });

  it('uses a bounded native Tech Wall behind the onboarding flow', () => {
    expect(dashboard).toContain("import TechWall from '../components/TechWall.astro'");
    expect(dashboard).toContain('className="fs-dashboard__wall"');
    expect(dashboard).toContain('facets={6}');
    expect(dashboard).toContain('density={7}');
    expect(dashboard).toContain('sweep={0.8}');
    expect(techWall).toContain('data-tech-wall');
    expect(dashboardStyles).toContain('@keyframes fs-tech-wall-sweep');
    expect(dashboardStyles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(dashboardStyles).not.toContain('animation-iteration-count: infinite');
  });

  it('uses the Apple-like single-face display scale on Dashboard', () => {
    expect(dashboardStyles).toContain("'SF Pro Display'");
    expect(dashboardStyles).toContain('font-size: clamp(40px, 5vw, 64px)');
    expect(dashboardStyles).toContain('font-weight: 600');
    expect(dashboardStyles).not.toContain('font-weight: 700');
  });

  it('keeps the workflow board and style switcher on the viewer surface', () => {
    expect(viewer).toContain('data-workflow-board');
    expect(viewer).toContain('data-workflow-lanes');
    expect(viewer).toContain('data-view-style="terminal"');
    expect(viewer).toContain('data-view-style="focus"');
    expect(viewer).toContain('data-view-style="split"');
    expect(viewerStyles).toContain('.workflow-board__connector');
    expect(viewerStyles).toContain('.viewer-canvas-minimap');
  });

  it('does not curtain the dashboard with a preloader', () => {
    expect(dashboard).not.toContain(
      "import DashboardLoader from '../components/DashboardLoader.astro'",
    );
    expect(dashboard).not.toContain('<DashboardLoader />');
    expect(dashboard).not.toContain('ReactBitsFrame');
    expect(dashboard).not.toContain('fs-dashboard__react-bits');
  });

  it('onboards with an assistant plan for viewer and gcloud', () => {
    expect(dashboard).toContain("import AssistantPlan from '../components/AssistantPlan.astro'");
    expect(dashboard).toContain('<AssistantPlan />');
    const plan = read('apps/web/src/components/AssistantPlan.astro');
    const planData = read('apps/web/src/features/dashboard/launch-plan.ts');
    expect(plan).toContain('data-assistant-plan');
    expect(plan).toContain('data-plan-run');
    expect(plan).toContain('Copy gcloud');
    expect(plan).toContain('Auto-approved');
    expect(plan).not.toContain('data-plan-edit');
    expect(plan).toContain('Open Cloud Run');
    expect(plan).toContain('Open judge Cloud Console');
    expect(plan).toContain('href="/viewer"');
    expect(dashboard).toContain('DEMO_TALK');
    expect(planData).toContain('LAUNCH_PLAN_CALLS = 6');
    expect(planData).toContain('gcloud run services describe');
    expect(planData).not.toContain('$0.54');
    expect(dashboardStyles).toContain('.assistant-plan');
    expect(dashboardStyles).toContain('text-align: center');
    expect(plan).toContain('Assistant · Gemini ADK');
    expect(plan).toContain('data-assistant-chat');
    expect(plan.indexOf('data-assistant-chat')).toBeLessThan(plan.indexOf('id="assistant-plan-title"'));
    expect(plan).toContain('data-support-msg="privacy"');
    expect(plan).toContain('data-support-msg="cli"');
    expect(plan).toContain('data-support-msg="formats"');
    expect(planData).toContain('SUPPORT_CLI_COMMAND');
    expect(dashboard).toContain("revealSupport('cli')");
    expect(dashboard).toContain("revealSupport('formats')");
  });

  it('keeps the wild-type loader available but does not curtain Session readings', () => {
    // /demo is the readings poster; /viewer is the operator deck. The loader
    // component remains available without blocking the judge poster.
    expect(demo).not.toContain('<ViewerLoader />');
    expect(viewer).toContain('fleetscope:viewer-ready');
    expect(dashboard).not.toContain('<ViewerLoader />');
    expect(viewerLoader).toContain('MIN_VISIBLE_MS');
    expect(viewerLoader).toContain('prefers-reduced-motion: reduce');
    expect(viewerLoaderEngine).toContain('export class WildType');
    expect(viewerLoaderParams).toContain('LOOP_TICKS');
  });

  it('keeps /viewer as the interactive operator flight deck', () => {
    expect(viewer).toContain('data-viewer-mode="operator"');
    expect(viewer).toContain('data-dropzone');
    expect(viewer).toContain('Follow folder…');
    expect(viewer).toContain('Full screen TUI');
    expect(viewer).toContain('data-workflow-board');
    expect(viewer).toContain('href="/demo"');
    expect(viewer).not.toContain('<SessionGraphs');
    expect(viewer).toContain('data-cli-copy');
    expect(viewer).toContain('data-open-tui');
    expect(viewer).toContain('Open TUI');
    expect(viewer).toContain('/local-tui/open');
    expect(viewer).toContain("method: 'POST'");
    expect(viewer).toContain('Opened native TUI in Terminal');
    expect(viewer).toContain('fleetscope-cli');
    expect(viewer).toContain('data-agy-project-path');
    expect(viewer).toContain('data-fleetscope-root');
    expect(viewer).toContain('id="agy-project"');
    expect(viewer).toContain('--project');
    expect(viewer).toContain('antigravity-live-cu');
    expect(viewer).toContain("DEFAULT_ROOT = '/Users/harryphan/Documents/dev/FleetScope'");
    expect(viewer).toContain('/local-sessions.json');
    expect(viewer).toContain('attachLocalSessions');
    expect(viewer).toContain('pnpm demo:antigravity');
    expect(viewer).toContain('--no-tui');
    expect(viewer).toContain('data-local-sessions');
    expect(viewer).toContain('data-follow-newest');
    // TDZ on localFollowId used to freeze “Looking for local sessions…” forever.
    const declareFollowId = viewer.indexOf('let localFollowId');
    const firstPreview = viewer.indexOf('refreshCommandPreviews();');
    expect(declareFollowId).toBeGreaterThan(-1);
    expect(firstPreview).toBeGreaterThan(declareFollowId);
    expect(viewer).not.toMatch(/function buildTuiCommand\(sessionId = localFollowId/);
    expect(viewer).toContain('bootLocalSessionList');
    expect(viewer).toContain('is:inline');
    expect(viewer).toContain('pnpm demo:agy');
    expect(viewer).toContain('data-copy-agy-repl');
    expect(viewer).toContain('Follow folder…');
    expect(viewer).toContain('data-stage-toggle');
    expect(viewer).toContain('story--strip');
    expect(viewer).toContain('story-strip__link');
    expect(viewerStyles).toContain('story--strip');
    expect(viewerStyles).toContain('viewer-cli-card__fields');
    // Immersive stage is opt-in; default operator deck must keep chrome visible.
    expect(viewer).toContain("classList.toggle('viewer-page--stage'");
    expect(viewer).not.toMatch(/class="viewer-page viewer-page--stage"/);
    expect(viewerStyles).toContain('display: none !important');
  });

  it('follows a user-granted local session without uploading', () => {
    expect(viewer).toContain('Follow file…');
    expect(viewer).toContain('showOpenFilePicker');
    expect(viewer).toContain('followedFile.getFile()');
    expect(viewer).toContain('window.setTimeout(pollFollowedFile, 750)');
    expect(viewer).toContain('api?.agent_viewer_go_live()');
  });

  it('puts all seven Session readings on the non-interactive /demo poster', () => {
    expect(nav).toContain("href: '/demo'");
    expect(demo).toContain('<SessionGraphs');
    expect(demo).toContain('sessionStatusLine');
    expect(demo).toContain('data-demo-poster');
    expect(demo).toContain('data-interactive="false"');
    expect(demo).toContain('data-live-tui-graph');
    expect(demo).toContain('bundled recorded');
    expect(demo).not.toContain('data-dropzone');
    expect(demo).not.toContain('Follow folder');
    expect(demo).not.toContain('agent_viewer');
    expect(demo).not.toContain('Open Agent Viewer');
    expect(demo).not.toContain('FullscreenToggle');
    expect(sessionGraphs).not.toContain('FullscreenToggle');
    expect(sessionGraphs).toContain('data-session-graphs');
    expect(sessionGraphs).toContain('What the record shows');
    expect(sessionGraphs).toContain('One session, seven readings');
    expect(sessionGraphs).toContain('Agents that ran:');
    for (const panel of ['flow', 'gantt', 'tree', 'check', 'uptime', 'spec', 'timeline']) {
      expect(sessionGraphs).toContain(`data-graph="${panel}"`);
    }
    const graphsData = read('apps/web/src/features/viewer/graphs.ts');
    for (const agent of ['coordinator', 'flight_search', 'hotel_search', 'itinerary_writer']) {
      expect(graphsData).toContain(`'${agent}'`);
      expect(sessionGraphs).toContain('Agents that ran:');
    }
    expect(readingsStyles).toContain('.reading-flow__node');
    expect(readingsStyles).toContain("data-tone='accent'");
  });

  it('adds a beui-inspired Approval Card playground without faking Case writes', () => {
    expect(approvals).toContain('data-approval-playground');
    expect(approvals).toContain('<ApprovalCard');
    expect(approvals).toContain('mode="review"');
    expect(approvals).toContain('mode="questions"');
    expect(approvals).toContain('mountApprovalCards');
    expect(approvals).toContain('no write path');
    expect(approvalCard).toContain('data-approval-card');
    expect(approvalCard).toContain("'recorded'");
    expect(viewer).toContain('mode="recorded"');
    expect(viewer).toContain('budget_guard');
    expect(viewer).not.toContain('Vendor activation waited for a person');
  });

  it('follows a local folder and pairs view.json without uploading', () => {
    expect(viewer).toContain('Follow folder…');
    expect(viewer).toContain('showDirectoryPicker');
    expect(viewer).toContain('view.json');
    expect(viewer).toContain('Following folder');
    expect(viewer).toContain('never uploaded');
    expect(viewer).toContain('JUMP_TO_AGENT_LATEST_LABEL');
    expect(viewer).toContain('Exit full screen');
    expect(viewer).toContain('<kbd>[</kbd>/<kbd>]</kbd> step');
    expect(viewer).toContain('data-stage-toggle');
    expect(viewer).toContain("classList.toggle('viewer-page--stage'");
    expect(viewerStyles).toContain('.viewer-shell:fullscreen');
    expect(viewerStyles).toContain('viewer-page--stage');
    expect(viewerStyles).toContain('100dvh');
    expect(viewerStyles).toContain('color-scheme: dark');
    expect(viewerStyles).toContain('[data-demo-link]');
    expect(viewerStyles).toContain('.viewer-page.viewer-page--stage');
    expect(viewerStyles).toContain('color-mix(in srgb, #8ab4f8 16%, #0b0d15)');
  });
});
