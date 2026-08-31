import { Hono } from 'hono';
import { capabilityRoutes } from './routes/capability.js';
import { cloudRoutes } from './routes/cloud.js';
import { descriptorRoutes } from './routes/descriptor.js';
import { healthRoutes } from './routes/health.js';
import { liveRoutes } from './routes/live.js';
import { runRoutes, type RunRoutesDependencies } from './routes/runs.js';
import { productionRunDependencies } from './runs/dependencies.js';
import { cors } from './middleware/cors.js';
import { requestContext } from './middleware/request-context.js';
import type { GeminiDependencies } from './live/gemini.js';
import type { FleetScopeConfig } from './config/index.js';

/**
 * The bounded FleetScope backend — ONE service, deliberately small.
 *
 * Scope, and nothing beyond it:
 *   self-description · health · live capability description · one allowlisted
 *   live proof · bounded run admission · recorded Google Cloud evidence console
 *
 * It serves no Case data: recorded evidence is bundled with the static frontend
 * so the product works with this service switched off entirely.
 */
export function createApp(
  config: FleetScopeConfig,
  logLevel = 'info',
  /**
   * Injected only by tests, so the bounded live path can be exercised without a
   * network, a credential, or a cent of spend.
   */
  liveDependencies?: Partial<GeminiDependencies>,
  /**
   * The run controller's ports.
   *
   * Overridden by tests so admission, budget and idempotency are exercised with
   * no filesystem, no clock and no randomness. When omitted the REAL ports are
   * built, so the route is always mounted: a missing argument must never be
   * able to delete an endpoint.
   */
  runDependencies?: RunRoutesDependencies,
): Hono {
  const app = new Hono();

  app.use('*', requestContext(logLevel));
  app.use('*', cors(config));
  app.route('/', healthRoutes(config));
  app.route('/', capabilityRoutes(config));
  app.route('/', cloudRoutes(config));
  app.route('/', liveRoutes(config, liveDependencies));
  app.route('/', runRoutes(config, runDependencies ?? productionRunDependencies(config)));

  // Mounted last so it can enumerate the routes above it, and so a real route
  // always wins over the descriptor's own paths.
  app.route('/', descriptorRoutes(app, config));

  app.notFound((c) => c.json({ error: 'not_found' }, 404));

  return app;
}
