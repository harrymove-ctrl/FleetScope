import process from 'node:process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'astro/config';
import { localSessionsVitePlugin } from './src/lib/local-sessions.ts';
import { localTuiVitePlugin } from './src/lib/local-tui.ts';

const sessionsDir = join(dirname(fileURLToPath(import.meta.url)), '../../.fleetscope/sessions');

/**
 * Static output by default.
 *
 * The public/demo path must render from bundled recorded evidence with ZERO
 * backend availability, so there is no adapter and no SSR here. The optional
 * bounded API is reached from the browser only, and only when live mode is on.
 */
export default defineConfig({
  output: 'static',
  /*
   * No React integration.
   *
   * `@astrojs/react` is not installable here: its `vite-react-refresh-wrapper`
   * rejects Astro's CSS virtual modules with "Missing field moduleType", so
   * every `*.astro?astro&type=style` request 500s and the site serves
   * unstyled. Nothing on this site needs it — the one React component in the
   * tree, canvas-ui's Bend, was unwrapped into a plain-DOM engine
   * (src/features/bend/engine.ts) mounted from src/components/Bend.astro.
   */ // Dashboard is the first-run entry point; Cases remains a later platform view.
  build: { format: 'directory' },
  server: {
    // Astro hard-defaults to 4321, which fails outright when something already
    // holds that port. Reading PORT lets a supervisor assign a free one while
    // 4321 stays the default for anyone running `pnpm dev` by hand. An explicit
    // `--port` flag still wins over both, which is what the browser QA relies on.
    port: Number(process.env.PORT) || 4321,
  },
  vite: {
    // Workspace packages are consumed as TypeScript source (no per-package build
    // step) — six days, no build orchestration. Vite must transform them.
    ssr: { noExternal: [/^@fleetscope\//] },
    optimizeDeps: { exclude: ['@fleetscope/fixtures'] },
    plugins: [localSessionsVitePlugin(sessionsDir), localTuiVitePlugin(sessionsDir)],
  },
});
