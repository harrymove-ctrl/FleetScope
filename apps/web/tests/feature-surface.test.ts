import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');

const viewer = read('apps/web/src/pages/viewer.astro');
const dashboard = read('apps/web/src/pages/dashboard.astro');
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

  it('uses hairline data rows instead of nested setup cards', () => {
    expect(dashboard).toContain('class="fs-dashboard__setup-card"');
    expect(dashboard).not.toContain('class="fs-card fs-dashboard__setup-card"');
    expect(dashboardStyles).toContain('.fs-dashboard__checks');
    expect(viewerStyles).toContain('.viewer-inspector dt');
    expect(viewerStyles).toContain('.viewer-inspector dd');
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

  it('makes the CLI-first producer and model contract visible on the viewer', () => {
    expect(viewer).toContain('data-cli-copy');
    expect(viewer).toContain('data-cli-command');
    expect(viewer).toContain('Google ADK 2.8.0');
    expect(viewer).toContain('gemini-3.7-flash');
    expect(viewerStyles).toContain('.viewer-cli-card');
  });
});
