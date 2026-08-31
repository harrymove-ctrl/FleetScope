import { Hono } from 'hono';
import type { FleetScopeConfig } from '../config/index.js';
import { CLOUD_CONSOLE_EVIDENCE, cloudConsoleSlice } from '../cloud/evidence.js';

/**
 * Read-only Google Cloud evidence for judges who cannot log into the project
 * Console. Every path is GET. Nothing here reaches Vertex or Admin APIs.
 */
export function cloudRoutes(config: FleetScopeConfig): Hono {
  const app = new Hono();

  const envelope = (resource: 'overview' | 'run' | 'storage' | 'session') => ({
    liveMode: config.liveMode,
    ...cloudConsoleSlice(resource),
  });

  app.get('/cloud/console', (c) => c.json(envelope('overview')));
  app.get('/cloud/console/run', (c) => c.json(envelope('run')));
  app.get('/cloud/console/storage', (c) => c.json(envelope('storage')));
  app.get('/cloud/console/session', (c) => c.json(envelope('session')));

  app.all('/cloud/console/*', (c) =>
    c.json(
      {
        error: 'method_not_allowed',
        bounds: CLOUD_CONSOLE_EVIDENCE.bounds,
        message: 'The cloud console is GET-only. It cannot start an agent or spend tokens.',
      },
      405,
    ),
  );

  return app;
}
