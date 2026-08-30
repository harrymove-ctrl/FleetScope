import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');

const viewer = read('apps/web/src/pages/viewer.astro');
const sessionGraphs = read('apps/web/src/components/SessionGraphs.astro');
const readingsStyles = read('apps/web/src/styles/feature-readings.css');
const viewerLoader = read('apps/web/src/components/ViewerLoader.astro');
const viewerLoaderParams = read('apps/web/src/features/viewer/wild-type/params.ts');
const viewerLoaderEngine = read('apps/web/src/features/viewer/wild-type/engine.ts');
const dashboard = read('apps/web/src/pages/dashboard.astro');
const techWall = read('apps/web/src/components/TechWall.astro');
const dashboardLoader = read('apps/web/src/components/DashboardLoader.astro');
const dashboardLoaderEngine = read('apps/web/src/features/dashboard/sunset-slam.ts');
const index = read('apps/web/src/pages/index.astro');
const launchLayout = read('apps/web/src/layouts/LaunchLayout.astro');
const feature = read('apps/web/src/styles/feature.css');
const viewerStyles = read('apps/web/src/styles/feature-viewer.css');
const dashboardStyles = read('apps/web/src/styles/feature-dashboard.css');

describe('the feature-detail visual surface', () => {
  it('is enabled only by Viewer and Dashboard', () => {
    expect(viewer).toContain('surface="feature" theme="adaptive"');
    expect(dashboard).toContain('surface="feature" theme="adaptive"');
    expect(index).not.toContain('surface="feature"');
  });

  it('does not enter the landing layout', () => {
    expect(index).toContain("import LaunchLayout from '../layouts/LaunchLayout.astro'");
    expect(launchLayout).not.toContain('feature.css');
    expect(launchLayout).not.toContain('ThemeControl');
  });

  it('keeps every feature rule behind the explicit surface', () => {
    for (const source of [feature, viewerStyles, dashboardStyles]) {
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
    expect(dashboard).toContain('class="fs-dashboard__disclosures"');
    expect(dashboard).not.toContain('class="fs-dashboard__setup-card"');
    expect(dashboardStyles).toContain('.fs-dashboard__prompt');
    expect(dashboardStyles).toContain('.fs-dashboard__task');
    expect(viewerStyles).toContain('.viewer-inspector dt');
    expect(viewerStyles).toContain('.viewer-inspector dd');
  });

  it('guides the first session through upload and human review', () => {
    expect(dashboard).toContain('data-upload-dropzone');
    expect(dashboard).toContain('data-session-file-input');
    expect(dashboard).toContain('data-upload-list');
    expect(dashboard).toContain('data-approval-card');
    expect(dashboard).toContain('data-approval-approve');
    expect(dashboard).toContain('sessionStorage.setItem(DASHBOARD_HANDOFF_KEY');
    expect(viewer).toContain('takeDashboardHandoff');
    expect(viewer).toContain('window.sessionStorage.removeItem(DASHBOARD_HANDOFF_KEY)');
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
    expect(dashboardStyles).toContain('font-size: clamp(48px, 6vw, 88px)');
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

  it('mounts a bounded, reduced-motion-safe loader on the dashboard', () => {
    expect(dashboard).toContain(
      "import DashboardLoader from '../components/DashboardLoader.astro'",
    );
    expect(dashboard).toContain('<DashboardLoader />');
    expect(dashboardLoader).toContain('data-dashboard-loader');
    expect(dashboardLoader).toContain('prefers-reduced-motion: reduce');
    expect(dashboardLoader).toContain('fleetscope:dashboard-ready');
    expect(dashboardLoader).toContain('MIN_VISIBLE_MS = 3200');
    expect(dashboardLoaderEngine).toContain('FRAMES = 89');
    expect(dashboardLoaderEngine).toContain('VP_DEPTH = 2.17');
    expect(dashboardLoaderEngine).toContain("'FleetScope'");
    expect(dashboardLoaderEngine).not.toContain("'sunset'");
  });

  it('keeps the wild-type loader available but does not curtain Session readings', () => {
    // Readings are the default /viewer surface; a full-viewport black loader
    // hid them. The component stays in-tree for a later Flow handoff reveal.
    expect(viewer).not.toContain('<ViewerLoader />');
    expect(viewer).toContain('fleetscope:viewer-ready');
    expect(dashboard).not.toContain('<ViewerLoader />');
    expect(viewerLoader).toContain('MIN_VISIBLE_MS');
    expect(viewerLoader).toContain('prefers-reduced-motion: reduce');
    expect(viewerLoaderEngine).toContain('export class WildType');
    expect(viewerLoaderParams).toContain('"agents", "tasks", "tools", "proof"');
  });

  it('keeps producer/CLI controls behind More so the demo first paint stays readings-only', () => {
    expect(viewer).toContain('data-demo-mode="readings"');
    expect(viewer).toContain('viewer-demo-bar');
    expect(viewer).toContain('data-cli-copy');
    expect(viewer).toContain('pnpm demo:antigravity');
    expect(viewer).toContain('data-cli-command');
    expect(viewer).toContain('Demo view is read-only');
    expect(viewerStyles).toContain('.viewer-demo-bar__line');
  });

  it('follows a user-granted local session and keeps readings as the audience surface', () => {
    expect(viewer).toContain('Follow file…');
    expect(viewer).toContain('showOpenFilePicker');
    expect(viewer).toContain('followedFile.getFile()');
    expect(viewer).toContain('window.setTimeout(pollFollowedFile, 750)');
    expect(viewer).toContain("sessionGraphsEl?.toggleAttribute('hidden', false)");
    expect(viewer).toContain("sessionGraphsEl?.setAttribute('data-source', 'custom')");
    expect(viewer).toContain('api?.agent_viewer_go_live()');
  });

  it('puts Session readings before technical evidence and frames them as the default surface', () => {
    expect(viewer).toContain('<SessionGraphs');
    expect(viewer.indexOf('<SessionGraphs')).toBeLessThan(viewer.indexOf('data-dropzone'));
    expect(viewer).toContain('data-expert hidden');
    expect(viewer).toContain('data-story hidden');
    expect(viewer).toContain('Full screen graph');
    expect(sessionGraphs).toContain('data-session-graphs');
    expect(sessionGraphs).toContain('What the record shows');
    expect(sessionGraphs).toContain('One session, seven readings');
    expect(sessionGraphs).toContain('reading-flow');
    expect(readingsStyles).toContain('.reading-flow__node');
    expect(readingsStyles).toContain("data-tone='accent'");
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
    expect(viewerStyles).toContain('.viewer-shell:fullscreen');
  });
});
